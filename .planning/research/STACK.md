# Stack Research

**Domain:** Hardening tooling for a classic (non-clasp) Google Apps Script automation
**Researched:** 2026-07-25
**Confidence:** HIGH (verified against official Google docs, live npm registry, and live GitHub commit history — not training-data assumptions)

## Headline Finding (corrects a pending Key Decision in PROJECT.md)

`PROJECT.md` currently records: *"Automated tests will need `clasp` + local Node test runner... — Pending (confirm during roadmap/research)."*

**This research does not confirm that clasp is required.** It is confirmed unnecessary for this milestone's testing scope. Verified directly (see Sources):

- The five target functions (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) are plain functions with zero `SpreadsheetApp`/`MailApp` calls (already established in CONCERNS.md).
- Node's native `require()` can load a `.gs` file directly — **tested and confirmed working** in this session with zero configuration:
  ```js
  // sample.gs
  function sumar(a, b) { return a + b; }
  if (typeof module !== 'undefined') { module.exports = { sumar }; }

  // test file, plain node -e:
  const { sumar } = require('./sample.gs');   // works, no Jest config, no extension registration
  ```
- The guard `if (typeof module !== 'undefined') { ... }` is inert inside the Apps Script V8 runtime — Apps Script never defines a global `module`, and `typeof` on an undeclared identifier is guaranteed by the JS spec to return `'undefined'` rather than throw. This means the exact same `.gs` file that gets copy-pasted into the Apps Script editor also becomes a valid Node/CommonJS test target, with **no change to the manual deploy workflow** and no duplication of logic between a "src" and a "test-friendly" copy.
- The repo already git-tracks `src/*.gs` as the deploy source of truth (confirmed by reading `src/Core.gs` directly) — so there is no "clone into clasp first" step needed to get testable source onto disk. It's already there.

