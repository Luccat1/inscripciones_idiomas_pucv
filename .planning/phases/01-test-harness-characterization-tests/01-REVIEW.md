---
phase: 01-test-harness-characterization-tests
reviewed: 2026-07-25T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/Config.gs
  - src/Core.gs
  - package.json
  - test/Core.test.js
  - README.md
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-25
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This phase adds the repo's first Node test harness on top of a pure Google Apps Script (GAS) V8 project: an additive-only `module.exports` shim appended to `src/Config.gs` and `src/Core.gs`, a new zero-dependency `package.json` (`node --test`), 17 characterization tests in `test/Core.test.js`, and a new "🧪 Tests" section in `README.md`.

Verified directly (not just read):
- `git diff a0a598881fe8bc4952c0136a5e164b561678719b^ -- src/Config.gs src/Core.gs` confirms the diff is **pure appended-lines-only** in both files — no pre-existing line was touched, reordered, or reformatted.
- The guard `if (typeof module !== 'undefined' && module.exports) { ... }` is provably inert under the Apps Script V8 sandbox: that runtime has no CommonJS loader and never defines a global `module`, so `typeof module` evaluates to `'undefined'` and the block short-circuits without ever dereferencing `module.exports` (no `ReferenceError` risk either, since `typeof` on an undeclared identifier is safe in both non-strict and strict JS).
- `npm test` passes 17/17 with no failures, no skips.

The 5 target functions (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) are tested against the **real** `CONFIG` object from `src/Config.gs` (not a synthetic fixture), and manual trace-through of each assertion confirms the expected values match actual current runtime behavior (including known quirks like `'Francés'` falling through to `CONFIG.horariosPorIdioma['_default']`). No idealized/aspirational assertions were found among the 17 tests.

One meaningful coverage gap was found in the `mapearColumnas` test group (see WR-01) relevant to the phase's own stated goal of pinning "real behavior" for a function directly implicated in historical bugs. A few minor Info-level items round out the review — none block this phase.

## Warnings

### WR-01: `mapearColumnas`'s keyword-fallback branch is never exercised by any test

**File:** `test/Core.test.js:44-82` (production code: `src/Core.gs:76-80`)
**Issue:** `buscarUno()` has two branches: (1) exact-header-text match via `headers.indexOf(...)`, and (2) a keyword-substring fallback via `headers.findIndex(h => keywords.some(k => h.includes(k)))`, used when the Form's literal question text has drifted from `CONFIG.formCols`. This fallback is the entire reason `buscarUno` exists instead of a plain `indexOf` — it's the resilience mechanism the header-drift docstring in `Config.gs:70-79` describes.

All three `mapearColumnas` tests in `test/Core.test.js` only exercise branch (1): either an exact match succeeds (test 3, using `CONFIG.formCols.*` verbatim) or nothing matches at all and `-1`/`[]` is returned (tests 1-2, headers containing no keyword substring either — `'MARCA TEMPORAL'` and `'NOMBRES'` don't contain `'DIRECCIÓN DE CORREO'`, `'CORREO'`, `'EMAIL'`, or `'IDIOMA'`). No test supplies a header that fails the exact match but succeeds the keyword fallback (e.g. `'CORREO ELECTRONICO INSTITUCIONAL'` for the email column, or `'IDIOMA DE INTERES'` for idioma). Given the stated purpose of this suite — pinning real behavior of the functions responsible for the v1.1.0 bugs, per the new README "🧪 Tests" section — this is a gap in the regression net for a genuinely load-bearing code path, not a stylistic nitpick.

**Fix:** Add a test case exercising the fallback, e.g.:
```javascript
test('encabezado que no calza exacto pero contiene keyword -> match por fallback', () => {
  const headers = ['MARCA TEMPORAL', 'NOMBRES', 'APELLIDOS', 'CORREO ELECTRONICO INSTITUCIONAL', 'IDIOMA DE INTERES'];
  const cols = mapearColumnas(headers);
  assert.equal(cols.email, 3);  // no exact match on CONFIG.formCols.email, falls back to 'CORREO' keyword
  assert.equal(cols.idioma, 4); // no exact match, falls back to 'IDIOMA' keyword
});
```

## Info

### IN-01: 5 of 10 exported `Core.gs` functions are exported but never asserted against in this phase's test file

**File:** `src/Core.gs:288-299`, `test/Core.test.js:36-42`
**Issue:** The export shim in `Core.gs` exposes 10 functions (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`, `normalizarTexto`, `normalizarNivel`, `normalizarIdioma`, `primeraCeldaNoVacia`, `obtenerLabelHorario`), but `test/Core.test.js` only destructures and tests the first 5. The comment at `Core.gs:280-286` explains this is intentional ("permitir aserciones directas sin forzar toda cobertura a pasar por 2 niveles de indirección" — future-proofing for tests on helper functions). This is consistent with stated intent, not a defect, but flagging since 5 of 10 exports are currently dead weight from the test suite's perspective — worth confirming a follow-up phase actually uses them, otherwise they're unused surface area on the export shim.
**Fix:** No action needed now; if a future phase doesn't end up testing `normalizarTexto`/`normalizarNivel`/`normalizarIdioma`/`primeraCeldaNoVacia`/`obtenerLabelHorario` directly, consider trimming the export list to match what's actually tested.

### IN-02: `.gitignore` does not exclude `node_modules/`

**File:** `.gitignore` (not modified by this phase, but now newly relevant given `package.json`'s introduction)
**Issue:** The project's `.gitignore` covers OS files, editor swap files, and `.clasp.json`, but has no `node_modules/` entry. `package.json` currently declares zero dependencies so this is low-risk today, but the moment any contributor runs `npm install <pkg>` for a future test utility, `node_modules/` risks being committed accidentally since nothing blocks it.
**Fix:**
```gitignore
# Node
node_modules/
```

### IN-03: Global-mutation test setup (`global.CONFIG`, `global.Logger`) is a fragile pattern if the suite grows

**File:** `test/Core.test.js:26,31`
**Issue:** The test file works around `Core.gs`'s reliance on ambient globals (`CONFIG`, `Logger`) — an accurate consequence of GAS's flat global-scope execution model — by assigning directly onto Node's `global` object before requiring `Core.gs`. This is correct and necessary for a faithful characterization test today, and Node's `--test` runner isolates each test file in its own process by default so no cross-file pollution currently occurs with a single test file. Flagging only because this pattern doesn't scale cleanly: if a second test file (e.g. `test/Panorama.test.js` or `test/Alertas.test.js`) is added in a later phase and also needs a different `CONFIG` shape (e.g. to test threshold-crossing edge cases with a smaller `umbralMinimo`), both files mutating the same `global.CONFIG` name requires care to avoid confusion, even under process isolation.
**Fix:** No action needed for this phase. When a second test file is added, consider a shared test-helper module (`test/helpers/setupGlobals.js`) that documents this pattern once rather than duplicating the `global.CONFIG =` / `global.Logger =` boilerplate per file.

---

_Reviewed: 2026-07-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
