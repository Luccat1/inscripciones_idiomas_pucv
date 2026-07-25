# Phase 1: Test Harness & Characterization Tests - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 5 (2 modified, 3 new)
**Analogs found:** 1 exact (README.md self-analog) / 5 total — the other 4 have **no true analog inside this repo** because this phase introduces the repo's first-ever test infrastructure. Where useful, a cross-repo precedent from a sibling PUCV project is noted, but flagged clearly as "different mechanism, do not copy verbatim."

## Summary for the planner

This phase is unusual for pattern-mapping: **there is no prior test file, no prior `package.json`, and no prior `module.exports` anywhere in this repository.** `.planning/codebase/TESTING.md` already confirms zero existing automated tests. Do not force a fake analog — RESEARCH.md's empirically-verified Pattern 1/2/3 (guarded shim, ambient-global stubbing, characterization assertions) are the authoritative source for the 3 new/modified code files. This PATTERNS.md instead grounds those patterns against the **real, current** `src/Core.gs`/`src/Config.gs` content (exact line numbers, exact current function bodies) so the planner can write precise "insert after line N" instructions, and calls out the one cross-repo precedent (PUCV2's `TestInicioClases.ts`) that is relevant only for naming/tone conventions, not mechanism.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/Core.gs` (modified — append shim) | utility (pure transform functions) | transform | *(none in-repo)* — RESEARCH.md Pattern 1 | no analog |
| `src/Config.gs` (modified — append shim) | config | transform (data export) | *(none in-repo)* — RESEARCH.md Pattern 1 | no analog |
| `package.json` (new, root) | config | n/a (tooling manifest) | *(none in-repo)*; cross-repo: `PlanificadorClases/package.json`, `PUCV2/package.json` | partial/cross-repo only |
| `test/Core.test.js` (new) | test | transform (exercises pure functions) | *(none in-repo)*; cross-repo (different mechanism): `PUCV2/src/TestInicioClases.ts` | role-match, mechanism differs |
| `README.md` (modified — add "🧪 Tests" section) | documentation | n/a | `README.md` itself (existing sections) | exact (self-analog for heading/format style) |

## Pattern Assignments

### `src/Core.gs` (utility, transform) — append guarded shim

**No in-repo analog** — this file has never had an export statement (`.planning/codebase/CONVENTIONS.md`: "No exports/imports — Apps Script shares one global scope"). The shim is purely additive per RESEARCH.md Pattern 1. What follows is the **real current file structure** the planner needs to target precisely.

**Current file structure (full read, 278 lines, no shim yet):**
- Lines 1-5: file-header banner comment (`=====` rule + filename + one-line purpose) — required by `CONVENTIONS.md` for any new file, but `Core.gs` already has one; do not duplicate it, just append after the last function.
- Line 278 is the last line (`normalizarNombre`'s closing brace) — the shim must be appended **after line 278**, as a new trailing block, not interleaved.

**Exact target function signatures to export** (verified from direct read):
```javascript
// src/Core.gs:75   function mapearColumnas(headers) { ... }
// src/Core.gs:126  function determinarNivel(conoceNivelResp, nivelDeclaradoResp) { ... }
// src/Core.gs:149  function parsearHorarios(celda, idioma) { ... }
// src/Core.gs:184  function construirBuckets(inscripciones) { ... }
// src/Core.gs:266  function normalizarNombre(texto) { ... }
```

**The one non-obvious dependency the shim/tests must account for** (confirmed by direct read, matches RESEARCH.md's Pitfall 1):
```javascript
// src/Core.gs:149-166 — parsearHorarios(), the Logger.log() call on its
// unmatched-label branch (line 161):
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
```
Any test exercising the unmatched-horario branch requires `global.Logger = { log: () => {} }` set before `require('../src/Core.gs')`'s functions are invoked (RESEARCH.md Pattern 2) — confirmed this is the *only* Apps Script ambient global referenced anywhere in the 5 target functions or their helpers (`normalizarTexto`, `normalizarEmail`, `normalizarIdioma`, `normalizarNivel`, `primeraCeldaNoVacia`, `obtenerLabelHorario` — all read only `CONFIG`, never `Logger`/`SpreadsheetApp`/`MailApp`).

**Ambient-global `CONFIG` reads to stub** (confirmed, exact lines):
```javascript
// src/Core.gs:92-100 mapearColumnas() reads CONFIG.formCols.*
// src/Core.gs:134,137 determinarNivel() reads CONFIG.nivelPrincipiante / CONFIG.nivelPorEvaluar
// src/Core.gs:151 parsearHorarios() reads CONFIG.horariosPorIdioma
```

**Empty-value return convention** (must be preserved/asserted in characterization tests, per `CONVENTIONS.md` "Return values" rule):
```javascript
// src/Core.gs:150   if (!celda) return [];        // never null/undefined
// src/Core.gs:128   if (!respuesta) return '';     // never null/undefined
// src/Core.gs:139   return '';                     // fallthrough, no match
```

**Shim to append (from RESEARCH.md Pattern 1 — this is prescriptive, not extracted from existing code, since none exists):**
```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mapearColumnas,
    parsearHorarios,
    determinarNivel,
    normalizarNombre,
    construirBuckets
    // Claude's discretion (CONTEXT.md): optionally also export
    // normalizarTexto, normalizarNivel, normalizarIdioma,
    // primeraCeldaNoVacia, obtenerLabelHorario
  };
}
```

---

### `src/Config.gs` (config, transform/data-export) — append guarded shim

**No in-repo analog** — same reasoning as `Core.gs`. Full file already read (103 lines); the `CONFIG` object literal spans lines 11-103 (opening `const CONFIG = {` at line 11, closing `};` at line 103). The shim must be appended **after line 103**.

**Exact structure the shim wraps** (confirmed, this is the entire file's payload — a pure data literal, zero function calls, zero Apps Script service references inside it):
```javascript
// src/Config.gs:11-103
const CONFIG = {
  semestre: '1er Semestre 2026',
  umbralMinimo: 6,
  emailAvisos: ['idiomas@pucv.cl'],
  idiomas: ['Alemán', 'Francés', 'Inglés', 'Italiano'],
  niveles: ['A1.1', 'A1.2', ..., 'C1.2'],
  horariosPorIdioma: { 'Alemán': [...], 'Italiano': [...], 'Inglés': [...], '_default': [...] },
  nivelPrincipiante: 'A1.1',
  nivelPorEvaluar: 'Por evaluar (prueba de nivel)',
  hojas: { respuestas: '...', panorama: '...', estadoAvisos: '_Estado_Avisos' },
  formCols: { marcaTemporal: '...', ... },
  colores: { ... }
};
```

**Real catalog values the planner should pin per D-04** (exact, verified — do not paraphrase):
```javascript
// src/Config.gs:39-55 — the exact 3 languages with dedicated schedule entries,
// plus '_default' (used by 'Francés', which has NO dedicated key — line 37-38
// inline comment explicitly documents this):
horariosPorIdioma: {
  'Alemán': [
    { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 19:30)' },
    { id: 'MJ_1730', label: 'Martes y jueves (17:30 - 19:30)' }
  ],
  'Italiano': [
    { id: 'MJ_1730_UNICO', label: 'Martes y jueves (17:30 - 19:30) - Único horario disponible este semestre' }
  ],
  'Inglés': [
    { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 19:30)' },
    { id: 'VS_1730', label: 'Viernes (17:30 - 19:30) y sábado (10:00 - 12:00)' }
  ],
  '_default': [
    { id: 'LM_1730', label: 'Lunes y miércoles (17:30 - 19:30)' },
    { id: 'VS_1730', label: 'Viernes (17:30 - 19:30) y sábado (10:00 - 12:00)' }
  ]
}
```

**Shim to append (prescriptive per RESEARCH.md Pattern 1):**
```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG };
}
```

---

### `package.json` (config, new root file)

**No in-repo analog for this project** (`inscripciones_idiomas_pucv` has never had npm tooling — confirmed by `ls` at repo root: no `package.json` exists today). Two cross-repo sibling files exist under the root CLAUDE.md's Project Map, but **neither is a good structural match** — both are application build manifests with real dependency trees, not a zero-dependency test-only manifest:

```json
// PlanificadorClases/package.json (cross-repo, DO NOT copy scripts/deps — different purpose: Vite/React app)
{
  "name": "planificador-clases",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", ... },
  "dependencies": { "react": "^18.3.1", ... },
  "devDependencies": { "vite": "^5.4.1", ... }
}
```
```json
// PUCV2/package.json (cross-repo, DO NOT copy — TypeScript build manifest, has devDependencies)
{
  "name": "pucv2-english-refactor",
  "version": "5.1.0",
  "devDependencies": { "typescript": "^5.7.3", "@types/google-apps-script": "^1.0.98" },
  "scripts": { "build": "npx tsc -p src/tsconfig.json --outDir dist" }
}
```

**What to actually use:** the sole authoritative source is RESEARCH.md's "Code Examples" section (Standard Stack, D-01/D-02) — a zero-dependency manifest, `"private": true`, single `scripts.test` entry, no `dependencies`/`devDependencies`:
```json
{
  "name": "inscripciones-idiomas-pucv",
  "version": "1.1.0",
  "private": true,
  "description": "Panorama de Inscripciones - IDIOMAS PUCV (test harness only; production runs as copy-pasted .gs files in Apps Script)",
  "scripts": {
    "test": "node --test"
  }
}
```
(RESEARCH.md's Open Question #2 also recommends considering `"engines": { "node": ">=20" }` — planner's discretion.)

---

### `test/Core.test.js` (test, transform)

**No in-repo analog** (zero existing test files, confirmed by `.planning/codebase/TESTING.md` and by directory listing — no `test/` directory exists in this repo yet).

**Cross-repo precedent found, but mechanism differs — use only for naming/tone, not structure:** `PUCV2/src/TestInicioClases.ts` is a sibling PUCV Apps Script project's *GAS-editor-runnable* test file — it runs inside the live Apps Script "Run" button/Executions panel, not Node, and has no `require`/`module.exports`/`node:test`/`assert` at all:
```typescript
// PUCV2/src/TestInicioClases.ts:13-23 (cross-repo, DIFFERENT mechanism)
function testGetNivelesActivos(): void {
  try {
    const niveles = getNivelesActivos();
    Logger.log("testGetNivelesActivos: OK — Niveles activos: " + JSON.stringify(niveles));
    if (niveles.length === 0) {
      Logger.log("  WARN: Lista Final vacía o todos ya notificados. Verificar datos.");
    }
  } catch (e: any) {
    Logger.log("testGetNivelesActivos: FAIL — " + e.message);
  }
}
```
**Do not copy this pattern** — Phase 1's D-01 explicitly rejects any Apps-Script-executed test approach in favor of Node's `node:test`. The only value this precedent offers: it confirms the sibling-project convention of `testXxx` naming and explicit OK/FAIL/WARN log framing, which the planner may echo in `describe()`/`test()` title strings for consistency of tone (e.g. `test('parsearHorarios: unmatched horario label returns [] (silently dropped, logged not thrown)', ...)` already mirrors this OK/FAIL clarity, just via `assert` instead of `Logger.log`).

**Authoritative structure — use RESEARCH.md's Pattern 2 + Pattern 3 + Code Examples verbatim** (already empirically verified in this repo's real Node environment, v26.5.0):
```javascript
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

