---
phase: 01-test-harness-characterization-tests
verified: 2026-07-25T21:00:00Z
status: human_needed
score: 8/8 automated must-haves verified
overrides_applied: 0
human_verification:
  - test: "Paste src/Config.gs and src/Core.gs (including their trailing module.exports shim blocks) into the real Google Apps Script editor bound to the enrollment Sheet. Run onOpen() once (or reload the Sheet) and confirm the \"🎓 Inscripciones\" menu still appears with no execution error. Then run \"🔄 Recalcular Panorama\" once."
    expected: "No new error (in particular nothing referencing `module`), and the \"Panorama de Cursos\" sheet updates exactly as it did before this phase — identical menu/recalculation behavior to pre-phase production."
    why_human: "The guarded `if (typeof module !== 'undefined' && module.exports)` shim is asserted to be a no-op inside Apps Script V8 based on documented runtime characteristics (no `module` global exists there) and static code inspection, but this has not been executed inside a live Apps Script project by any agent in this session or a prior one — no such environment is reachable from an automated verifier. ROADMAP.md Success Criterion 3 explicitly requires this be confirmed in the real editor. Plan 01-02 Task 3 correctly deferred this as an end-of-phase `<human-check>` per `workflow.human_verify_mode=end-of-phase` rather than skipping it."
---

# Phase 1: Test Harness & Characterization Tests Verification Report

**Phase Goal:** The five pure `Core.gs` functions (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) have automated regression coverage of their current, real behavior — with zero changes to the copy-paste deploy workflow.
**Verified:** 2026-07-25T21:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm test` / `node --test` from repo root executes and passes tests for all 5 target functions | ✓ VERIFIED | Ran `npm test` directly: `17/17` pass, `0` fail, `0` skipped, 5 `describe()` suites (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`). Bare `node --test` (no path arg) confirmed to auto-discover the same 17 tests. |
| 2 | Characterization tests capture, as they behave today: unmatched horario -> `[]` (logged, not thrown); Francés falling back to `_default`; missing-header `mapearColumnas()` -> `-1` | ✓ VERIFIED | `test/Core.test.js:85-88` (`parsearHorarios('Un horario inventado...', 'Alemán')` -> `[]`, Logger stub present at line 31); `test/Core.test.js:90-93` (Francés -> `['LM_1730']`, matching real `CONFIG.horariosPorIdioma['_default'][0]` in `src/Config.gs:51-53`); `test/Core.test.js:45-50` (`mapearColumnas(['MARCA TEMPORAL','NOMBRES'])` -> `cols.email === -1`, `cols.idioma === -1`). All pinned against the exact real catalog values, not synthetic ones. |
| 3 | `Core.gs` still runs unmodified inside the Apps Script V8 editor — shim confirmed inert in production | ? UNCERTAIN (human-needed) | Statically confirmed: `git diff a0a5988^ a0a5988 -- src/Config.gs` and `git diff efeea1a^ efeea1a -- src/Core.gs` show purely additive trailing hunks — zero existing lines touched in either file. The `typeof module !== 'undefined'` guard is provably safe under JS semantics (no `ReferenceError` on an undeclared global via `typeof`). However, actual execution inside a live Apps Script V8 sandbox has not been performed by any agent — this requires a human with edit access to the bound Sheet/Apps Script project, per ROADMAP.md Success Criterion 3 and Plan 01-02 Task 3's deferred `<human-check>`. |
| 4 | Short README section documents how to run tests locally | ✓ VERIFIED | `README.md:88-98` — new `## 🧪 Tests` heading, positioned exactly between `## 🔧 Menú` (line 79) and `## 📞 Contacto` (line 100). Contains `npm test` code block, `engines.node >=20` note, and explicit statement that the `module.exports` shim is inert in the Apps Script editor. |
| 5 | Requiring `src/Config.gs` from Node returns the real `CONFIG` object with exact real catalog values intact | ✓ VERIFIED | `node -e "const {CONFIG} = require('./src/Config.gs'); process.exit(CONFIG && CONFIG.umbralMinimo === 6 && CONFIG.horariosPorIdioma['Alemán'] ? 0 : 1)"` exits 0. |
| 6 | Requiring `src/Core.gs` returns the 5 TEST-01 target functions as callable functions, plus internal helpers | ✓ VERIFIED | `src/Core.gs:287-300` exports `mapearColumnas, parsearHorarios, determinarNivel, normalizarNombre, construirBuckets, normalizarTexto, normalizarNivel, normalizarIdioma, primeraCeldaNoVacia, obtenerLabelHorario` (10 identifiers). `node -e` check confirms `typeof c.mapearColumnas === 'function'` etc. exits 0. |
| 7 | `src/Config.gs` and `src/Core.gs` are byte-for-byte unchanged except for one additive, guarded `module.exports` block appended at the end of each | ✓ VERIFIED | `git diff` on both commits (`a0a5988`, `efeea1a`) shows exclusively `+` lines appended after each file's prior last line; zero `-` lines. |
| 8 | A root `package.json` exists with a working `test` script wired to `node --test`, zero dependencies | ✓ VERIFIED | `package.json` at repo root: `scripts.test: "node --test"`, no `dependencies`/`devDependencies` keys present. `node -e` check confirms this and exits 0. |

