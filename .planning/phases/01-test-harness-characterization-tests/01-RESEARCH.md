# Phase 1: Test Harness & Characterization Tests - Research

**Researched:** 2026-07-25
**Domain:** Node.js built-in test runner (`node:test`) applied to a Google Apps Script V8 codebase via a guarded `module.exports` shim
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use Node's built-in `node:test` module, not Vitest. Rationale: zero new dependencies, matches this repo's current "no npm project, no build system" character most closely — this milestone is hardening/readability, not tooling adoption.
- **D-02:** Add a minimal `package.json` at the repo root with `{ "scripts": { "test": "node --test" } }` (plus name/version) so `npm test` works. This is the first npm-related file the repo will have; it has no effect on the Apps Script copy-paste deploy workflow (Apps Script never reads `package.json`).
- **D-03:** Tests require the **real** `src/Config.gs`, not a synthetic fixture. This means `Config.gs` needs the same guarded `module.exports` shim pattern already decided (in a prior Key Decision) for `Core.gs`'s pure functions. The test file sets `global.CONFIG` from the required `Config.gs` export before `require()`-ing `Core.gs`, since the 5 target functions read `CONFIG` as an ambient global (confirmed directly in `src/Core.gs` — e.g. `parsearHorarios()` reads `CONFIG.horariosPorIdioma`, `determinarNivel()` reads `CONFIG.nivelPrincipiante`/`CONFIG.nivelPorEvaluar`, `mapearColumnas()` reads `CONFIG.formCols`). This resolves the MEDIUM-confidence blocker flagged in STATE.md.
- **D-04:** Tests pin exact current real values from the live catalog (label text, ids, thresholds) rather than asserting only structural properties. If a future semester's catalog edit breaks a test, that's treated as an intentional signal to review — not friction to engineer around. This directly mirrors how the real v1.1.0 production bugs (wrong Alemán hours, missing Italiano entry, Inglés casing mismatch) were caught: by comparing exact expected values against real data.
- **D-05:** One consolidated test file, `test/Core.test.js`, with one `describe()` block per function (5 blocks total) rather than 5 separate files. Matches the existing one-file-per-concern convention (`Core.gs` owns all 5 functions) and avoids duplicating `require()`/`global.CONFIG` setup boilerplate across files.
- **D-06:** The "how to run tests locally" note goes in a new short section of `README.md` (e.g. "🧪 Tests"), alongside the existing install/setup sections — not a separate `TESTING.md`, not just an inline code comment. This is developer/maintainer-facing content (whoever does the semester-to-semester code handoff), distinct from the staff-facing menu/Panorama documentation that Phase 5 will add.

### Claude's Discretion

