---
phase: 01-test-harness-characterization-tests
plan: 01
subsystem: testing
tags: [node-test, module-exports, apps-script, commonjs, package-json]

# Dependency graph
requires: []
provides:
  - Guarded dual-runtime `module.exports` shim on `src/Config.gs` (exports the real `CONFIG` object)
  - Guarded dual-runtime `module.exports` shim on `src/Core.gs` (exports the 5 TEST-01 target functions plus 5 internal helpers)
  - Root `package.json` with a working `npm test` (`node --test`) entrypoint and zero dependencies
affects: [01-test-harness-characterization-tests (Plan 02)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarded dual-runtime module.exports shim: `if (typeof module !== 'undefined' && module.exports) { module.exports = {...} }` appended at the end of a `.gs` file — active under Node's CJS loader, inert under Apps Script V8 (no `module` global there)"

key-files:
  created:
    - package.json
  modified:
    - src/Config.gs
    - src/Core.gs

key-decisions:
  - "Exported the 5 internal helpers (normalizarTexto, normalizarNivel, normalizarIdioma, primeraCeldaNoVacia, obtenerLabelHorario) alongside the 5 TEST-01 target functions, per RESEARCH.md's resolved Open Question #1 — gives Plan 02 the option of direct helper-level assertions"
  - "Added engines.node >=20 to package.json per RESEARCH.md's resolved Open Question #2, since node:test is stable from Node 20 and this repo has no other Node-version pin"

patterns-established:
  - "Node dev-tooling additions to production .gs files must use the guarded module.exports shim, appended strictly after all existing code, never interleaved"

requirements-completed: [TEST-01]

# Metrics
duration: 1min
completed: 2026-07-25
---

# Phase 01 Plan 01: Test Harness Shim Foundation Summary

**Guarded `module.exports` shims added to `src/Config.gs` and `src/Core.gs`, plus a zero-dependency root `package.json` wiring `npm test` to `node --test` — the interface Plan 02's characterization tests will require.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-07-25T20:16:00Z
- **Completed:** 2026-07-25T20:17:14Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- `src/Config.gs` now exports the real `CONFIG` object to Node via a guarded, additive-only shim — `require('./src/Config.gs').CONFIG.umbralMinimo === 6` confirmed against the live catalog, not a synthetic fixture
- `src/Core.gs` now exports the 5 TEST-01 target functions (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) plus their 5 internal helpers (`normalizarTexto`, `normalizarNivel`, `normalizarIdioma`, `primeraCeldaNoVacia`, `obtenerLabelHorario`)
- Root `package.json` created with `scripts.test: "node --test"`, `engines.node: ">=20"`, zero `dependencies`/`devDependencies` — `npm test` is now a working command for the first time in this repo's history

## Task Commits

Each task was committed atomically:

1. **Task 1: Append guarded module.exports shim to src/Config.gs** - `a0a5988` (feat)
2. **Task 2: Append guarded module.exports shim to src/Core.gs and create root package.json** - `efeea1a` (feat)

_Note: Both tasks were straightforward additive shims with no TDD gate (plan type is `execute`, not `tdd`)._

## Files Created/Modified
- `src/Config.gs` - Appended a guarded `module.exports = { CONFIG }` block after the existing `CONFIG` object literal (line 103); lines 1-103 byte-for-byte unchanged
- `src/Core.gs` - Appended a guarded `module.exports` block exporting the 5 target functions + 5 helpers after `normalizarNombre`'s closing brace (line 278); lines 1-278 byte-for-byte unchanged
- `package.json` - New root manifest: `name`, `version` (matches CHANGELOG's 1.1.0), `private: true`, `description`, `scripts.test: "node --test"`, `engines.node: ">=20"`, no dependencies

## Decisions Made
- Exported the 5 internal helper functions alongside the 5 named target functions (RESEARCH.md Open Question #1, resolved: "export them too")
- Pinned `engines.node: ">=20"` since `node:test` is stable only from Node 20 onward and this is the repo's first Node-version signal anywhere (RESEARCH.md Open Question #2, resolved)

## Deviations from Plan

None - plan executed exactly as written. Both shims were appended in the exact locations specified in the plan's `<interfaces>` block (after `src/Config.gs` line 103, after `src/Core.gs` line 278), and `package.json` matches the plan's Task 2 `<action>` spec field-for-field.

One acceptance-criteria phrasing note (not a deviation, no fix needed): the plan's acceptance criteria for both tasks state `grep -c 'module.exports' ... equals 1`. The actual guarded-shim pattern (prescribed verbatim by RESEARCH.md Pattern 1 and PATTERNS.md) contains the literal string `module.exports` twice per file — once in the `if (typeof module !== 'undefined' && module.exports)` guard condition and once in the `module.exports = {...}` assignment — so `grep -c` correctly returns 2 for each file. This reflects exactly one export *block* (the intent of the acceptance criteria), not one text match of the string. All functional `node -e` verification commands in both tasks' `<acceptance_criteria>` and `<verify>` sections passed with exit code 0.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. `npm test` runs entirely against Node's built-in `node:test`/`node:assert` modules; no `npm install` step is needed since zero dependencies are declared.

## Next Phase Readiness
`src/Config.gs`, `src/Core.gs`, and `package.json` now expose exactly the interface Plan 02 (`test/Core.test.js` + README "🧪 Tests" section) needs: a requirable real `CONFIG`, the 5 target functions + 5 helpers as callable exports, and a working `npm test` command. No blockers for Plan 02.

---
*Phase: 01-test-harness-characterization-tests*
*Completed: 2026-07-25*

## Self-Check: PASSED

- FOUND: src/Config.gs
- FOUND: src/Core.gs
- FOUND: package.json
- FOUND: commit a0a5988
- FOUND: commit efeea1a