**Conclusion:** Add a `package.json` + a Node test runner that `require()`s `src/*.gs` directly (after adding the guard block to the ~5 files under test). Do **not** adopt clasp this milestone. Revisit clasp only if a future milestone wants CI-driven deploys or bidirectional editor sync — see "Alternatives Considered."

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | >=20 LTS (22 or 24 also fine) | Local JS runtime to run tests against `.gs` source | Needed only as a dev-time tool on the maintainer's machine; nothing runs on Node in production (Apps Script's own V8 runtime is unaffected). Node 20 is the floor because it's also clasp's minimum (see below) and is in active LTS through 2026. **Confidence: HIGH** (verified via `npm view` engines field). |
| Vitest | 4.1.10 (published 2026-07-06) | Test runner + assertions + watch mode + coverage for the extracted pure functions | Current de-facto standard test runner for new Node/JS tooling as of 2026 — actively released (latest version is 5 months old at most as of this research), fast, zero-config for a plain CommonJS/`require()` project, built-in `vi.fn()` for hand-rolled spies (see mocking pattern below), and built-in coverage via `v8` provider (no extra `nyc`/`istanbul` dependency). **Confidence: HIGH.** |
| `node:test` + `node:assert` (built into Node) | N/A (ships with Node) | Zero-dependency alternative test runner | If the team wants **literally zero new devDependencies** (matching the project's current zero-build-tooling posture as tightly as possible), Node's built-in test runner is production-stable since Node 20 and needs no `npm install` at all — just `node --test`. Slightly more boilerplate for mocking/spies than Vitest (`node:test`'s `t.mock.fn()` is serviceable but less ergonomic), and no watch-mode/coverage polish out of the box. **Confidence: HIGH** — this is a real, current, officially-documented Node feature, not a stopgap. |

**Recommendation between the two:** default to **Vitest** unless the user has a strong "keep node_modules at zero" preference — the DX difference (watch mode, clearer failure output, built-in coverage) is worth one devDependency for a project that will be touched by developers across semesters, possibly not always the same person. If minimizing footprint is prioritized over DX, `node:test` is a fully legitimate HIGH-confidence substitute — swap every `vitest`/`vi` reference below for `node:test`/`node:assert`+`t.mock`.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Hand-rolled fake objects (no library) | N/A | Stand in for `SpreadsheetApp`, `MailApp`, `Logger` in tests that touch impure functions (e.g. `enviarAvisoUmbral`, `marcarComoAvisado`) | Default choice. Since the project's own convention is "no third-party dependencies" (STACK.md confirms zero npm packages historically), and the functions most in need of tests this milestone (the `Core.gs` five + the alert-delivery-confirmation bug fix) need only a handful of methods faked (`sendEmail`, `getRemainingDailyQuota`, `getRange().setValue()`, etc.), a 10-20 line object literal per test file is simpler to audit than a dependency and has zero maintenance-abandonment risk. Example: `const fakeMailApp = { sent: [], getRemainingDailyQuota: () => 100, sendEmail(opts) { this.sent.push(opts); } }; global.MailApp = fakeMailApp;` |
| `gasmask` | latest (actively maintained — last commit 2026-05-05, verified via GitHub API) | Pre-built mocks specifically for `SpreadsheetApp`/`Range`/`Sheet` object graphs | Only reach for this if a *future* phase needs to test something that exercises a non-trivial slice of the Sheets object model (e.g. multi-range formatting, `getDataRange().getValues()` chains) where hand-rolling the fake would become large and repetitive. Not needed for this milestone's stated scope (the `Core.gs` functions take plain arrays/objects, not Sheet objects, as input). **Confidence: MEDIUM** — actively maintained per GitHub commit history, but a smaller, less battle-tested project than Jest/Vitest ecosystem staples; read its source before trusting it blindly. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `package.json` (new, minimal) | Declares `vitest` (or nothing, if using `node:test`) as the only devDependency, and a `test` script | This is the only new "build tooling" file this milestone needs. It does not imply npm-based deployment — deployment stays 100% manual copy-paste, unchanged. Add `"private": true` and no `main`/`bin` fields since this package is never published or run in production. |
| `.gitignore` addition for `node_modules/` | Keep the test-only dependency tree out of version control | Trivial but easy to forget when a project has never had a `package.json` before. |

## Installation

```bash
# From the project root
npm init -y
npm install -D vitest

# package.json script
#   "scripts": { "test": "vitest run" }

npx vitest run          # one-shot CI-style run
npx vitest               # watch mode during development
```

If choosing the zero-dependency path instead:
```bash
# No install needed
node --test src/**/*.test.js
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Plain `require()` of `.gs` files + guarded `module.exports`, no clasp | `clasp` (v3.3.0, actively maintained by Google, last release 2026-03-12) + full local-dev workflow | Adopt clasp in a **later** milestone if the team wants: (a) CI/CD that pushes directly to Apps Script on merge, (b) `clasp` version/deployment management instead of the editor's manual version history, or (c) editing in VS Code with real Apps Script type-checking (`@types/google-apps-script`). Do not adopt it *just* for testing — that need is already met without it. If adopted, `clasp clone <scriptId>` is confirmed to work against an existing container-bound script that was never created via clasp (verified against official docs), so migration is possible later without data loss — but the official clasp guide explicitly frames its ideal workflow as "avoid manual edits in the Apps Script editor — the repository becomes the single source of truth," i.e. a genuine hybrid (clasp *and* casual manual editor edits, indefinitely) is not the tool's intended steady state and risks silent divergence between local and deployed code. Don't half-adopt it. |
| Vitest / `node:test` (standard Node test runners, loading `.gs` via `require()`) | GAS-native in-editor frameworks: QUnitGS2, GasT | **Do not use for this milestone** — see "What NOT to Use." Reconsider only for the ~20% of logic that genuinely cannot be extracted from `SpreadsheetApp`/trigger context (per the general 80/20 "shim tests for pure logic, in-runtime tests for the rest" pattern that's the current common wisdom for GAS testing) — and even then, prefer simply running the existing menu-driven manual smoke test (`probarAviso()`) over adopting an unmaintained framework, given this project's small scope and non-technical-maintainer constraint. |
| Hand-rolled fakes for `MailApp`/`SpreadsheetApp`/`Logger` | `gasmask` | Use `gasmask` if a future test needs to fake more than ~2-3 methods of the Sheets object graph with realistic chaining behavior (`getRange().getValues()` etc.) — writing that faithfully by hand gets tedious past a certain complexity. Not needed for the current milestone's functions. |
| `getScriptLock()` for the `onFormSubmit` critical section | `getDocumentLock()` | Use `getDocumentLock()` only in scripts shared as an add-on across *many different* documents where you want per-document (not per-script) serialization. This project is a container-bound script with exactly one document per script instance (each new semester's duplicated Sheet gets its own bound script copy), so `getScriptLock()` and `getDocumentLock()` are behaviorally equivalent here — but `getScriptLock()` is what Google's own official trigger-safety sample code uses for this exact "ticket number race condition" pattern, so match that documented convention rather than diverging without reason. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| QUnitGS2 | Last GitHub commit 2020-08-01 (verified via GitHub API) — over 5 years stale, requires publishing an Apps Script web app just to view results, and is a heavier "run tests inside the Apps Script editor" model than this project needs for pure-function testing | Vitest/`node:test` running locally against `require()`d `.gs` source |
| GasT (huan/gast) | Last release v0.3.0 from 2016, 0 pull requests merged, 8 open issues, effectively abandoned (verified via GitHub API/fetch) | Same as above |
| `gas-local` (mzagorny/gas-local) | Last commit 2018-06-09, last npm publish 2018-06-12 (verified via npm registry + GitHub API) — 7+ years unmaintained, predates modern Node module resolution niceties | Plain `require()` of `.gs` files (proven to work natively, no library needed at all) |
| `gas-mock-globals` | Last npm publish 2021-11-02 (verified via npm registry) — usable in a pinch but stale relative to actively-maintained `gasmask`, and this project doesn't need its scope (broader Workspace service polyfills like `CardService`) | Hand-rolled fakes, or `gasmask` if Sheets-object mocking depth is ever needed |
| Adopting clasp *this milestone* "just in case" | Adds an OAuth/login setup step, a `.clasp.json` with a script ID, and a second possible source of truth (local files vs. editor) for a team explicitly optimizing for a small, low-risk hardening milestone maintained partly by non-technical staff — directly conflicts with PROJECT.md's constraint "No new frameworks/languages" and "keep risk and review surface small" | Ship testing without clasp (see Headline Finding); reassess clasp adoption as its own future milestone if CI/CD becomes a real goal |
| `waitLock(timeout)` for the trigger critical section | Throws an exception on timeout, which — combined with this project's existing pattern of one function-level `try/catch` swallowing errors silently (a documented bug in CONCERNS.md) — risks *reintroducing* a silent-failure mode if not paired with explicit handling | `tryLock(timeoutInMillis)`, which returns `false` on timeout so the caller can decide explicitly how to respond (log + skip this run, since the *next* form submission's trigger will naturally retry the recalculation) |
| Storing "last reset semester" only as a comment or relying on staff memory | This is the exact root cause already documented in CONCERNS.md ("no runtime validation that `CONFIG.semestre` actually changed since last reset") | `PropertiesService.getScriptProperties()` — see pattern below |

## Reliability Service Patterns (built into Apps Script — no library needed)

These are direct answers to questions 3 and 4; included here because they are the "stack" for the concurrency/state-tracking part of this milestone, even though they're native services rather than installable packages.

### LockService — serializing `onFormSubmit`

```js
function onFormSubmit(e) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(30000); // 30s: generous for this project's data volumes (tens–hundreds of rows)
  if (!acquired) {
    Logger.log('No se pudo obtener el lock en 30s; esta ejecución se omite y la próxima recalculará todo igual.');
    return; // safe to bail: recalcularPanorama() is idempotent full-recompute, next trigger run will catch up
  }
  try {
    recalcularPanorama();
    // ...alert dispatch...
    SpreadsheetApp.flush(); // commit pending writes to the Sheet *before* releasing the lock, per official guidance
  } finally {
    lock.releaseLock(); // always in `finally` — never rely on the try block reaching the end
  }
}
```
- **Why `getScriptLock()` not `getDocumentLock()`:** see Alternatives table above. **Confidence: HIGH** (official docs directly recommend script lock for this exact race-condition class).
- **Why `tryLock()` not `waitLock()`:** `tryLock` returns a boolean instead of throwing, which composes correctly with this project's existing (buggy) pattern of broad try/catch blocks — you get an explicit, loggable "did not acquire" branch instead of an exception that could be silently swallowed by an outer catch. **Confidence: HIGH.**
- **Why `SpreadsheetApp.flush()` before release:** official docs state this commits pending Sheets writes while you still hold exclusive access — otherwise a second execution could acquire the lock and read stale (not-yet-flushed) data. **Confidence: HIGH** (direct from Google's Lock class documentation).
- 30-second timeout is a starting recommendation, not a hard requirement — Apps Script does not document a maximum `tryLock` timeout value; keep it comfortably under the 6-minute trigger execution ceiling and short enough that a stuck lock doesn't back up multiple form submissions during a busy window.

### PropertiesService — tracking last-reset semester

```js
function iniciarNuevoSemestre() {
  const props = PropertiesService.getScriptProperties();
  const lastReset = props.getProperty('ULTIMO_SEMESTRE_RESETEADO');

  if (lastReset === CONFIG.semestre) {
    // This is the exact human-error bug documented in CONCERNS.md:
    // staff ran "Iniciar nuevo semestre" without first updating CONFIG.semestre.
    SpreadsheetApp.getUi().alert(
      '⚠️ CONFIG.semestre no ha cambiado desde el último reinicio (' + lastReset + '). ' +
      'Edita CONFIG.semestre en Config.gs antes de continuar, o los avisos y el panorama ' +
      'seguirán mostrando el semestre anterior.'
    );
    return; // hard stop, not just a reminder — matches CONCERNS.md's "warn (not just remind)" fix approach
  }

  // ...existing reset logic (clear _Estado_Avisos, reinstall trigger, recalculate)...

  props.setProperty('ULTIMO_SEMESTRE_RESETEADO', CONFIG.semestre);
}
```
- **Use `getScriptProperties()` (not `getDocumentProperties()` or `getUserProperties()`):** this value is app-wide config (which semester the whole script currently considers "current"), not per-document or per-user data. Official docs' own decision guidance ("app-wide configuration data" → script properties) matches this exactly. **Confidence: HIGH.**
- **Quotas (verified against Google's official Quotas page):** each property value is capped at 9 KB, total script property storage at 500 KB per script, with 50,000 read/write operations/day for consumer accounts (500,000/day for Workspace). A single string like a semester label is trivially within these limits — no risk of hitting quota for this use case. **Confidence: HIGH.**
- **Gotcha confirmed from official docs:** `getProperty`/`getProperties` return a *copy*, not a live view — mutating the returned object does nothing; you must call `setProperty`/`setProperties` again to persist changes. Relevant if a future phase wants to track more than one property (e.g., also storing last-run timestamp) as a JSON blob.

## Stack Patterns by Variant

**If a function has zero `SpreadsheetApp`/`MailApp`/`Logger` calls (the `Core.gs` five):**
- Test it directly via `require('../src/Core.gs')` after adding the `module.exports` guard.
- No mocks needed at all — feed synthetic header/row arrays and assert on return values.

**If a function calls `MailApp`/`SpreadsheetApp` (e.g. `enviarAvisoUmbral`, `marcarComoAvisado`):**
- Assign a hand-rolled fake to `global.MailApp` / `global.SpreadsheetApp` before requiring the module under test (or inject it as a parameter if refactoring toward dependency injection — a good match for this milestone's "confirm delivery before marking as sent" fix, since it lets the test assert the exact call sequence: `sendEmail` called, then and only then `marcarComoAvisado` called).
- Do not reach for `gasmask` unless the fake object graph becomes unwieldy (see Supporting Libraries).

**If the team wants zero new devDependencies at all:**
- Use `node:test` + `node:assert` instead of Vitest. Same `require()`-based approach applies unchanged; only the runner/assertion API differs.

**If a future milestone wants CI/CD or in-editor TypeScript-style intellisense:**
- That is the point to adopt clasp properly (full commitment, not hybrid) — out of scope for this hardening milestone per PROJECT.md's explicit constraint.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `vitest@4.1.10` | Node >=20 (Vitest 4's stated floor aligns with current Node LTS lines) | No conflict with the project's existing zero-dependency `.gs` source; Vitest only touches the new `package.json`/`node_modules`, never the deployed Apps Script code |
| `@google/clasp@3.3.0` (if adopted later) | Node >=20.0.0 (verified via npm registry `engines` field) | Only relevant if/when the team decides to adopt clasp in a future milestone; not needed now |
| Guarded `module.exports` block in `.gs` files | Apps Script V8 runtime (`"runtimeVersion": "V8"`, already set in this project's `appsscript.json`) | Confirmed inert in Apps Script: `typeof module` safely evaluates to `'undefined'` there since no CommonJS module system exists in that runtime — this is a language-level JS guarantee, not an Apps Script–specific behavior, so it does not depend on any particular V8 build |

## Sources

- https://www.npmjs.com/package/@google/clasp and npm registry API (`registry.npmjs.org/@google/clasp`) — confirmed latest version 3.3.0, published 2026-03-12, `engines.node: >=20.0.0`
- https://developers.google.com/apps-script/guides/clasp — official clasp guide; confirmed `clasp clone` works against existing (non-clasp-created) container-bound scripts by script ID, and that the intended clasp workflow treats the local repo as sole source of truth (i.e., discourages hybrid manual+clasp editing)
- https://github.com/google/clasp releases via GitHub API — confirmed v3.3.0 published 2026-03-12, actively maintained
- https://developers.google.com/apps-script/reference/lock/lock and .../lock-service — confirmed `tryLock`/`waitLock`/`releaseLock`/`hasLock` API, `getScriptLock()` recommended for trigger/callback race conditions, `SpreadsheetApp.flush()` before release pattern
- https://developers.google.com/apps-script/guides/properties — confirmed script/document/user property use-case guidance and copy-not-live-view gotcha
- https://developers.google.com/apps-script/guides/services/quotas — confirmed Properties Service quotas (9 KB/value, 500 KB/store, 50,000–500,000 ops/day) and MailApp daily recipient quotas (100/day consumer, 1,500/day Workspace)
- https://developers.google.com/apps-script/guides/support/best-practices — confirmed official guidance on using Properties service to persist state across executions
- GitHub API commit history checks (direct API calls, not training data) for: `mzagorny/gas-local` (last commit 2018-06-09), `artofthesmart/QUnitGS2` (last commit 2020-08-01), `huan/gast` (last release 2016, 8 open issues, effectively abandoned), `vlucas/gasmask` (last commit 2026-05-05, actively maintained), `matheusmr13/app-script-mock` (last commit 2017-12-11)
- npm registry API checks for `gas-local` (last publish 2018-06-12), `gas-mock-globals` (last publish 2021-11-02), `vitest` (latest 4.1.10, published 2026-07-06), `jest` (latest 30.4.2, published 2026-05-09)
- Live verification performed in this research session: `require('./sample.gs')` from plain Node successfully loads a guarded `module.exports` block with no configuration — HIGH confidence, directly tested rather than assumed
- https://appsscript.tools/blog/best-google-apps-script-libraries-2026 — MEDIUM confidence (single blog source, but consistent with all other findings) for the "80% shim-tested pure logic / 20% in-runtime tested Workspace-API code" framing
- Project-internal: `.planning/codebase/STACK.md`, `.planning/codebase/CONCERNS.md`, `.planning/PROJECT.md`, and direct read of `src/Core.gs` — confirmed current zero-build-tooling state and that target functions have no direct service dependencies

---
*Stack research for: Google Apps Script hardening/testing tooling*
*Researched: 2026-07-25*
