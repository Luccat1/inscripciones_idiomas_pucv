---
phase: quick-260813-hwv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/Config.gs
  - test/Core.test.js
autonomous: true
requirements: []
must_haves:
  truths:
    - "siguienteNivel('A1', 'Inglés') returns 'A2' (non-Alemán sequence starts A1→A2)"
    - "siguienteNivel('A1.1', 'Alemán') returns 'A1.2' (Alemán keeps subnivel sequence)"
    - "siguienteNivel('A1.1', 'Inglés') returns nivelPorEvaluar (A1.1 not in non-Alemán sequence)"
    - "All existing tests pass with npm test"
  artifacts:
    - path: src/Config.gs
      provides: "corrected nivelesPorIdioma with _default=[A1,A2,...] and Alemán=[A1.1,A1.2,...]"
    - path: test/Core.test.js
      provides: "updated siguienteNivel and determinarNivel tests matching new sequences"
  key_links:
    - from: src/Config.gs
      to: src/Core.gs
      via: "siguienteNivel() reads CONFIG.nivelesPorIdioma[idioma] || CONFIG.nivelesPorIdioma['_default']"
      pattern: "CONFIG\\.nivelesPorIdioma"
---

<objective>
Fix CONFIG.nivelesPorIdioma so non-German languages use the correct A1→A2→B1.1→... sequence and Alemán gets its own explicit A1.1→A1.2→A2.1→... subnivel sequence.

Purpose: The current _default sequence uses German subnivels (A1.1, A1.2, A2.1, A2.2), which is wrong for Inglés, Francés, Italiano — those languages use whole-level codes (A1, A2) not subnivels. This causes siguienteNivel() to misroute level calculations for all non-German enrollees who declare a known level.

Output: Updated src/Config.gs with corrected sequences; updated test/Core.test.js with tests that match the corrected sequences; all 21 existing tests still green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/Config.gs
@src/Core.gs
@test/Core.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix nivelesPorIdioma in Config.gs</name>
  <files>src/Config.gs</files>
  <action>
Make two targeted edits to the `nivelesPorIdioma` block (lines 36-39):

1. Change `_default` sequence from the Alemán subnivel sequence to the generic sequence:
   ```
   '_default': ['A1', 'A2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2']
   ```

2. Add an explicit `'Alemán'` entry above `'Japonés'`:
   ```
   'Alemán': ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B1+', 'B2.1', 'B2.2', 'C1.1', 'C1.2'],
   ```

The resulting `nivelesPorIdioma` block should be:
```javascript
nivelesPorIdioma: {
  'Alemán': ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B1+', 'B2.1', 'B2.2', 'C1.1', 'C1.2'],
  'Japonés': ['A1.1'],
  '_default': ['A1', 'A2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2']
},
```

Also review `CONFIG.niveles` (lines 25-29) — that flat array is never referenced in any src/ file (confirmed by grep), so it is dead config. Update it to list all unique levels across both sequences for documentation accuracy:
```javascript
niveles: [
  'A1', 'A2',
  'A1.1', 'A1.2', 'A2.1', 'A2.2',
  'B1.1', 'B1.2', 'B1+', 'B2.1', 'B2.2',
  'C1.1', 'C1.2'
],
```
Update its comment to note it is informational and not used at runtime.

Do NOT change any other part of Config.gs.
  </action>
  <verify>
    <automated>cd /c/Users/Usuario/Documents/code/inscripciones_idiomas_pucv && node -e "
const { CONFIG } = require('./src/Config.gs');
console.assert(CONFIG.nivelesPorIdioma['_default'][0] === 'A1', '_default should start with A1');
console.assert(CONFIG.nivelesPorIdioma['_default'][1] === 'A2', '_default second level should be A2');
console.assert(CONFIG.nivelesPorIdioma['Alemán'][0] === 'A1.1', 'Aleman should start with A1.1');
console.assert(CONFIG.nivelesPorIdioma['Alemán'][1] === 'A1.2', 'Aleman second should be A1.2');
console.assert(CONFIG.nivelesPorIdioma['Japonés'].length === 1, 'Japones still single level');
console.log('Config assertions passed');
"</automated>
  </verify>
  <done>
    - _default: ['A1', 'A2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2']
    - Alemán: ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B1+', 'B2.1', 'B2.2', 'C1.1', 'C1.2']
    - Japonés: ['A1.1'] (unchanged)
    - Node assertion script exits 0
  </done>
