# Phase 1: Test Harness & Characterization Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 1-Test Harness & Characterization Tests
**Areas discussed:** Test runner, CONFIG source for tests, Test file organization, Where the how-to-run note lives

---

## Test Runner

| Option | Description | Selected |
|--------|-------------|----------|
| node:test | Zero dependencies, built into Node 18+, matches repo's current no-npm character | ✓ |
| Vitest | Nicer DX (watch mode, better diffs) but requires package.json + devDependency + config | |

**User's choice:** node:test (Recommended option)
**Notes:** None beyond the recommendation rationale.

| Option | Description | Selected |
|--------|-------------|----------|
| Add minimal package.json | `{ scripts: { test: "node --test" } }` — enables `npm test`, doesn't touch Apps Script deploy | ✓ |
| No package.json | Document raw `node --test test/` command; zero new files | |

**User's choice:** Add minimal package.json (Recommended option)
**Notes:** First npm-related file in the repo; confirmed to have no effect on the Apps Script copy-paste deploy workflow.

---

## CONFIG Source for Tests

| Option | Description | Selected |
|--------|-------------|----------|
| Require the real src/Config.gs | Add matching guarded shim to Config.gs, set global.CONFIG from it | ✓ |
| Synthetic test-fixture CONFIG | Hand-written minimal CONFIG object inside the test file | |

**User's choice:** Require the real src/Config.gs (Recommended option)
**Notes:** Confirmed via direct read of `src/Core.gs` that CONFIG is read as an ambient global (not passed as a parameter) by `mapearColumnas`, `determinarNivel`, `parsearHorarios`, `obtenerLabelHorario`, `normalizarIdioma`, `normalizarNivel` — this resolves the MEDIUM-confidence blocker flagged in STATE.md.

| Option | Description | Selected |
|--------|-------------|----------|
| Accept it — pin exact current values | Tests hardcode today's real label text/ids; catalog edits that break tests are a deliberate review signal | ✓ |
| Write defensively against catalog changes | Assert on structural properties instead of exact literal values | |

**User's choice:** Accept it — tests pin exact current values (Recommended option)
**Notes:** Mirrors how the real v1.1.0 bugs (wrong Alemán hours, missing Italiano, Inglés casing) were originally caught — by comparing exact values.

---

## Test File Organization

| Option | Description | Selected |
|--------|-------------|----------|
| One consolidated file | test/Core.test.js with a describe() block per function | ✓ |
| One file per function | 5 separate test files | |

**User's choice:** One consolidated file (Recommended option)
**Notes:** None beyond the recommendation rationale.

---

## Where the How-to-Run Note Lives

| Option | Description | Selected |
|--------|-------------|----------|
| New README.md section | Short "🧪 Tests" section alongside existing setup docs | ✓ |
| Dedicated TESTING.md | Standalone developer-facing doc | |
| Inline comment in test file | Minimal, lives next to the code | |

**User's choice:** New README.md section (Recommended option)
**Notes:** Distinct from the staff-facing menu/Panorama documentation that Phase 5 will add — this is for whoever does the semester-to-semester code handoff.

---

## Claude's Discretion

- Exact `describe()`/`it()` naming and internal test structure within `test/Core.test.js`.
- Whether internal helper functions (`normalizarTexto`, `normalizarNivel`, `normalizarIdioma`, `primeraCeldaNoVacia`, `obtenerLabelHorario`) get their own explicit exports vs. being exercised only indirectly.
- Exact guarded-shim syntax/placement in `Core.gs` and `Config.gs`.

## Deferred Ideas

None — discussion stayed within Phase 1's scope.
