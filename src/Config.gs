/**
 * =============================================================================
 * IDIOMAS PUCV - Panorama de Inscripciones v1.0
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
  idiomas: ['Alemán', 'Francés', 'Inglés', 'Italiano'],

  // Niveles ofrecidos (ajustar si el catálogo real difiere)
  niveles: [
    'A1.1', 'A1.2', 'A2.1', 'A2.2',
    'B1.1', 'B1.2', 'B2.1', 'B2.2',
    'C1.1', 'C1.2'
  ],

  // Catálogo canónico de horarios por idioma. Cada bloque tiene un id
  // estable (usado como clave interna) y una etiqueta (la que aparece
  // literalmente como opción del formulario, para hacer match).
  // IMPORTANTE: ajustar "label" para que calce EXACTO con las opciones
  // del Google Form una vez conectado (ver menú "Detectar columnas").
  horariosPorIdioma: {
    'Alemán': [
      { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 20:00)' },
      { id: 'MJ_1730', label: 'Martes y jueves (17:30 - 20:00)' },
      { id: 'VS_1730', label: 'Viernes (17:30 - 20:00) y sábado (10:00 - 12:30)' }
    ],
    '_default': [
      { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 19:30)' },
      { id: 'VS_1730', label: 'Viernes (17:30 - 19:30) y sábado (10:00 - 12:00)' }
    ]
  },

  // Nombres de hojas usadas por el script
  hojas: {
    respuestas: 'Respuestas de formulario 1',
    panorama: 'Panorama de Cursos',
    estadoAvisos: '_Estado_Avisos'
  },

  // Mapeo de columnas del formulario -> encabezado esperado (mayúsculas/trim).
  // Si el encabezado real difiere, ajustar aquí. El sistema también intenta
  // detectar por palabras clave (ver detectarColumnas() en Main.gs).
  formCols: {
    marcaTemporal: 'MARCA TEMPORAL',
    nombreCompleto: 'NOMBRE COMPLETO',
    email: 'CORREO ELECTRÓNICO',
    idioma: 'IDIOMA',
    nivel: 'NIVEL',
    horarios: 'DISPONIBILIDAD'
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
