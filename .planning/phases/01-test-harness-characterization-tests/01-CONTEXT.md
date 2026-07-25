# Phase 1: Test Harness & Characterization Tests - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a Node-based automated test harness for the five pure data-transformation functions in `src/Core.gs` (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`), with characterization tests that capture their *current, real* behavior before any refactor in later phases — with zero impact on the copy-paste Apps Script deploy workflow. This is the regression net every later hardening phase (2-5) depends on. No production code behavior changes in this phase; it is test infrastructure only.

</domain>

<decisions>
## Implementation Decisions

### Test Runner
- **D-01:** Use Node's built-in `node:test` module, not Vitest. Rationale: zero new dependencies, matches this repo's current "no npm project, no build system" character most closely — this milestone is hardening/readability, not tooling adoption.
- **D-02:** Add a minimal `package.json` at the repo root with `{ "scripts": { "test": "node --test" } }` (plus name/version) so `npm test` works. This is the first npm-related file the repo will have; it has no effect on the Apps Script copy-paste deploy workflow (Apps Script never reads `package.json`).

### CONFIG Fixture Strategy
- **D-03:** Tests require the **real** `src/Config.gs`, not a synthetic fixture. This means `Config.gs` needs the same guarded `module.exports` shim pattern already decided (in a prior Key Decision) for `Core.gs`'s pure functions. The test file sets `global.CONFIG` from the required `Config.gs` export before `require()`-ing `Core.gs`, since the 5 target functions read `CONFIG` as an ambient global (confirmed directly in `src/Core.gs` — e.g. `parsearHorarios()` reads `CONFIG.horariosPorIdioma`, `determinarNivel()` reads `CONFIG.nivelPrincipiante`/`CONFIG.nivelPorEvaluar`, `mapearColumnas()` reads `CONFIG.formCols`). This resolves the MEDIUM-confidence blocker flagged in STATE.md.
- **D-04:** Tests pin exact current real values from the live catalog (label text, ids, thresholds) rather than asserting only structural properties. If a future semester's catalog edit breaks a test, that's treated as an intentional signal to review — not friction to engineer around. This directly mirrors how the real v1.1.0 production bugs (wrong Alemán hours, missing Italiano entry, Inglés casing mismatch) were caught: by comparing exact expected values against real data.

### Test File Organization
- **D-05:** One consolidated test file, `test/Core.test.js`, with one `describe()` block per function (5 blocks total) rather than 5 separate files. Matches the existing one-file-per-concern convention (`Core.gs` owns all 5 functions) and avoids duplicating `require()`/`global.CONFIG` setup boilerplate across files.

### Test Documentation
- **D-06:** The "how to run tests locally" note goes in a new short section of `README.md` (e.g. "🧪 Tests"), alongside the existing install/setup sections — not a separate `TESTING.md`, not just an inline code comment. This is developer/maintainer-facing content (whoever does the semester-to-semester code handoff), distinct from the staff-facing menu/Panorama documentation that Phase 5 will add.

### Claude's Discretion
- Exact `describe()`/`it()` naming and internal test structure within `test/Core.test.js`.
- Whether helper functions the 5 target functions internally depend on (`normalizarTexto`, `normalizarNivel`, `normalizarIdioma`, `primeraCeldaNoVacia`, `obtenerLabelHorario`) need their own explicit exports from the guarded shim, versus being exercised only indirectly through the 5 named functions — a planning-time implementation detail, not a user-facing decision.
- Exact shim syntax/placement at the bottom of `Core.gs` and `Config.gs` (must remain inert under the Apps Script V8 runtime — no `module` global exists there).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Codebase maps (generated 2026-07-25)
- `.planning/codebase/TESTING.md` — confirms zero existing automated tests; documents the project's only current verification method (manual menu-driven runs, `probarAviso()`, `Logger.log()` diagnostics)
- `.planning/codebase/CONVENTIONS.md` — file/function naming conventions (`verboSustantivo()` Spanish camelCase), comment style, module/global-scope rules that new test files and the shim must respect
- `.planning/codebase/CONCERNS.md` — "Test Coverage Gaps" section explicitly flags `src/Core.gs`'s data-transformation functions as High priority and untested; "Known Bugs" section documents the exact v1.1.0-era bugs (Alemán hours, Italiano missing, Inglés casing) these characterization tests should be able to detect

### Project-level
- `.planning/PROJECT.md` Key Decisions table — locks in "no `clasp` adoption" and "guarded `module.exports` shim + Vitest/`node:test`" as the pre-existing architectural decision this phase implements
- `.planning/REQUIREMENTS.md` TEST-01 — exact scope: the 5 named functions, no more, no less
- `.planning/ROADMAP.md` Phase 1 section — the 4 success criteria this phase must satisfy

### Source files this phase touches
- `src/Core.gs` — the 5 target functions; confirmed to read `CONFIG` as an ambient global, not a parameter (see D-03)
- `src/Config.gs` — will need the same guarded `module.exports` shim as `Core.gs` so tests can require the real catalog (see D-03)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is the first test infrastructure in the repo. Nothing to reuse; this phase creates the pattern later phases' tests (if any) would follow.

### Established Patterns
- **Ambient global CONFIG:** every pure function in `Core.gs` reads `CONFIG.*` directly rather than receiving it as a parameter (verified by reading `src/Core.gs` line-by-line: `mapearColumnas`, `determinarNivel`, `parsearHorarios`, `obtenerLabelHorario`, `normalizarIdioma`, `normalizarNivel` all reference `CONFIG`). Test setup must replicate this via `global.CONFIG = require(...)` before requiring `Core.gs`.
- **No exports/imports convention** (`CONVENTIONS.md`): the guarded shim must be additive-only (an `if (typeof module !== 'undefined') module.exports = {...}` block) so it stays inert in the Apps Script V8 runtime, which has no `module` global.
- **Return-value convention:** functions return `''`, `[]`, or `{}` for empty/absent results, never `null`/`undefined` — characterization tests should assert on these exact empty-value conventions for edge cases (e.g. unmatched horario → `parsearHorarios()` returns `[]`, not `undefined`).

### Integration Points
- `test/Core.test.js` will `require('../src/Core.gs')` and `require('../src/Config.gs')` (after both get the guarded shim) — no other source files need touching this phase.
- New root-level `package.json` — first npm-related file in the repo; no interaction with the Apps Script deploy workflow.

</code_context>

<specifics>
## Specific Ideas

- Characterization tests must specifically cover, per ROADMAP.md success criterion 2: an unmatched/unparseable horario label (should produce `[]` from `parsearHorarios()`, logged not thrown), Francés falling back to the `_default` horario catalog entry (since `CONFIG.horariosPorIdioma` has no dedicated `'Francés'` key), and an empty/missing header match in `mapearColumnas()`.
- The v1.1.0 production bugs documented in `CHANGELOG.md` and `.planning/codebase/CONCERNS.md` (wrong Alemán hours, missing Italiano entry, Inglés falling into `_default` with casing mismatch) are exactly the class of regression this harness exists to catch going forward — tests pinning exact real catalog values (D-04) is what makes that possible.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1's scope (test harness only, no production code changes).

### Reviewed Todos (not folded)
None — `gsd-tools list-todos` returned zero pending todos to cross-reference against this phase.

</deferred>

---

*Phase: 1-Test Harness & Characterization Tests*
*Context gathered: 2026-07-25*