</task>

<task type="auto">
  <name>Task 2: Update siguienteNivel and determinarNivel tests for new sequences</name>
  <files>test/Core.test.js</files>
  <action>
After Task 1, two existing tests reference `'A1.1'` as an Inglés-sequence level and expect `'A1.2'` — those are now wrong because `_default` no longer contains `A1.1`.

Update the two affected tests inside `describe('siguienteNivel', ...)` and `describe('determinarNivel', ...)`:

**In `describe('determinarNivel')`** — test titled `'"con exactitud" -> siguienteNivel: next level in sequence for the idioma'` (currently line ~113):
- Change `nivelDeclaradoResp` arg from `'A1.1'` to `'A1'` (a level that exists in _default)
- Change expected result from `'A1.2'` to `'A2'`
- The call becomes: `determinarNivel('Sí, con exactitud y cuento con certificado/curso oficial', 'A1', 'Inglés')`
- Expected: `assert.equal(result, 'A2')`

**In `describe('siguienteNivel')`** — test titled `'nivel conocido que no es el tope -> devuelve el siguiente nivel en la secuencia _default'` (currently line ~145):
- Change arg from `'A1.1'` to `'A1'`
- Change expected from `'A1.2'` to `'A2'`
- The call becomes: `siguienteNivel('A1', 'Inglés')`
- Expected: `assert.equal(result, 'A2')`

Add a NEW test inside `describe('siguienteNivel')` that covers Alemán explicitly (its sequence is now a separate entry, not _default):
```javascript
test('Alemán A1.1 -> A1.2 (usa secuencia propia, no _default)', () => {
  const result = siguienteNivel('A1.1', 'Alemán');
  assert.equal(result, 'A1.2');
});
```

Also add a NEW test that verifies the old _default behavior is gone for non-Alemán languages:
```javascript
test('Inglés A1.1 no reconocido en _default -> nivelPorEvaluar', () => {
  const result = siguienteNivel('A1.1', 'Inglés');
  assert.equal(result, CONFIG.nivelPorEvaluar);
});
```

Do NOT change any other test. The Japonés test (`siguienteNivel('A1.1', 'Japonés')` → `nivelPorEvaluar`) remains valid and unchanged.
  </action>
  <verify>
    <automated>cd /c/Users/Usuario/Documents/code/inscripciones_idiomas_pucv && npm test</automated>
  </verify>
  <done>
    All tests pass (npm test exits 0, including the two updated tests and the two new tests).
    The suite grows from 21 to 23 passing tests.
  </done>
</task>

</tasks>

<verification>
After both tasks:
- `npm test` passes all tests (no failures, no errors)
- `node -e "const {CONFIG}=require('./src/Config.gs'); console.log(CONFIG.nivelesPorIdioma)"` shows the three correct entries: Alemán, Japonés, _default
- The `_default` sequence begins with 'A1', 'A2' (not 'A1.1', 'A1.2')
- The 'Alemán' entry begins with 'A1.1', 'A1.2'
</verification>

<success_criteria>
- CONFIG.nivelesPorIdioma._default = ['A1', 'A2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2']
- CONFIG.nivelesPorIdioma['Alemán'] = ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B1+', 'B2.1', 'B2.2', 'C1.1', 'C1.2']
- CONFIG.nivelesPorIdioma['Japonés'] = ['A1.1'] (unchanged)
- npm test exits 0, all tests green
- siguienteNivel('A1', 'Inglés') = 'A2'
- siguienteNivel('A1.1', 'Alemán') = 'A1.2'
- siguienteNivel('A1.1', 'Inglés') = CONFIG.nivelPorEvaluar (not in _default sequence)
</success_criteria>

<output>
After completion, create `.planning/quick/260813-hwv-corregir-nivelesporidioma-en-config-gs/260813-hwv-SUMMARY.md` following @$HOME/.claude/get-shit-done/templates/summary.md.
</output>
