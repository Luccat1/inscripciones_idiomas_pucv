/**
 * =============================================================================
 * Core.gs - Lectura, normalización y agregación de inscripciones
 * =============================================================================
 */

/**
 * Lee la hoja de respuestas y devuelve un objeto con:
 * - inscripciones: arreglo de inscripciones normalizadas.
 *   Cada inscripción: { nombre, email, idioma, nivel, horarios: [ids], rowIndex }
 * - horarioNoReconocido: { count, ejemplos } -- horarios descartados por no
 *   calzar con el catálogo; count es el total de ocurrencias, ejemplos es un
 *   arreglo de hasta 3 strings distintos para facilitar el diagnóstico.
 */
function leerRespuestas(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { inscripciones: [], horarioNoReconocido: { count: 0, ejemplos: [] } };

  const headers = data[0].map(h => h.toString().toUpperCase().trim());
  const cols = mapearColumnas(headers);

  if (cols.email === -1 || cols.idioma === -1) {
    throw new Error(
      'No se encontraron las columnas mínimas (correo, idioma). ' +
      'Usa el menú "🔍 Detectar columnas" para revisar el mapeo.'
    );
  }

  const inscripciones = [];
  const horarioNoReconocido = { count: 0, ejemplos: [] };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = normalizarEmail(row[cols.email]);
    if (!email || !email.includes('@')) continue;

    const idioma = normalizarIdioma(row[cols.idioma]);

    const nombres = cols.nombreCompleto !== -1 ? row[cols.nombreCompleto] : '';
    const apellidos = cols.apellidos !== -1 ? row[cols.apellidos] : '';
    const nombre = normalizarNombre([nombres, apellidos].filter(Boolean).join(' '));

    const conoceNivelResp = cols.conoceNivel !== -1 ? row[cols.conoceNivel] : '';
    const nivelDeclaradoResp = cols.nivelDeclarado !== -1 ? row[cols.nivelDeclarado] : '';
    const nivel = determinarNivel(conoceNivelResp, nivelDeclaradoResp, idioma);

    const horariosCelda = primeraCeldaNoVacia(row, cols.horarios);
    const horarios = parsearHorarios(horariosCelda, idioma);

    const noReconocidos = encontrarHorarioNoReconocido(horariosCelda, idioma);
    noReconocidos.forEach(etiqueta => {
      horarioNoReconocido.count++;
      if (horarioNoReconocido.ejemplos.indexOf(etiqueta) === -1 && horarioNoReconocido.ejemplos.length < 3) {
        horarioNoReconocido.ejemplos.push(etiqueta);
      }
    });

    const modalidadCelda = primeraCeldaNoVacia(row, cols.modalidad);
    const modalidades = parsearModalidad(modalidadCelda);

    if (!idioma || !nivel || horarios.length === 0) continue;

    inscripciones.push({
      rowIndex: i + 1,
      nombre: nombre || '',
      email: email,
      idioma: idioma,
      nivel: nivel,
      horarios: horarios,
      modalidades: modalidades
    });
  }

  return { inscripciones, horarioNoReconocido };
}

/**
 * Detecta el índice de cada columna relevante. Los campos de índice único
 * se buscan por nombre exacto y, si no aparece, por palabras clave.
 *
 * "horarios" y "modalidad" son especiales: el Form repite la MISMA pregunta
 * en varias secciones (una por idioma, vía ramas condicionales), así que acá
 * se devuelven TODOS los índices que calzan exacto con esa pregunta -- en
 * cada fila solo una de esas columnas viene con datos (las demás quedan
 * vacías porque la rama no aplicó), y leerRespuestas() toma la primera no
 * vacía (ver primeraCeldaNoVacia()).
 */
function mapearColumnas(headers) {
  const buscarUno = (nombreConfigurado, keywords) => {
    let idx = headers.indexOf(nombreConfigurado.toUpperCase().trim());
    if (idx !== -1) return idx;
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  };

  const buscarTodos = (nombreConfigurado) => {
    const nombreExacto = nombreConfigurado.toUpperCase().trim();
    const indices = [];
    headers.forEach((h, idx) => {
      if (h === nombreExacto) indices.push(idx);
    });
    return indices;
  };

  return {
    marcaTemporal: buscarUno(CONFIG.formCols.marcaTemporal, ['MARCA TEMPORAL', 'TIMESTAMP']),
    nombreCompleto: buscarUno(CONFIG.formCols.nombreCompleto, ['NOMBRE']),
    apellidos: buscarUno(CONFIG.formCols.apellidos, ['APELLIDO']),
    email: buscarUno(CONFIG.formCols.email, ['DIRECCIÓN DE CORREO', 'CORREO', 'EMAIL']),
    idioma: buscarUno(CONFIG.formCols.idioma, ['IDIOMA']),
    conoceNivel: buscarUno(CONFIG.formCols.conoceNivel, ['CONOCES TU NIVEL']),
    nivelDeclarado: buscarUno(CONFIG.formCols.nivelDeclarado, ['NIVELES HAS ALCANZADO']),
    horarios: buscarTodos(CONFIG.formCols.horarios),
    modalidad: buscarTodos(CONFIG.formCols.modalidad)
  };
}

