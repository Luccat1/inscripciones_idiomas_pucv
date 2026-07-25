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
//    TEST-01 (el resto de describe() blocks se agregan en el mismo archivo,
//    per D-05: un solo archivo consolidado).
const {
  mapearColumnas,
  parsearHorarios,
  determinarNivel,
  normalizarNombre,
  construirBuckets
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

  test('Francés no tiene entrada propia en el catálogo -> cae en _default', () => {
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