- Exact `describe()`/`it()` naming and internal test structure within `test/Core.test.js`.
- Whether helper functions the 5 target functions internally depend on (`normalizarTexto`, `normalizarNivel`, `normalizarIdioma`, `primeraCeldaNoVacia`, `obtenerLabelHorario`) need their own explicit exports from the guarded shim, versus being exercised only indirectly through the 5 named functions — a planning-time implementation detail, not a user-facing decision.
- Exact shim syntax/placement at the bottom of `Core.gs` and `Config.gs` (must remain inert under the Apps Script V8 runtime — no `module` global exists there).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1's scope (test harness only, no production code changes).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Automated unit tests cover the five pure data-transformation functions in `Core.gs` (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) using a guarded `module.exports` shim (inert under Apps Script V8) + `node:test` — no `clasp`, no deploy workflow changes | This research **empirically verifies, in this exact repo/Node environment** (not just from training knowledge): (a) the guarded shim pattern is functional under Node's CJS loader for a `.gs`-extension file and is a true no-op under Apps Script V8 (no `module` global there); (b) `global.CONFIG` ambient-global stubbing works for all `CONFIG.*` reads inside the 5 functions; (c) **`Logger` must ALSO be stubbed** — `parsearHorarios()`'s unmatched-horario branch calls `Logger.log(...)` (`src/Core.gs:161`), which is exactly the roadmap's mandated "unmatched horario label" edge case, and this call throws `ReferenceError` in Node unless `global.Logger` is stubbed (a gap not caught by CONTEXT.md's D-03, which only discusses `CONFIG`); (d) `node --test` requires zero configuration beyond a `test/` directory + `package.json`'s `scripts.test` entry to auto-discover and run `test/Core.test.js`. |
</phase_requirements>

## Summary

This phase is almost entirely de-risked by direct inspection of `src/Core.gs`/`src/Config.gs` and by empirical testing performed in this research session against the actual local Node environment (v26.5.0) rather than relying on stale training-data claims about Node's module system. Two mechanisms make the "guarded shim, zero build step" approach from `PROJECT.md`'s Key Decisions work exactly as promised:

1. **Node's CommonJS loader silently falls back to its `.js` handler for any file extension it doesn't recognize** (confirmed empirically: `require('../src/Core.gs')` from a `.js` test file loads and executes it as plain JavaScript, no registration needed). This is why a bare `if (typeof module !== 'undefined') module.exports = {...}` block at the bottom of a `.gs` file is sufficient — no renaming, no symlinking, no copy-into-`test/` step is needed. Tests can `require()` `src/Core.gs` and `src/Config.gs` **in place**.
2. **Bare identifier references (`CONFIG`, `Logger`) inside a required CommonJS module resolve through the Node global object** at *call time*, not at `require()` time — confirmed empirically that `global.CONFIG = {...}` and `global.Logger = { log() {} }` can be set either before or after `require()`, as long as they're set before the function that reads them is *invoked*. This is exactly the mechanism the ambient-global architecture of `Core.gs` needs, and it requires no dependency-injection refactor to the production code.

**The one gap this research closes that CONTEXT.md's D-03 did not fully cover:** `Core.gs`'s `parsearHorarios()` calls `Logger.log(...)` on its unmatched-horario-label path — the *exact* edge case the roadmap mandates as characterization test coverage. `Logger` is an Apps Script ambient global with no Node equivalent; without an explicit `global.Logger = { log: () => {} }` stub in the test setup (alongside the already-planned `global.CONFIG` stub), that specific characterization test would throw `ReferenceError: Logger is not defined` instead of exercising the real behavior. No other Apps Script global (`SpreadsheetApp`, `MailApp`, `HtmlService`, `ScriptApp`, `Utilities`) is referenced by any of the 5 target functions or their internal helpers (`normalizarTexto`, `normalizarEmail`, `normalizarIdioma`, `normalizarNivel`, `primeraCeldaNoVacia`, `obtenerLabelHorario`) — confirmed by direct line-by-line read of `src/Core.gs`.

**Primary recommendation:** Add the guarded shim to `src/Config.gs` and `src/Core.gs`, add a minimal zero-dependency root `package.json` (`scripts.test: "node --test"`), and write `test/Core.test.js` that (1) requires `../src/Config.gs` and sets `global.CONFIG` to its export, (2) sets `global.Logger = { log: () => {} }`, (3) requires `../src/Core.gs`, then (4) exercises the 5 functions in five `describe()` blocks, pinning exact real catalog values per D-04.

## Architectural Responsibility Map

This project has no browser/API/database tiers — it is a single container-bound Apps Script backend. The relevant "tiers" for this phase are: production runtime (Apps Script V8) vs. local dev tooling (Node), and this phase's job is to add a *test* tier without touching the production tier's boundary.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Executing characterization tests | Local dev tooling (Node CLI, `node --test`) | — | Tests run entirely on a developer's machine; never inside the Apps Script V8 sandbox, never as part of the copy-paste deploy |
| Dual-runtime `module.exports` shim | Source file (`src/Core.gs`, `src/Config.gs`) | Both Node (active) and Apps Script V8 (inert) | The shim must physically live in the same file that ships to production, since there is no build step to strip it — its only safety mechanism is the `typeof module !== 'undefined'` guard |
| Pure data-transformation logic under test | Core/backend logic (currently Apps Script-hosted, tested via Node in isolation) | — | The 5 target functions have zero `SpreadsheetApp`/`MailApp` I/O — confirmed by direct read — so they can be exercised as plain functions with no service mocking beyond the two ambient globals they do reference (`CONFIG`, and `Logger` inside one function) |
| Ambient-global stubbing (`CONFIG`, `Logger`) | Test setup (`test/Core.test.js`) | — | Must replicate the two ambient globals the functions actually read; done via `global.X = ...` assignment before invocation |
| "How to run tests" documentation | README.md (developer-facing) | — | Per D-06, distinct from staff-facing docs Phase 5 will add |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | Built into Node.js (bundled, no install) | Test runner: `test()`, `describe()`, lifecycle hooks | [VERIFIED: empirical run in this repo's environment, Node v26.5.0] Zero-dependency, matches D-01; stable (non-experimental) as of Node 20 [CITED: nodejs.org/api/test.html; cross-verified via WebSearch — Node.js Test Runner, Sonar blog] |
| `node:assert/strict` | Built into Node.js | Assertions (`equal`, `deepEqual`/`deepStrictEqual`, `throws`) | [VERIFIED: empirical test in this session] `deepEqual` from the `/strict` entry point is aliased to `deepStrictEqual` and compares `Set` contents directly (order-insensitive) — directly relevant since `construirBuckets()` returns buckets containing `emails: Set` |

### Supporting

None. Zero third-party packages are needed or recommended for this phase — this is the entire point of D-01/D-02.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:test` | Vitest | Rejected per D-01 — adds a `devDependency` + config file the "hardening not tooling adoption" milestone framing explicitly avoids |
| `node:test` | Jest / Mocha | Explicitly flagged as "do not introduce" in `.planning/codebase/TESTING.md` — heavier config surface, no benefit over the built-in runner for 5 pure functions |
| Guarded `module.exports` shim | `gas-local` / `@google/clasp` + Apps Script API mocking | Rejected in `PROJECT.md` Key Decisions and `.planning/codebase/CONCERNS.md` — the 5 target functions have zero `SpreadsheetApp`/`MailApp` dependency, so a full GAS-mocking layer is unnecessary complexity for functions that are already pure (aside from the one `Logger` call — see Common Pitfalls) |
| Requiring `src/Core.gs` in place | Copying/symlinking `Core.gs` into `test/` or renaming to `.js` | Unnecessary — [VERIFIED empirically] Node's CJS loader already handles the `.gs` extension via its unknown-extension fallback; adding a copy step would create exactly the drift risk (testing a stale copy, not the real file) this phase exists to prevent |

**Installation:**
```bash
# No installation needed — node:test and node:assert are Node.js built-ins.
# Only new file: a root package.json (see Code Examples) with zero dependencies.
```

**Version verification:** No npm packages are being installed this phase, so the standard `npm view <package> version` check does not apply. The relevant "version" to verify is the **Node.js runtime version** itself:
```bash
node --version   # confirmed locally: v26.5.0
npm --version    # confirmed locally: 11.17.0
```
`node:test`'s zero-config file/directory auto-discovery (bare `node --test` picking up `test/*.js` with no path argument) and glob support were confirmed via official docs cross-referenced with WebSearch; the test runner itself is documented as stable since Node 20, experimental in Node 18 [MEDIUM confidence — WebSearch cross-source, not independently re-verified against Node's own changelog in this session]. Since this repo has no `engines` field, `.nvmrc`, or CI, the actual minimum Node version any given maintainer's machine has is unverified — see Open Questions.

## Package Legitimacy Audit

**Not applicable this phase.** Zero external packages are installed — `node:test` and `node:assert` are Node.js built-ins (no entry in npm's registry, nothing to slopcheck). The new root `package.json` (D-02) will declare only `scripts.test`, with no `dependencies` or `devDependencies` field. The Package Legitimacy Gate protocol is skipped because there is nothing to check; this is stronger than "unavailable tooling" — it's structurally guaranteed by D-01's zero-dependency choice.

**Packages removed due to slopcheck verdict:** none (n/a — no packages proposed).
**Packages flagged as suspicious:** none (n/a — no packages proposed).

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────────┐
                     │  Developer machine (Node CLI, local)     │
                     │                                           │
  `npm test`  ──────▶│  node --test                             │
                     │       │                                  │
                     │       ▼                                  │
                     │  auto-discovers test/Core.test.js         │
                     │       │                                  │
                     │       ▼                                  │
                     │  1. require('../src/Config.gs')          │
                     │     → guarded shim exports { CONFIG }    │
                     │     → global.CONFIG = CONFIG (real data) │
                     │       │                                  │
                     │       ▼                                  │
                     │  2. global.Logger = { log: () => {} }    │
                     │     (stub — parsearHorarios() calls      │
                     │      Logger.log() on unmatched path)     │
                     │       │                                  │
                     │       ▼                                  │
                     │  3. require('../src/Core.gs')            │
                     │     → guarded shim exports the 5         │
                     │       target functions (+ optional       │
                     │       internal helpers)                  │
                     │       │                                  │
                     │       ▼                                  │
                     │  4. describe()/test() blocks call each   │
                     │     function with fixture + edge-case    │
                     │     inputs, assert against PINNED real   │
                     │     catalog values (D-04)                │
                     │       │                                  │
                     │       ▼                                  │
                     │  pass/fail report → exit code (CI-ready) │
                     └─────────────────────────────────────────┘

                     ┌─────────────────────────────────────────┐
                     │  Production runtime (Apps Script V8,     │
                     │  container-bound to the Sheet)           │
                     │                                           │
                     │  src/Core.gs, src/Config.gs pasted as-is │
                     │  into the editor. `typeof module` is     │
                     │  'undefined' here (no CJS module system) │
                     │  → the guarded shim block never executes │
                     │  → zero behavior change, zero perf cost  │
                     └─────────────────────────────────────────┘
```

### Recommended Project Structure
```
inscripciones_idiomas_pucv/
├── package.json          # NEW — { "scripts": { "test": "node --test" } }, zero deps
├── src/
│   ├── Config.gs         # + guarded module.exports shim appended at the bottom
│   ├── Core.gs           # + guarded module.exports shim appended at the bottom
│   ├── Panorama.gs       # untouched
│   ├── Alertas.gs        # untouched
│   └── Main.gs           # untouched
├── test/
│   └── Core.test.js      # NEW — the single consolidated test file (D-05)
└── README.md             # + new "🧪 Tests" section (D-06)
```

### Pattern 1: Guarded dual-runtime `module.exports` shim
**What:** An additive-only block appended at the bottom of a `.gs` file that exports functions for Node's `require()` while remaining a complete no-op under Apps Script V8 (which has no `module` global).
**When to use:** Any `.gs` file whose functions need Node-side test coverage without altering the copy-paste deploy artifact.
**Example:**
```javascript
// Source: empirically verified in this session (Node v26.5.0) — appended at
// the bottom of src/Core.gs, after all existing function declarations.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mapearColumnas,
    parsearHorarios,
    determinarNivel,
    normalizarNombre,
    construirBuckets
    // Claude's discretion (per CONTEXT.md): optionally also export
    // normalizarTexto, normalizarNivel, normalizarIdioma,
    // primeraCeldaNoVacia, obtenerLabelHorario for direct unit coverage.
  };
}
```
```javascript
// Source: same pattern, appended at the bottom of src/Config.gs.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG };
}
```

### Pattern 2: Ambient-global test setup (CONFIG + Logger stubbing)
**What:** Before `require()`-ing `Core.gs`, populate the two Node globals its functions read as bare identifiers.
**When to use:** Every test file that exercises any of the 5 target functions (or their internal helpers).
**Example:**
```javascript
// Source: test/Core.test.js — pattern empirically verified in this session.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// 1. Real CONFIG, not a synthetic fixture (D-03).
global.CONFIG = require('../src/Config.gs').CONFIG;

// 2. Stub Logger — parsearHorarios() calls Logger.log() on its
//    unmatched-horario-label path (src/Core.gs:161). Without this,
//    that exact roadmap-mandated edge case throws ReferenceError.
global.Logger = { log: () => {} };

// 3. Now safe to require — bare CONFIG/Logger references inside
//    Core.gs resolve through the globals set above at call time.
const {
  mapearColumnas,
  parsearHorarios,
  determinarNivel,
  normalizarNombre,
  construirBuckets
} = require('../src/Core.gs');
```

### Pattern 3: Characterization tests pinning real values, covering the 3 mandated edge cases
**What:** Tests that assert on the function's *actual current* output for real inputs, not on idealized/desired behavior.
**When to use:** All 5 `describe()` blocks in `test/Core.test.js`.
**Example:**
```javascript
// Source: constructed from direct read of src/Core.gs + src/Config.gs
// (real catalog values as of 2026-07-25) — verify these exact strings
// against Config.gs at implementation time (D-04: pin real values).
describe('parsearHorarios', () => {
  test('unmatched horario label returns [] (silently dropped, logged not thrown)', () => {
    const result = parsearHorarios('Un horario inventado que no calza', 'Alemán');
    assert.deepEqual(result, []);
  });

  test('Francés has no dedicated catalog entry — falls back to _default', () => {
    // CONFIG.horariosPorIdioma has no 'Francés' key (src/Config.gs:37-38,51-54);
    // the _default catalog's exact label text is pinned here per D-04.
    const result = parsearHorarios('Lunes y miércoles (17:30 - 19:30)', 'Francés');
    assert.deepEqual(result, ['LM_1730']);
  });
});

describe('mapearColumnas', () => {
  test('missing/empty header set returns -1 for email and idioma (no throw)', () => {
    const headers = ['MARCA TEMPORAL', 'NOMBRES']; // no email/idioma header
    const cols = mapearColumnas(headers);
    assert.equal(cols.email, -1);
    assert.equal(cols.idioma, -1);
  });
});
```

### Anti-Patterns to Avoid
- **Copying or symlinking `Core.gs`/`Config.gs` into `test/` to "make requiring easier":** Unnecessary (Node's CJS loader already handles the `.gs` extension in place — verified) and dangerous — a copy can silently drift from the real deployed file, defeating the entire purpose of a characterization-test regression net.
- **Building a synthetic/mock `CONFIG` fixture:** Explicitly rejected by D-03 — tests must exercise the real catalog so real-data bugs (the v1.1.0 class of bugs) are catchable.
- **Stubbing only `CONFIG` and forgetting `Logger`:** Will pass 4 of the 5 `describe()` blocks and throw `ReferenceError` the moment `parsearHorarios()`'s unmatched-label test runs — this is the specific gap this research closes.
- **Using `JSON.stringify()` to compare bucket objects from `construirBuckets()`:** `Set` objects serialize to `{}` via `JSON.stringify`, silently discarding the emails data being tested. Use `assert.deepEqual`/`deepStrictEqual` directly (verified to compare `Set` contents correctly) or convert to a sorted array first (`[...bucket.emails].sort()`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dual CJS/GAS-global compatible module export | A custom build/transpile step that strips exports before copy-paste deploy | Guarded `if (typeof module !== 'undefined')` block, appended in place | Zero build step (matches project's "no build system" character); provably inert in Apps Script V8 because no `module` global exists there — confirmed by reading `.planning/codebase/STACK.md`'s runtime description and reasoning about the JS spec, not by running inside actual Apps Script (that's out of reach from this research session; noted as an assumption below) |
| Mocking the Apps Script API surface | A GAS mocking library (`gas-local`) or hand-rolled `SpreadsheetApp`/`MailApp` stub objects | Nothing — not needed. Only `Logger.log()` needs a one-line stub; no other Apps Script service is referenced by the 5 target functions or their helpers | Confirmed by direct line-by-line read of `src/Core.gs` — scope stays exactly at TEST-01's boundary (pure functions only), matching the "Out of Scope" table in `REQUIREMENTS.md` ("Full mocking of SpreadsheetApp/MailApp... disproportionate") |
| Test file discovery / glob configuration | A custom test-glob config (jest.config-equivalent) | `node --test`'s built-in `test/` directory auto-discovery (all `.js`/`.cjs`/`.mjs` files inside any directory literally named `test` are treated as test files, no suffix required) | Ships with Node itself, zero config, matches D-05's single-file layout |

**Key insight:** Every "don't hand-roll" temptation in this phase (a mocking layer, a build step, a custom test discovery config) exists because of assumptions about Apps Script/Node incompatibility that turn out to be false for this specific, narrow scope — the 5 target functions are already pure aside from one `Logger.log()` call, and Node's own module loader already tolerates the `.gs` extension. Building any of that machinery would be solving a problem this codebase doesn't actually have.

## Common Pitfalls

### Pitfall 1: Stubbing `CONFIG` but forgetting `Logger`
**What goes wrong:** The unmatched-horario-label characterization test (mandated by the roadmap's success criterion 2) throws `ReferenceError: Logger is not defined` instead of asserting `parsearHorarios(...) === []`.
**Why it happens:** `CONTEXT.md`'s D-03 only discusses `CONFIG` as an ambient global to stub, because that's the dependency visible from `mapearColumnas`/`determinarNivel`/`parsearHorarios`'s main paths. `Logger.log(...)` is called only on `parsearHorarios()`'s *failure* branch (`src/Core.gs:161`), which is easy to miss without deliberately exercising that exact input.
**How to avoid:** Set `global.Logger = { log: () => {} }` in the test setup, alongside `global.CONFIG`, before requiring `Core.gs`. [VERIFIED empirically in this session — see Code Examples Pattern 2.]
**Warning signs:** A test for the unmatched-horario edge case fails with a `ReferenceError` (not an assertion failure) the first time it's run.

### Pitfall 2: Relying on Node's unknown-extension `require()` fallback without understanding it's not a hard API guarantee
**What goes wrong:** `require('../src/Core.gs')` works today (verified on Node v26.5.0) because Node's CJS loader falls back to its `.js` handler for extensions it doesn't recognize. This behavior is long-standing and widely relied upon (e.g., TypeScript loaders historically used it before registering `.ts` explicitly) but is not documented as a hard contract in `Module._extensions`' public docs.
**Why it happens:** `require.extensions`/`Module._extensions` is itself a legacy, "please don't rely on this" API per Node's own docs, even though the fallback behavior built on top of it has been stable across many major versions.
**How to avoid:** Either accept the fallback as-is (low risk given its decades-long stability), or add one defensive line to the test setup for explicitness: `require.extensions['.gs'] = require.extensions['.js'];` before the first `require('../src/*.gs')` call. [VERIFIED empirically: both approaches work identically in this session.]
**Warning signs:** A future Node major version release notes mentioning changes to `require.extensions` or CJS extension resolution (none found as of this research date).

### Pitfall 3: Comparing `Set`-containing bucket objects with `JSON.stringify`
**What goes wrong:** `construirBuckets()` returns bucket objects with an `emails: Set` field (`src/Core.gs:197`). `JSON.stringify()` serializes a `Set` to `{}`, silently discarding the very data a characterization test for this function needs to pin.
**Why it happens:** `Set` has no `toJSON()` method and isn't array-like to `JSON.stringify`.
**How to avoid:** Use `assert.deepEqual`/`assert.deepStrictEqual` directly on objects containing `Set` values — [VERIFIED empirically] these correctly compare `Set` contents, order-insensitively. Alternatively, convert with `[...bucket.emails].sort()` before comparing if a plain-array assertion style is preferred.
**Warning signs:** A bucket-comparison test that always passes regardless of `emails` content, or that "loses" email data in a failure diff.

### Pitfall 4: `npm test` silently exits 0 with "0 tests" if the test file isn't discoverable
**What goes wrong:** If `test/Core.test.js` were misnamed or placed outside a directory literally named `test`, `node --test` (no path argument) could report zero tests and exit successfully — a false-pass that looks like "everything's fine."
**Why it happens:** `node --test`'s auto-discovery is convention-based (directory named `test/`, or filename patterns like `*.test.js`); a typo in either breaks discovery silently rather than erroring.
**How to avoid:** D-05 already specifies `test/Core.test.js` (satisfies the "directory literally named `test`" rule, verified empirically), so this is a non-issue if that exact path is used. Still worth a `assert(tests > 0)`-style sanity check in CI if one is ever added, since none exists today.
**Warning signs:** `npm test` output shows `ℹ tests 0` yet exits with status 0.

## Code Examples

### Minimal root `package.json`
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
Notes: `"private": true` prevents accidental `npm publish`. No `"type"` field is needed — the default (`"commonjs"`) is correct since the shim and test files use `require()`/`module.exports`, not ES module `import`/`export`. No `dependencies`/`devDependencies` field — zero third-party packages this phase (see Package Legitimacy Audit).

### Full `test/Core.test.js` skeleton
```javascript
// Source: constructed for this phase — pattern empirically verified in this session.
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

describe('mapearColumnas', () => {
  // ...
});

describe('parsearHorarios', () => {
  // ... includes: unmatched horario label -> [], Francés -> _default fallback
});

describe('determinarNivel', () => {
  // ...
});

describe('normalizarNombre', () => {
  // ...
});

describe('construirBuckets', () => {
  // ... assert on count + emails (Set) + modalidades per bucket
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| No automated tests; correctness confidence from manual menu-driven runs (`🔄 Recalcular Panorama`, `🔍 Detectar columnas`) + `Logger.log()` diagnostics read from the Executions log (per `.planning/codebase/TESTING.md`) | Automated `node:test` suite exercising the 5 pure functions in isolation, run via `npm test` | This phase (2026-07) | Establishes the regression net every later hardening phase (2-5) depends on, per `CONTEXT.md`'s Phase Boundary; catches the exact class of bug (wrong catalog values, casing mismatches) that shipped in v1.1.0 |

**Deprecated/outdated:** N/A — no prior test tooling existed to deprecate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `typeof module !== 'undefined'` guard is a true no-op inside the actual Apps Script V8 editor (no `module` global exists there) | Don't Hand-Roll, Pattern 1 | This is based on documented Apps Script runtime characteristics (`.planning/codebase/STACK.md`, `PROJECT.md` Key Decisions) and general JS engine behavior, not verified by executing code inside an actual Apps Script project during this research session (no such environment was reachable from this session). If wrong, the shim could throw a `ReferenceError` on `module` inside the live editor. Mitigation: the planner should include a manual verification task (paste the shimmed files into a real Apps Script editor and run `onOpen()`/`recalcularPanoramaConAlerta()` once) as part of this phase's acceptance, matching success criterion 3 in the roadmap. |
| A2 | Node.js version ≥20 (stable `node:test`) is what any given maintainer's machine will have when running `npm test` in the future | Standard Stack, Environment Availability | This repo has no `engines` field, `.nvmrc`, or CI to enforce a minimum. If a future maintainer runs Node 16/18, `node:test`'s auto-discovery behavior may differ or be less complete (experimental-era gaps). Risk is low-to-moderate for a single/small-team institutional tool; mitigation is cheap (add an `engines` field and/or a one-line prerequisite note in the new README "🧪 Tests" section). |

## Open Questions

1. **Should the guarded shim also export the internal helper functions (`normalizarTexto`, `normalizarNivel`, `normalizarIdioma`, `primeraCeldaNoVacia`, `obtenerLabelHorario`)?**
   - What we know: CONTEXT.md marks this explicitly as Claude's Discretion. All 5 target functions call at least one of these helpers internally, so their behavior is already exercised indirectly.
   - What's unclear: Whether direct unit coverage of, e.g., `normalizarTexto`'s whitespace-collapsing/lowercasing logic is worth the extra export surface, versus keeping the shim's public surface minimal (only the 5 named functions, matching TEST-01's literal scope).
   - Recommendation: Export them too — the marginal cost is one more line in the shim's export object, and it gives the planner the option to add focused edge-case tests (e.g., `normalizarTexto` collapsing multiple internal spaces) without forcing every case through a 2-hop indirect path. This is a low-risk, low-cost addition; final call remains the planner's/implementer's discretion per CONTEXT.md.

2. **Should `package.json` declare an explicit `engines.node` minimum?**
   - What we know: `node:test` is stable as of Node 20, experimental in Node 18 (per WebSearch, cross-sourced, MEDIUM confidence — not independently verified against Node's official changelog in this session). This repo currently pins no runtime version anywhere.
   - What's unclear: Whether the project's actual maintainers' machines are guaranteed to be on a modern-enough Node version, since this is the *first* npm-touching file the repo will ever have.
   - Recommendation: Add `"engines": { "node": ">=20" }` to the `package.json` in Code Examples above, and mention the requirement in the new README "🧪 Tests" section (D-06) so a maintainer on an old Node install gets a clear signal rather than a confusing "no tests ran" silent pass.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node --test` runner; `require()`-ing shimmed `.gs` files | ✓ | v26.5.0 (verified locally in this session) | — |
| npm | `npm test` script invocation | ✓ | 11.17.0 (verified locally in this session) | Tests can also be run directly via `node --test`, without npm, if npm itself were ever unavailable |
| `node:test` / `node:assert` (Node built-ins) | The test framework itself | ✓ (bundled with the Node install above) | Stable since Node 20 [MEDIUM confidence, WebSearch cross-sourced] | — |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** none identified — everything needed for this phase is already present in the local environment.

## Security Domain

This phase adds no new user-facing input surface, no authentication/session/crypto code, and installs zero external packages — it is a pure test-infrastructure addition with no new attack surface. Most ASVS categories are not applicable; the one relevant control (supply-chain risk from new dependencies) is eliminated by design.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Not touched this phase |
| V3 Session Management | No | Not touched this phase |
| V4 Access Control | No | Not touched this phase |
| V5 Input Validation | No | Tests *characterize* existing input-handling behavior; they do not add or change any input-validation logic |
| V6 Cryptography | No | Not touched this phase |
| V14 Configuration (dependency/supply-chain management) | Yes | Zero new npm dependencies added — `package.json` declares only `scripts.test`, no `dependencies`/`devDependencies` (D-01/D-02) — eliminates postinstall-script and typosquatting risk entirely for this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A "test framework needed" ask leading to an unnecessary/unverified npm package being added | Tampering / Elevation of Privilege (via a malicious `postinstall` script) | N/A this phase — `node:test`/`node:assert` are Node.js built-ins; no package is installed to audit |
| A future test accidentally exercising the real `MailApp`/`SpreadsheetApp` production path during an automated run (e.g., sending a real email during `npm test`) | Repudiation / unintended production side effect | N/A for the 5 in-scope functions — confirmed by direct read of `src/Core.gs` that none of them call `MailApp`/`SpreadsheetApp`; the test harness never requires `src/Alertas.gs` or `src/Panorama.gs` this phase |

## Sources

### Primary (HIGH confidence — direct code read or empirical test performed in this session)
- `src/Core.gs` (direct read, full file) — confirms the 5 target functions' exact current behavior, confirms `CONFIG` and `Logger` are the only ambient globals referenced (one `Logger.log()` call inside `parsearHorarios()`), confirms empty-value return convention (`''`/`[]`/`{}`, never `null`/`undefined`)
- `src/Config.gs` (direct read, full file) — confirms `CONFIG` is a pure data literal with zero function calls / zero Apps Script global references inside it
- Empirical test (this session, Node v26.5.0): `require('./Foo.gs')` from a `.js` file successfully loads and executes a `.gs`-extension file via Node's CJS unknown-extension fallback
- Empirical test (this session): `global.CONFIG` set either before or after `require()` (but before function invocation) is correctly read by bare `CONFIG` references inside the required module
- Empirical test (this session): calling a function that references an unstubbed ambient `Logger.log()` throws `ReferenceError: Logger is not defined`; stubbing `global.Logger = { log: () => {} }` resolves it
- Empirical test (this session): `node --test` (no path argument) auto-discovers and runs `test/*.test.js` files with zero configuration
- Empirical test (this session): `assert.deepEqual`/`assert.deepStrictEqual` (from `node:assert/strict`) correctly compares `Set` object contents, order-insensitively
- Empirical test (this session): explicit `require.extensions['.gs'] = require.extensions['.js']` registration also works, as a defensive alternative to relying on the implicit fallback

### Secondary (MEDIUM confidence — WebSearch, cross-referenced)
- [Test runner | Node.js v26.5.0 Documentation](https://nodejs.org/api/test.html) — default file/directory discovery conventions (files in a directory literally named `test` are auto-discovered; glob support added in Node 21)
- WebSearch cross-source (Sonar blog, Node.js v20 release announcement, Node.js Learn) — `node:test` experimental since Node 18, stable since Node 20; minimum viable version ~16.17.0 for basic usage

### Tertiary (LOW confidence)
- None material to this research's conclusions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero external dependencies, and the one relevant tool (`node:test`) was exercised directly against real repo files in this session, not assumed from training data.
- Architecture: HIGH — the guarded shim and ambient-global stubbing patterns were both empirically verified end-to-end (require → stub → invoke → assert) using synthetic files that mirror `Core.gs`'s exact structure, plus direct reads of the real target files.
- Pitfalls: HIGH — the `Logger` stubbing gap is not a hypothetical risk; it was found by reading `src/Core.gs` line-by-line and confirmed by reproducing the exact `ReferenceError` empirically.

**Research date:** 2026-07-25
**Valid until:** 30 days (stable domain — Node's built-in test runner and CJS module resolution behavior change rarely; re-verify if the repo's Node version changes significantly or if `Core.gs`/`Config.gs` gain new ambient-global references before this phase is planned/executed)
