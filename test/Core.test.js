'use strict';

/**
 * =============================================================================
 * Core.test.js - Tests de caracterización para las 5 funciones puras de
 * Core.gs (TEST-01): mapearColumnas, parsearHorarios, determinarNivel,
 * normalizarNombre, construirBuckets.
 *
 * Estos tests documentan el comportamiento REAL y actual de las funciones
 * (no un comportamiento idealizado), usando el CONFIG real de src/Config.gs
 * (nunca un fixture sintético -- ver D-03/D-04 en 01-RESEARCH.md). Cualquier
 * cambio futuro al catálogo real que rompa un test acá es una señal
 * intencional para revisar, no friccion a evitar.
 *
 * Ver .planning/phases/01-test-harness-characterization-tests/01-RESEARCH.md
 * (Pattern 1/2/3) y 01-PATTERNS.md para el detalle de las decisiones detrás
 * de este archivo.
 * =============================================================================
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// 1. CONFIG real (no sintético), requerido ANTES de invocar cualquier función
//    de Core.gs, ya que estas leen CONFIG como global ambiental (D-03).
global.CONFIG = require('../src/Config.gs').CONFIG;

// 2. Logger stub -- parsearHorarios() llama Logger.log() en su rama de
//    horario no reconocido (src/Core.gs:161). Sin este stub, ese test
//    lanzaría ReferenceError en vez de aserción de comportamiento.
global.Logger = { log: () => {} };

// 3. Ahora sí, requerir Core.gs y desestructurar las 5 funciones objetivo de
//    TEST-01 (los bloques de tests restantes se agregan en este mismo
//    archivo, per D-05: un solo archivo consolidado).
const {
  mapearColumnas,
  parsearHorarios,
  determinarNivel,
  normalizarNombre,
  construirBuckets,
  siguienteNivel,
  encontrarHorarioNoReconocido
} = require('../src/Core.gs');

describe('mapearColumnas', () => {
  test('encabezados sin columna de email/idioma -> -1 (buscarUno no encuentra match)', () => {
    const headers = ['MARCA TEMPORAL', 'NOMBRES'];
    const cols = mapearColumnas(headers);
    assert.equal(cols.email, -1);
    assert.equal(cols.idioma, -1);
  });

  test('encabezados sin columna de horarios/modalidad -> [] (buscarTodos, no -1)', () => {
    const headers = ['MARCA TEMPORAL', 'NOMBRES', 'APELLIDOS'];
    const cols = mapearColumnas(headers);
    assert.deepEqual(cols.horarios, []);
    assert.deepEqual(cols.modalidad, []);
  });

  test('encabezados reales (texto exacto de CONFIG.formCols) -> todos los índices >= 0', () => {
    const headers = [
      CONFIG.formCols.marcaTemporal,
      CONFIG.formCols.nombreCompleto,
      CONFIG.formCols.apellidos,
      CONFIG.formCols.email,
      CONFIG.formCols.idioma,
      CONFIG.formCols.conoceNivel,
      CONFIG.formCols.nivelDeclarado,
      CONFIG.formCols.horarios,
      CONFIG.formCols.modalidad
    ];
    const cols = mapearColumnas(headers);
    assert.ok(cols.marcaTemporal >= 0);
    assert.ok(cols.nombreCompleto >= 0);
    assert.ok(cols.apellidos >= 0);
    assert.ok(cols.email >= 0);
    assert.ok(cols.idioma >= 0);
    assert.ok(cols.conoceNivel >= 0);
    assert.ok(cols.nivelDeclarado >= 0);
    assert.deepEqual(cols.horarios, [7]);
    assert.deepEqual(cols.modalidad, [8]);
  });
});

describe('parsearHorarios', () => {
  test('horario no reconocido -> [] (se descarta en silencio, se loguea, no se lanza)', () => {
    const result = parsearHorarios('Un horario inventado que no calza', 'Alemán');
    assert.deepEqual(result, []);
  });

  test('Francés tiene entrada propia con LM_1730 y MJ_1730 -> reconoce LM_1730', () => {
    const result = parsearHorarios('Lunes y miércoles (17:30 - 19:30)', 'Francés');
    assert.deepEqual(result, ['LM_1730']);
  });

  test('selección múltiple separada por comas, case/espacio-insensitive, contra el catálogo real de Alemán', () => {
    const result = parsearHorarios(
      'Lunes y miércoles (17:30 - 19:30), Martes y jueves (17:30 - 19:30)',
      'Alemán'
    );
    assert.deepEqual(result, ['LM_1730', 'MJ_1730']);
  });

  test('celda vacía o null -> [] (guard temprano, nunca null/undefined)', () => {
    assert.deepEqual(parsearHorarios('', 'Alemán'), []);
    assert.deepEqual(parsearHorarios(null, 'Alemán'), []);
  });
});

describe('determinarNivel', () => {
  test('"con exactitud" -> siguienteNivel: next level in sequence for the idioma', () => {
    const result = determinarNivel(
      'Sí, con exactitud y cuento con certificado/curso oficial',
      'A1',
      'Inglés'
    );
    assert.equal(result, 'A2');
  });

  test('"principiante absoluto" -> CONFIG.nivelPrincipiante', () => {
    const result = determinarNivel('Soy principiante absoluto.', '', 'Inglés');
    assert.equal(result, CONFIG.nivelPrincipiante);
    assert.equal(result, 'A1.1');
  });

  test('"he tomado clases" -> CONFIG.nivelPorEvaluar', () => {
    const result = determinarNivel('No, pero he tomado clases.', '', 'Inglés');
    assert.equal(result, CONFIG.nivelPorEvaluar);
    assert.equal(result, 'Por evaluar (prueba de nivel)');
  });

  test('respuesta vacía o undefined -> \'\' (nunca null/undefined)', () => {
    assert.equal(determinarNivel('', '', 'Inglés'), '');
    assert.equal(determinarNivel(undefined, undefined, 'Inglés'), '');
  });

  test('respuesta que no calza con ninguna rama -> \'\' (fallthrough)', () => {
    const result = determinarNivel('respuesta que no calza con ninguna rama', '', 'Inglés');
    assert.equal(result, '');
  });
});

describe('siguienteNivel', () => {
  test('nivel conocido que no es el tope -> devuelve el siguiente nivel en la secuencia _default', () => {
    const result = siguienteNivel('A1', 'Inglés');
    assert.equal(result, 'A2');
  });

  test('nivel en el tope de la escala (_default: C1.2) -> nivelPorEvaluar', () => {
    const result = siguienteNivel('C1.2', 'Inglés');
    assert.equal(result, CONFIG.nivelPorEvaluar);
  });

  test('nivel no reconocido en el catálogo -> nivelPorEvaluar (se loguea, no se lanza)', () => {
    const result = siguienteNivel('Z9.9', 'Inglés');
    assert.equal(result, CONFIG.nivelPorEvaluar);
  });

  test('Japonés con A1.1 (único nivel disponible, es el tope) -> nivelPorEvaluar', () => {
    const result = siguienteNivel('A1.1', 'Japonés');
    assert.equal(result, CONFIG.nivelPorEvaluar);
  });

  test('Alemán A1.1 -> A1.2 (usa secuencia propia, no _default)', () => {
    const result = siguienteNivel('A1.1', 'Alemán');
    assert.equal(result, 'A1.2');
  });

  test('Inglés A1.1 no reconocido en _default -> nivelPorEvaluar', () => {
    const result = siguienteNivel('A1.1', 'Inglés');
    assert.equal(result, CONFIG.nivelPorEvaluar);
  });
});

describe('normalizarNombre', () => {
  test('particulas ("de", "la") se preservan en minúscula cuando no son la primera palabra', () => {
    const result = normalizarNombre('juan perez de la cruz');
    assert.equal(result, 'Juan Perez de la Cruz');
  });

  test('espacios múltiples/extremos se colapsan; partícula "von" se preserva en minúscula', () => {
    const result = normalizarNombre('  MARÍA   VON TRAPP  ');
    assert.equal(result, 'María von Trapp');
  });

  test('cadena vacía -> \'\'', () => {
    assert.equal(normalizarNombre(''), '');
  });
});

describe('construirBuckets', () => {
  test('dos inscripciones con mismo (idioma, nivel, horario) y distinto email -> count=2, emails Set de 2, modalidades tallado', () => {
    const inscripciones = [
      {
        rowIndex: 2,
        nombre: 'Persona Uno',
        email: 'persona1@pucv.cl',
        idioma: 'Alemán',
        nivel: 'A1.1',
        horarios: ['LM_1730'],
        modalidades: ['Presencial']
      },
      {
        rowIndex: 3,
        nombre: 'Persona Dos',
        email: 'persona2@pucv.cl',
        idioma: 'Alemán',
        nivel: 'A1.1',
        horarios: ['LM_1730'],
        modalidades: ['Virtual']
      }
    ];

    const buckets = construirBuckets(inscripciones);
    const bucket = buckets['Alemán||A1.1||LM_1730'];

    assert.equal(bucket.count, 2);
    // emails es un Set (src/Core.gs:197), no un arreglo -- NUNCA usar
    // JSON.stringify() para comparar (un Set serializa a {} y descarta los
    // datos bajo prueba, ver Pitfall 3 en 01-RESEARCH.md). assert.deepEqual
    // compara el contenido de un Set directamente, sin importar el orden.
    assert.deepEqual(bucket.emails, new Set(['persona1@pucv.cl', 'persona2@pucv.cl']));
    assert.deepEqual(bucket.modalidades, { Presencial: 1, Virtual: 1 });
  });

  test('lista vacía de inscripciones -> {} (objeto vacío, no null/undefined)', () => {
    assert.deepEqual(construirBuckets([]), {});
  });
});