**Score:** 8/8 automated must-haves verified. 1 additional must-have (production-inertness confirmation) requires human execution in a real Apps Script editor and cannot be closed by an automated verifier — surfaced below, not counted as a failure.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/Config.gs` | Guarded shim exporting real `CONFIG` | ✓ VERIFIED | Lines 105-112, additive-only, exports `{ CONFIG }`. |
| `src/Core.gs` | Guarded shim exporting 5 target functions + 5 helpers | ✓ VERIFIED | Lines 279-301, additive-only, exports 10 identifiers. |
| `package.json` | `npm test` entrypoint, zero deps | ✓ VERIFIED | Root file, `scripts.test: "node --test"`, `engines.node: ">=20"`, no dependency keys. |
| `test/Core.test.js` | 5 `describe()` blocks characterizing real behavior | ✓ VERIFIED | 196 lines, exactly 5 `describe()` blocks, 17 `test()` cases, all passing. |
| `README.md` | New "🧪 Tests" section | ✓ VERIFIED | Lines 88-98, correctly placed, documents `npm test`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `package.json scripts.test` | `node --test` CLI | `npm test` | ✓ WIRED | `npm test` invocation confirmed to run and pass 17/17 tests. |
| `test/Core.test.js` | `src/Config.gs` | `global.CONFIG = require('../src/Config.gs').CONFIG` (set before invocation) | ✓ WIRED | `test/Core.test.js:26`; confirmed pinned values (e.g. `nivelPrincipiante`, `nivelPorEvaluar`) match `src/Config.gs`. |
| `test/Core.test.js` | `src/Core.gs` | `require('../src/Core.gs')` destructuring 5 target functions | ✓ WIRED | `test/Core.test.js:36-42`; all 5 functions invoked and asserted across the suite. |
| `test/Core.test.js` Logger stub | `parsearHorarios()` unmatched-label branch (`src/Core.gs:161`) | `global.Logger = { log: () => {} }` set before require | ✓ WIRED | `test/Core.test.js:31`; the unmatched-horario test (line 85-88) passes without throwing, confirming the stub is load-bearing (also independently confirmed by the plan's own acceptance-criteria removal test, per SUMMARY.md). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npm test` | 17 pass, 0 fail, 0 skip | ✓ PASS |
| Bare `node --test` auto-discovery works | `node --test` | Same 17/17 pass | ✓ PASS |
| Config shim returns real catalog | `node -e "require('./src/Config.gs').CONFIG.umbralMinimo === 6"` | exit 0 | ✓ PASS |
| Core shim exports target functions + package.json test script wired | `node -e "..."` (per Plan 01 Task 2 acceptance criteria) | exit 0 | ✓ PASS |
| Additive-only diff on both shimmed files | `git diff <commit>^..<commit> -- src/Config.gs src/Core.gs` | Only `+` lines at file end, zero `-` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| TEST-01 | 01-01-PLAN.md, 01-02-PLAN.md | Automated unit tests cover the 5 pure `Core.gs` functions via a guarded `module.exports` shim + `node:test`, no `clasp`, no deploy workflow changes | ✓ SATISFIED | 17/17 tests pass covering all 5 functions; shim is additive-only; zero third-party dependencies; `package.json`/`test/` do not alter the `src/` copy-paste deploy artifact's behavior. Production-inertness itself is pending human confirmation (see Human Verification below) but does not block requirement satisfaction at the code level — the shim's design provably meets the requirement's "inert" criterion by static analysis. |