/**
 * Dada una lista de índices de columna (posibles bloques condicionales),
 * devuelve el valor de la primera celda no vacía de esa fila.
 */
function primeraCeldaNoVacia(row, indices) {
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    if (idx !== -1 && row[idx] !== '' && row[idx] !== null && row[idx] !== undefined) {
      return row[idx];
    }
  }
  return '';
}

/**
 * Resuelve el nivel real de la inscripción según la respuesta a "¿Conoces tu
 * nivel actual en el idioma que quieres aprender?":
 * - "Sí, con exactitud..." -> llama siguienteNivel(nivelDeclarado, idioma)
 *   para avanzar al siguiente nivel en la secuencia del idioma.
 * - "Soy principiante absoluto." -> CONFIG.nivelPrincipiante (ej. A1.1).
 * - "No, pero he tomado clases." -> CONFIG.nivelPorEvaluar (requiere prueba
 *   de nivel; no se puede asumir un nivel formal sin evaluar).
 */
function determinarNivel(conoceNivelResp, nivelDeclaradoResp, idioma) {
  const respuesta = normalizarTexto(conoceNivelResp);
  if (!respuesta) return '';

  if (respuesta.indexOf('con exactitud') !== -1) {
    return siguienteNivel(nivelDeclaradoResp, idioma);
  }
  if (respuesta.indexOf('principiante absoluto') !== -1) {
    return CONFIG.nivelPrincipiante;
  }
  if (respuesta.indexOf('he tomado clases') !== -1) {
    return CONFIG.nivelPorEvaluar;
  }
  return '';
}

/**
 * Dado el nivel declarado (ya dominado) y el idioma, devuelve el siguiente
 * nivel en la secuencia canónica de CONFIG.nivelesPorIdioma para ese idioma
 * (o '_default' si el idioma no tiene entrada propia). Si el nivel declarado
 * es el tope de la escala, o si no se reconoce en el catálogo, devuelve
 * CONFIG.nivelPorEvaluar.
 */
function siguienteNivel(nivelDeclaradoResp, idioma) {
  const secuencia = CONFIG.nivelesPorIdioma[idioma] || CONFIG.nivelesPorIdioma['_default'];
  const nivelNorm = normalizarNivel(nivelDeclaradoResp, idioma);
  const idx = secuencia.indexOf(nivelNorm);
  if (idx === -1 || idx === secuencia.length - 1) {
    Logger.log('siguienteNivel: nivel "' + nivelDeclaradoResp + '" no tiene siguiente en la secuencia [' + idioma + '] -> nivelPorEvaluar');
    return CONFIG.nivelPorEvaluar;
  }
  return secuencia[idx + 1];
}

/**
 * Los checkboxes de Google Forms llegan en una celda como texto separado
 * por comas. Se parsea y se hace match (case-insensitive, espacios
 * colapsados) contra el catálogo canónico de CONFIG.horariosPorIdioma para
 * ese idioma (o "_default" si no aplica). Devuelve la lista de ids de
 * bloque reconocidos.
 */
function parsearHorarios(celda, idioma) {
  if (!celda) return [];
  const catalogo = CONFIG.horariosPorIdioma[idioma] || CONFIG.horariosPorIdioma['_default'];
  const opciones = celda.toString().split(',').map(s => s.trim()).filter(Boolean);

  const ids = [];
  opciones.forEach(opcion => {
    const opcionNorm = normalizarTexto(opcion);
    const match = catalogo.find(h => normalizarTexto(h.label) === opcionNorm);
    if (match) {
      ids.push(match.id);
    } else {
      Logger.log('Horario no reconocido (revisar catálogo en Config.gs): "' + opcion + '" [' + idioma + ']');
    }
  });

  return ids;
}

/**
 * Devuelve las etiquetas de horario de la celda que NO calzan con el
 * catálogo del idioma. Usado para el tracking de horarioNoReconocido en
 * leerRespuestas(). Nunca lanza; devuelve arreglo vacío si celda está vacía.
 */
function encontrarHorarioNoReconocido(celda, idioma) {
  if (!celda) return [];
  const catalogo = CONFIG.horariosPorIdioma[idioma] || CONFIG.horariosPorIdioma['_default'];
  const opciones = celda.toString().split(',').map(s => s.trim()).filter(Boolean);

  return opciones.filter(opcion => {
    const opcionNorm = normalizarTexto(opcion);
    return !catalogo.find(h => normalizarTexto(h.label) === opcionNorm);
  });
}

