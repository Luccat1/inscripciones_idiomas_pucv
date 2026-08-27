/**
 * =============================================================================
 * IDIOMAS PUCV - Panorama de Inscripciones v1.1.0
 * =============================================================================
 * Procesa las respuestas del formulario de matrícula inicial y mantiene un
 * panorama siempre actualizado de qué cursos (idioma + nivel + horario)
 * cumplen el mínimo para abrir.
 * =============================================================================
 */

const CONFIG = {
  // Semestre vigente. Cambiar en "Iniciar nuevo semestre" (ver Main.gs).
  semestre: '1er Semestre 2026',

  // Regla dura de apertura: mínimo de interesados por (idioma, nivel, horario)
  umbralMinimo: 6,

  // Destinatarios del aviso automático cuando un horario cruza el umbral
  emailAvisos: ['idiomas@pucv.cl'],

  // Idiomas ofrecidos
  idiomas: ['Alemán', 'Francés', 'Inglés', 'Italiano', 'Japonés'],

  // Niveles ofrecidos — informativo únicamente, no usado en runtime.
  // Lista todos los niveles únicos que aparecen en cualquier secuencia de
  // nivelesPorIdioma (Alemán + _default + Japonés).
  niveles: [
    'A1', 'A2',
    'A1.1', 'A1.2', 'A2.1', 'A2.2',
    'B1.1', 'B1.2', 'B1+', 'B2.1', 'B2.2',
    'C1.1', 'C1.2'
  ],

  // Secuencia canónica de niveles por idioma, usada por siguienteNivel() en
  // Core.gs para calcular el nivel de inscripción de quien ya domina el nivel
  // declarado. Mismo patrón de catálogo por idioma + fallback '_default' que
  // horariosPorIdioma.
  // — Alemán usa subniveles (A1.1, A1.2, ...) porque así opera su programa.
  // — Inglés, Francés, Italiano, y otros idiomas sin entrada propia usan la
  //   secuencia de niveles enteros (_default: A1, A2, ...).
  // — Japonés tiene solo A1.1 (único nivel ofrecido este semestre).
  nivelesPorIdioma: {
    'Alemán': ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B1+', 'B2.1', 'B2.2', 'C1.1', 'C1.2'],
    'Japonés': ['A1.1'],
    '_default': ['A1', 'A2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2']
  },

  // Catálogo canónico de horarios por idioma. Cada bloque tiene un id
  // estable (usado como clave interna) y una etiqueta (la que aparece
  // literalmente como opción del formulario, para hacer match).
  // El match contra la respuesta real es case-insensitive (ver parsearHorarios
  // en Core.gs), pero el TEXTO (horas, días) debe seguir calzando con las
  // opciones reales del Form.
  // Verified against form options for 2do Semestre 2026 (2026-08). All five
  // active idiomas have explicit entries; '_default' is a fallback for
  // unexpected or future languages only.
  horariosPorIdioma: {
    'Alemán': [
      { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 19:30)' },
      { id: 'MJ_1730', label: 'Martes y jueves (17:30 - 19:30)' }
    ],
    'Francés': [
      { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 19:30)' },
      { id: 'MJ_1730', label: 'Martes y jueves (17:30 - 19:30)' }
    ],
    'Inglés': [
      { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 19:30)' },
      { id: 'VS_1730', label: 'Viernes (17:30 - 19:30) y sábado (10:00 - 12:00)' }
    ],
    'Italiano': [
      { id: 'MJ_1730', label: 'Martes y jueves (17:30 - 19:30)' },
      { id: 'VS_1730', label: 'Viernes (17:30 - 19:30) y sábado (10:00 - 12:00)' }
    ],
    'Japonés': [
      { id: 'MJ_1730_UNICO', label: 'Martes y jueves (17:30 - 19:30) - Único horario disponible este semestre' }
    ],
    '_default': [
      { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 19:30)' },
      { id: 'VS_1730', label: 'Viernes (17:30 - 19:30) y sábado (10:00 - 12:00)' }
    ]
  },

  // Resolución de nivel cuando la persona no tiene nivel acreditado (ver
  // determinarNivel() en Core.gs, según la respuesta a "¿Conoces tu nivel
  // actual en el idioma que quieres aprender?"):
  nivelPrincipiante: 'A1.1',                        // "Soy principiante absoluto."
  nivelPorEvaluar: 'Por evaluar (prueba de nivel)',  // "No, pero he tomado clases." -- requiere prueba de nivel antes de asignar un nivel real

  // Nombres de hojas usadas por el script
  hojas: {
    respuestas: 'Respuestas de formulario 1',
    panorama: 'Panorama de Cursos',
    estadoAvisos: '_Estado_Avisos'
  },

  // Mapeo de columnas del formulario -> encabezado exacto de la pregunta
  // (mayúsculas/trim se aplican antes de comparar). Si el encabezado real
  // difiere, ajustar aquí. El sistema también intenta detectar por palabras
  // clave para los campos de índice único (ver detectarColumnas() en Main.gs).
  //
  // El Form usa ramas condicionales por idioma: "¿Cuál horario prefieres?" y
  // "¿Qué modalidad te acomoda más?" se repiten en varias secciones (una por
  // idioma), todas con el MISMO texto de pregunta. Por eso horarios/modalidad
  // se resuelven por TODAS las columnas que calcen ese texto exacto, tomando
  // en cada fila la primera celda no vacía (ver mapearColumnas() en Core.gs).
  formCols: {
    marcaTemporal: 'MARCA TEMPORAL',
    nombreCompleto: 'NOMBRES',
    apellidos: 'APELLIDOS',
    email: 'DIRECCIÓN DE CORREO ELECTRÓNICO', // cuenta Google que envió el Form (no la tipeada a mano)
    idioma: '¿A QUÉ IDIOMA QUIERES INSCRIBIRTE?',
    conoceNivel: '¿CONOCES TU NIVEL ACTUAL EN EL IDIOMA QUE QUIERES APRENDER?',
    nivelDeclarado: '¿QUÉ NIVELES HAS ALCANZADO?',
    horarios: '¿CUÁL HORARIO PREFIERES?',
    modalidad: '¿QUÉ MODALIDAD TE ACOMODA MÁS?'
  },

  // Colores institucionales PUCV
  colores: {
    primario: '#003366',
    secundario: '#0066CC',
    acento: '#FFD700',
    texto: '#333333',
    fondo: '#F5F5F5',
    verdeAbre: '#d4edda',
    amarilloBalance: '#fff3cd',
    grisSinInteres: '#f1f1f1'
  }
};

// ============================================================================
// EXPORT PARA TESTS (Node) -- bloque inerte bajo el runtime V8 de Apps Script,
// que no define un global `module`. Ver test/Core.test.js y
// .planning/phases/01-test-harness-characterization-tests/01-RESEARCH.md.
// ============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG };
}