No orphaned requirements: REQUIREMENTS.md maps only TEST-01 to Phase 1 (`.planning/REQUIREMENTS.md:68`), and both plans declare `requirements: [TEST-01]` — full match, nothing unaccounted for.

### Anti-Patterns Found

None. Scanned `src/Config.gs`, `src/Core.gs`, `test/Core.test.js`, `README.md`, `package.json` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and empty-implementation patterns — the only match was the substring "TODO" inside the Spanish word "TODOS" in an existing (untouched) `src/Core.gs` comment, a false positive, not a debt marker.

Code review (`01-REVIEW.md`) independently found 0 critical, 1 warning (WR-01: `mapearColumnas`'s keyword-fallback branch not exercised by any test), 3 info-level notes. WR-01 is a real coverage gap but does not invalidate the characterization tests that do exist, and per this workflow's instructions, warnings are not treated as blocking on their own. It is noted here for visibility but does not change phase status.

### Human Verification Required

### 1. Confirm `module.exports` shim is inert inside the real Apps Script V8 editor

**Test:** Paste the current contents of `src/Config.gs` and `src/Core.gs` (including their trailing `module.exports` blocks) into the Google Apps Script editor bound to the enrollment Sheet — the same manual step README's "🚀 Instalación" already describes. Run `onOpen()` once (or reload the Sheet) and confirm the "🎓 Inscripciones" menu appears with no execution error. Then run "🔄 Recalcular Panorama" once.
**Expected:** No new error (specifically nothing referencing `module`), and the "Panorama de Cursos" sheet updates exactly as it did before this phase — identical menu/recalculation behavior to pre-phase production.
**Why human:** No live Apps Script V8 execution environment is reachable by an automated verifier. This is ROADMAP.md Phase 1 Success Criterion 3, explicitly deferred to end-of-phase human-check per `workflow.human_verify_mode=end-of-phase` (Plan 01-02 Task 3). Static/code-level evidence (additive-only diff, `typeof module` guard safety under JS semantics) strongly supports the shim being inert, but "confirmed" per the roadmap's own wording requires actual execution in the real editor.

### Gaps Summary

No gaps. All 8 automated must-haves (from both plan frontmatters, cross-referenced against ROADMAP.md's 4 success criteria) are verified directly against the codebase: `npm test` passes 17/17 real characterization tests covering all 3 roadmap-mandated edge cases, both shims are byte-for-byte additive-only, `package.json` is correctly configured with zero dependencies, and the README documents the test workflow in the correct location. TEST-01 is satisfied.

The single outstanding item is Success Criterion 3's live-editor confirmation, which by design cannot be closed by any automated agent and was correctly deferred as a human-check by the executor. This is not a code defect — it's an inherent limitation of verifying behavior inside Google's hosted Apps Script sandbox from a local environment.

---

*Verified: 2026-07-25T21:00:00Z*
*Verifier: Claude (gsd-verifier)*