/**
 * Modalidad es informativa (no afecta el umbral de apertura): solo se
 * limpia la lista de checkboxes marcados, sin match contra catálogo.
 */
function parsearModalidad(celda) {
  if (!celda) return [];
  return celda.toString().split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Agrega las inscripciones en buckets por (idioma, nivel, horario).
 * count: cuántas veces aparece ese bloque marcado (una persona puede sumar
 * en varios bloques si marcó varios horarios).
 * emails: set de emails únicos en ese bucket, para poder derivar
 * "personas únicas" a nivel de (idioma, nivel).
 */
function construirBuckets(inscripciones) {
  const buckets = {};

  inscripciones.forEach(insc => {
    insc.horarios.forEach(horarioId => {
      const clave = [insc.idioma, insc.nivel, horarioId].join('||');
      if (!buckets[clave]) {
        buckets[clave] = {
          idioma: insc.idioma,
          nivel: insc.nivel,
          horarioId: horarioId,
          horarioLabel: obtenerLabelHorario(insc.idioma, horarioId),
          count: 0,
          emails: new Set(),
          modalidades: {} // informativo, no afecta el umbral -- ver parsearModalidad()
        };
      }
      buckets[clave].count++;
      buckets[clave].emails.add(insc.email);
      insc.modalidades.forEach(m => {
        buckets[clave].modalidades[m] = (buckets[clave].modalidades[m] || 0) + 1;
      });
    });
  });

  return buckets;
}

/**
 * Cuenta personas únicas por (idioma, nivel), sin importar en cuántos
 * horarios distintos aparezcan. Sirve de contrapeso al conteo por bloque,
 * que puede inflarse si la misma persona marcó varias opciones.
 */
function contarPersonasUnicasPorNivel(inscripciones) {
  const porNivel = {};
  inscripciones.forEach(insc => {
    const clave = [insc.idioma, insc.nivel].join('||');
    if (!porNivel[clave]) porNivel[clave] = new Set();
    porNivel[clave].add(insc.email);
  });

  const resultado = {};
  Object.keys(porNivel).forEach(clave => {
    resultado[clave] = porNivel[clave].size;
  });
  return resultado;
}

function obtenerLabelHorario(idioma, horarioId) {
  const catalogo = CONFIG.horariosPorIdioma[idioma] || CONFIG.horariosPorIdioma['_default'];
  const match = catalogo.find(h => h.id === horarioId);
  return match ? match.label : horarioId;
}

// ============================================================================
// NORMALIZACIÓN
// ============================================================================

function normalizarTexto(texto) {
  if (!texto) return '';
  return texto.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizarEmail(email) {
  if (!email) return '';
  return email.toString().trim().toLowerCase();
}

function normalizarIdioma(valor) {
  if (!valor) return '';
  const texto = valor.toString().trim();
  const match = CONFIG.idiomas.find(i => i.toLowerCase() === texto.toLowerCase());
  return match || texto;
}

/**
 * Normaliza un valor de nivel contra la secuencia canónica del idioma
 * (CONFIG.nivelesPorIdioma[idioma] || CONFIG.nivelesPorIdioma['_default']).
 * Si no encuentra match, devuelve el texto tal como viene (en mayúsculas).
 */
function normalizarNivel(valor, idioma) {
  if (!valor) return '';
  const texto = valor.toString().trim().toUpperCase();
  const secuencia = CONFIG.nivelesPorIdioma[idioma] || CONFIG.nivelesPorIdioma['_default'];
  const match = secuencia.find(n => n.toUpperCase() === texto);
  return match || texto;
}

function normalizarNombre(texto) {
  if (!texto) return '';
  let normalizado = texto.toString().trim().replace(/\s+/g, ' ');
  const particulas = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von'];

  normalizado = normalizado.toLowerCase().split(' ').map((palabra, index) => {
    if (index > 0 && particulas.includes(palabra)) return palabra;
    return palabra.charAt(0).toUpperCase() + palabra.slice(1);
  }).join(' ');

  return normalizado;
}

// ============================================================================
// EXPORT PARA TESTS (Node) -- bloque inerte bajo el runtime V8 de Apps Script,
// que no define un global `module`. Exporta las 5 funciones objetivo de
// TEST-01 más sus helpers internos, para permitir aserciones directas sin
// forzar toda cobertura a pasar por 2 niveles de indirección. Ver
// test/Core.test.js y
// .planning/phases/01-test-harness-characterization-tests/01-RESEARCH.md.
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mapearColumnas,
    parsearHorarios,
    determinarNivel,
    normalizarNombre,
    construirBuckets,
    normalizarTexto,
    normalizarNivel,
    normalizarIdioma,
    primeraCeldaNoVacia,
    obtenerLabelHorario,
    siguienteNivel,
    encontrarHorarioNoReconocido,
    leerRespuestas
  };
}