global.CONFIG = require('../src/Config.gs').CONFIG;
global.Logger = { log: () => {} };

const {
  mapearColumnas,
  parsearHorarios,
  determinarNivel,
  normalizarNombre,
  construirBuckets
} = require('../src/Core.gs');

describe('mapearColumnas', () => { /* ... */ });
describe('parsearHorarios', () => { /* ... includes unmatched-label + Francés->_default fallback */ });
describe('determinarNivel', () => { /* ... */ });
describe('normalizarNombre', () => { /* ... */ });
describe('construirBuckets', () => { /* ... assert count + emails Set + modalidades */ });
```

**Error handling / edge-case pattern to encode** (D-04, ROADMAP success criterion 2 — pin exact real values, confirmed against `src/Config.gs`):
```javascript
describe('parsearHorarios', () => {
  test('unmatched horario label returns [] (silently dropped, logged not thrown)', () => {
    const result = parsearHorarios('Un horario inventado que no calza', 'Alemán');
    assert.deepEqual(result, []);
  });

  test('Francés has no dedicated catalog entry — falls back to _default', () => {
    const result = parsearHorarios('Lunes y miércoles (17:30 - 19:30)', 'Francés');
    assert.deepEqual(result, ['LM_1730']);
  });
});
```

**Pitfall to encode a test around (`construirBuckets` returns `Set` values):**
```javascript
// src/Core.gs:197 — buckets[clave].emails is a Set, not an array.
// Use assert.deepEqual/deepStrictEqual directly (compares Set contents
// order-insensitively) — NEVER JSON.stringify() a bucket object for comparison
// (Set serializes to {} and silently discards the data under test).
```

---

### `README.md` (documentation) — add "🧪 Tests" section

**Exact analog: this file itself.** README.md already has a consistent section style the new section must match (verified, full file read, 95 lines):

**Heading style pattern** (emoji + Spanish title, `##` level, matches every existing section):
```markdown
## 🚀 Instalación          (line 33)
## ⚙️ Configuración clave (`Config.gs`)   (line 42)
## 📅 Cada semestre nuevo   (line 71)
## 🔧 Menú                  (line 79)
## 📞 Contacto               (line 88)
## 📄 Licencia                (line 92)
```
Per D-06, the new section should follow this exact convention: `## 🧪 Tests` (the 🧪 emoji is already used elsewhere in the project's own menu item "🧪 Enviar aviso de prueba", line 85 — reusing it for the new section keeps emoji vocabulary consistent within this repo).

**Content-block style to match** (fenced code blocks with inline comments, Spanish prose around them — e.g. the "⚙️ Configuración clave" section, lines 44-51):
```markdown
## ⚙️ Configuración clave (`Config.gs`)

\`\`\`javascript
umbralMinimo: 6,               // mínimo de interesados por (idioma, nivel, horario)
emailAvisos: ['idiomas@pucv.cl'],
...
\`\`\`
```
The new "🧪 Tests" section should follow this same shape: one short Spanish intro sentence, then a fenced ` ```bash ` block showing `npm test` / `node --test`, consistent with the "🚀 Instalación" section's numbered-step style (lines 33-40) if step-by-step framing is preferred instead.

**Placement:** insert as a new `##` section — natural location is immediately after "🔧 Menú" (line 79-86) and before "📞 Contacto" (line 88), keeping user-facing content (features, install, menu) before developer/maintainer-facing content (tests), or alternatively right after "🚀 Instalación" since both are setup-oriented. Planner's discretion per CONTEXT.md.

---

## Shared Patterns

### The guarded dual-runtime shim (applies to both `src/Core.gs` and `src/Config.gs`)
**Source:** RESEARCH.md Pattern 1 (empirically verified in this repo's real Node environment, not assumed) — no in-repo precedent exists, so this is authoritative rather than "extracted."
```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { /* ... */ };
}
```
**Apply to:** both modified source files, appended at the very end of each file, after all existing function/const declarations — never interleaved with existing code, to keep the diff purely additive and trivially revertible.

### Ambient-global stubbing (`CONFIG` + `Logger`)
**Source:** RESEARCH.md Pattern 2, cross-checked against the exact `CONFIG.*`/`Logger.log()` reference sites listed above in `src/Core.gs`.
**Apply to:** `test/Core.test.js` only — set `global.CONFIG` (from the real, required `Config.gs` export, per D-03 — never a synthetic fixture) and `global.Logger = { log: () => {} }` **before** requiring `Core.gs`.

### Return-value convention (`''`/`[]`/`{}`, never `null`/`undefined`)
**Source:** `.planning/codebase/CONVENTIONS.md` "Return values" section, cross-verified directly against `src/Core.gs:128,139,150`.
**Apply to:** every characterization test's edge-case assertions — assert the exact empty-value shape the function already returns, not an idealized one.

### Spanish-domain naming in test descriptions
**Source:** `.planning/codebase/CONVENTIONS.md` "Language Split" section — function/variable/domain-concept names stay Spanish; only Apps Script platform surface and the required lifecycle names stay English.
**Apply to:** `describe()`/`test()` title strings referencing domain concepts (e.g. keep `'parsearHorarios'`, `'idioma'`, `'nivel'`, `'horario'` as-is in test titles) — English is fine for generic test-prose framing ("returns []", "falls back to"), matching the mixed style already visible in RESEARCH.md's own Code Examples.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/Core.gs` shim block | utility | transform | First `module.exports` ever added to this repo — zero prior export syntax anywhere in `src/*.gs` (confirmed: `CONVENTIONS.md` "No exports/imports" rule, and direct read of all 278 lines shows no existing shim) |
| `src/Config.gs` shim block | config | transform | Same reason — first export in this file's history |
| `package.json` | config | n/a | First npm-touching file in this specific repo's history; the two cross-repo sibling `package.json` files found (`PlanificadorClases`, `PUCV2`) are structurally different (real dependency trees, build scripts) and must not be used as templates — RESEARCH.md's own Code Examples section is the correct source |
| `test/Core.test.js` | test | transform | Zero existing test files in this repo (`.planning/codebase/TESTING.md` confirms); the one cross-repo precedent found (`PUCV2/src/TestInicioClases.ts`) uses a fundamentally different mechanism (GAS-editor-runnable, `Logger.log` pass/fail, no `node:test`/`assert`/`require`) explicitly rejected by this phase's D-01 — relevant only for naming-tone inspiration, called out above |

## Metadata

**Analog search scope:** full repo root (`inscripciones_idiomas_pucv/`: `src/`, `README.md`, `.planning/codebase/*.md`); cross-repo sibling projects listed in the root `~/CLAUDE.md` Project Map (`PlanificadorClases`, `PUCV2`, `rendercv`, `smart-file-renamer` — checked for any `package.json`/test-file precedent via `find`/`ls`)
**Files scanned:** `src/Core.gs` (full, 278 lines), `src/Config.gs` (full, 103 lines), `README.md` (full, 95 lines), `.planning/codebase/CONVENTIONS.md` (full), `PlanificadorClases/package.json`, `PUCV2/package.json`, `PUCV2/src/TestInicioClases.ts` (full, 130 lines)
**Pattern extraction date:** 2026-07-25
