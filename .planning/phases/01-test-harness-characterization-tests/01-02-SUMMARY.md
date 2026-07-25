---
phase: 01-test-harness-characterization-tests
plan: 02
subsystem: testing
tags: [node-test, characterization-tests, apps-script, commonjs]

# Dependency graph
requires:
  - phase: 01-test-harness-characterization-tests (Plan 01)
    provides: Guarded module.exports shims on src/Config.gs (CONFIG) and src/Core.gs (5 target functions + 5 helpers), plus a working root package.json (npm test -> node --test)
provides:
  - test/Core.test.js — 5 describe() blocks (17 tests) characterizing mapearColumnas, parsearHorarios, determinarNivel, normalizarNombre, construirBuckets against the real, current CONFIG/Core.gs
  - README.md "🧪 Tests" section documenting npm test as the standard local regression check
affects: [Phase 2-5 (all rely on this suite as the regression net for future Core.gs-adjacent changes)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ambient-global test setup: global.CONFIG = require('../src/Config.gs').CONFIG and global.Logger = { log: () => {} } set before require('../src/Core.gs'), so bare CONFIG/Logger references inside Core.gs resolve correctly at call time"
    - "Characterization tests pin exact real catalog values (D-04) instead of idealized/computed-from-CONFIG expectations, so a future catalog edit that silently changes behavior is caught, not masked"
    - "assert.deepEqual/deepStrictEqual used directly on Set-containing objects (construirBuckets' emails field) — never JSON.stringify, which silently discards Set contents"

key-files:
  created:
    - test/Core.test.js
  modified:
    - README.md

key-decisions:
  - "Consolidated all 5 describe() blocks into one test/Core.test.js file (D-05) with a single setup/requires block, rather than 5 separate files"
  - "Positive-path mapearColumnas test added (real CONFIG.formCols headers -> all indices >= 0) alongside the two roadmap-mandated negative cases, to pin today's real header-matching behavior end-to-end"
  - "README '🧪 Tests' section placed between '🔧 Menú' and '📞 Contacto' per D-06 and PATTERNS.md's suggested placement"

patterns-established:
  - "Any future Core.gs-adjacent characterization/regression test follows the same ambient-global stubbing setup (CONFIG + Logger) established here"

requirements-completed: [TEST-01]

# Metrics
duration: 12min
completed: 2026-07-25
---

# Phase 01 Plan 02: Characterization Test Suite Summary

**test/Core.test.js — 17 passing node:test assertions across 5 describe() blocks characterizing mapearColumnas, parsearHorarios, determinarNivel, normalizarNombre, and construirBuckets against the real CONFIG/Core.gs, plus a new README "🧪 Tests" section documenting `npm test` as the standard regression check.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-25T20:21:12Z
- **Completed:** 2026-07-25T20:33:03Z
- **Tasks:** 3 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `test/Core.test.js` created with real `CONFIG` (never a synthetic fixture, per D-03) and a `Logger` stub set before `require('../src/Core.gs')`, confirmed empirically load-bearing (removing the stub reproduces `ReferenceError: Logger is not defined` on the unmatched-horario test)
- All 3 roadmap-mandated edge cases captured exactly as they behave today: unmatched/unparseable horario label -> `[]` (logged via stubbed `Logger.log`, not thrown), Francés falling back to the `_default` horario catalog entry, and missing/empty header match in `mapearColumnas()` returning `-1` (vs. `buscarTodos()`'s empty-array `[]` convention for `horarios`/`modalidad`)
- 17/17 tests pass via both `node --test test/Core.test.js` and `npm test` (bare `node --test` auto-discovery from repo root also confirmed to find and run the same 17 tests)
- `construirBuckets()`'s `Set`-valued `emails` field asserted directly via `assert.deepEqual` (never `JSON.stringify`), per RESEARCH.md Pitfall 3
- README.md now documents `npm test` as the standard local regression check in a new "🧪 Tests" section, additive-only, between "🔧 Menú" and "📞 Contacto"

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test/Core.test.js — setup, mapearColumnas, parsearHorarios** - `373726f` (test)
2. **Task 2: Extend test/Core.test.js — determinarNivel, normalizarNombre, construirBuckets** - `8441bc4` (test)
3. **Task 3: Document tests in README.md** - `9f52b31` (docs)

**Plan metadata:** commit pending (docs: complete plan)

## Files Created/Modified
- `test/Core.test.js` - New consolidated characterization suite: one setup block (real `CONFIG` + `Logger` stub) + 5 `describe()` blocks (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`), 17 tests total, all passing
- `README.md` - Added "🧪 Tests" section (between "🔧 Menú" and "📞 Contacto") documenting `npm test`, the `engines.node >=20` requirement, and confirming the `module.exports` shim's inertness inside the Apps Script editor

## Decisions Made
- One consolidated test file rather than per-function files (D-05), avoiding duplicated `require()`/`global.CONFIG` setup boilerplate
- Added a third `mapearColumnas` test (positive-path, real headers -> all indices >= 0) beyond the plan's two mandated negative cases, to pin today's real header-matching behavior end-to-end — no behavior change, additional coverage only
- Reworded one setup comment (from "the rest of describe() blocks" to phrasing that doesn't contain the literal substring `describe(`) so the acceptance criterion's `grep -c "describe(" test/Core.test.js` returns exactly 5, matching only actual `describe()` calls rather than also matching a comment that mentioned the word

## Deviations from Plan

None - plan executed exactly as written. The one wording adjustment noted above under "Decisions Made" was a self-correction made before committing (to satisfy the plan's own acceptance criterion), not a deviation from scope or behavior.

## TDD Gate Compliance

Tasks 1 and 2 were marked `tdd="true"` in the plan, but this plan's purpose is characterization testing of already-implemented, stable production code (`src/Core.gs`'s 5 target functions), not adding new behavior. There is no RED phase in the classic sense — the functions under test already exist and already behave as asserted, so a "failing test first" step would either be impossible (the behavior already exists) or artificial (temporarily breaking working production code just to watch a test fail, then reverting). Per the plan's own `<verify>`/`<acceptance_criteria>` blocks (which only check for a final passing state, not a RED->GREEN commit sequence), both tasks were committed as single `test(...)` commits once the full describe() block for that task passed. This is consistent with `tdd_execution`'s guidance for characterization tests (RESEARCH.md Pattern 3) and does not indicate a skipped safety gate — there was no new implementation to gate.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. `npm test` runs entirely against Node's built-in `node:test`/`node:assert` modules against the already-shimmed `src/Config.gs`/`src/Core.gs` from Plan 01.

## Next Phase Readiness

`test/Core.test.js` is now the standing regression net for `Core.gs`'s 5 pure functions — Phase 2 (`Alertas.gs` critical-section hardening) can rely on `npm test` staying green as a signal that no `Core.gs`-adjacent refactor has silently changed the characterized behavior.

**One remaining item before Phase 1 is fully closed:** the end-of-phase human-check deferred per `workflow.human_verify_mode=end-of-phase` (Task 3) — pasting the current `src/Core.gs`/`src/Config.gs` (including their trailing `module.exports` shims) into the real Google Apps Script editor bound to the enrollment Sheet, running `onOpen()` once, and confirming "🔄 Recalcular Panorama" still completes without error. This closes ROADMAP.md Phase 1 Success Criterion 3 and is intentionally NOT performed by this executor (it requires a real Google Sheet/Apps Script editor session, which is outside this agent's reach) — it should be run by the user, or explicitly surfaced as a checkpoint by the phase-level orchestrator, before Phase 1 is marked fully complete.

---
*Phase: 01-test-harness-characterization-tests*
*Completed: 2026-07-25*

## Self-Check: PASSED

- FOUND: test/Core.test.js
- FOUND: README.md
- FOUND: .planning/phases/01-test-harness-characterization-tests/01-02-SUMMARY.md
- FOUND: commit 373726f
- FOUND: commit 8441bc4
- FOUND: commit 9f52b31
