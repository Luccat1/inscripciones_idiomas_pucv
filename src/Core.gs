/**
 * =============================================================================
 * Core.gs - Lectura, normalización y agregación de inscripciones
 * =============================================================================
 */

/**
 * Lee la hoja de respuestas y devuelve un arreglo de inscripciones normalizadas.
 * Cada inscripción: { nombre, email, idioma, nivel, horarios: [ids], rowIndex }
 */
function leerRespuestas(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(h => h.toString().toUpperCase().trim());
  const cols = mapearColumnas(headers);

  if (cols.email === -1 || cols.idioma === -1) {
    throw new Error(
      'No se encontraron las columnas mínimas (CORREO ELECTRÓNICO, IDIOMA). ' +
      'Usa el menú "🔍 Detectar columnas" para revisar el mapeo.'
    );
  }

  const inscripciones = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = normalizarEmail(row[cols.email]);
    if (!email || !email.includes('@')) continue;

    const idioma = normalizarIdioma(cols.idioma !== -1 ? row[cols.idioma] : '');
    const nivel = normalizarNivel(cols.nivel !== -1 ? row[cols.nivel] : '');
    const nombre = cols.nombreCompleto !== -1 ? row[cols.nombreCompleto]?.toString().trim() : '';
    const horariosCelda = cols.horarios !== -1 ? row[cols.horarios] : '';
    const horarios = parsearHorarios(horariosCelda, idioma);

    if (!idioma || !nivel || horarios.length === 0) continue;

    inscripciones.push({
      rowIndex: i + 1,
      nombre: nombre || '',
      email: email,
      idioma: idioma,
      nivel: nivel,
      horarios: horarios
    });
  }

  return inscripciones;
}

/**
 * Detecta el índice de cada columna relevante, primero por el nombre exacto
 * configurado en CONFIG.formCols y, si no aparece, por palabras clave.
 */
function mapearColumnas(headers) {
  const buscar = (nombreConfigurado, keywords) => {
    let idx = headers.indexOf(nombreConfigurado.toUpperCase().trim());
    if (idx !== -1) return idx;
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  };

  return {
    marcaTemporal: buscar(CONFIG.formCols.marcaTemporal, ['MARCA TEMPORAL', 'TIMESTAMP']),
    nombreCompleto: buscar(CONFIG.formCols.nombreCompleto, ['NOMBRE']),
    email: buscar(CONFIG.formCols.email, ['CORREO', 'EMAIL']),
    idioma: buscar(CONFIG.formCols.idioma, ['IDIOMA']),
    nivel: buscar(CONFIG.formCols.nivel, ['NIVEL']),
    horarios: buscar(CONFIG.formCols.horarios, ['DISPONIBILIDAD', 'HORARIO', 'DÍA', 'DIA'])
  };
}

/**
 * Los checkboxes de Google Forms llegan en una celda como texto separado
 * por comas. Se parsea y se hace match contra el catálogo canónico de
 * CONFIG.horariosPorIdioma para ese idioma (o "_default" si no aplica).
 * Devuelve la lista de ids de bloque reconocidos.
 */
function parsearHorarios(celda, idioma) {
  if (!celda) return [];
  const catalogo = CONFIG.horariosPorIdioma[idioma] || CONFIG.horariosPorIdioma['_default'];
  const opciones = celda.toString().split(',').map(s => s.trim()).filter(Boolean);

  const ids = [];
  opciones.forEach(opcion => {
    const match = catalogo.find(h => h.label.trim() === opcion);
    if (match) {
      ids.push(match.id);
    } else {
      Logger.log('Horario no reconocido (revisar catálogo en Config.gs): "' + opcion + '" [' + idioma + ']');
    }
  });

  return ids;
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
          emails: new Set()
        };
      }
      buckets[clave].count++;
      buckets[clave].emails.add(insc.email);
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

function normalizarNivel(valor) {
  if (!valor) return '';
  const texto = valor.toString().trim().toUpperCase();
  const match = CONFIG.niveles.find(n => n.toUpperCase() === texto);
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
