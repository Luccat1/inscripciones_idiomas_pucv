# Project Research Summary

**Project:** Panorama de Inscripciones — IDIOMAS PUCV
**Domain:** Reliability/observability hardening of an existing production Google Apps Script automation (form-processing + threshold-triggered email alerts)
**Researched:** 2026-07-25
**Confidence:** HIGH

## Executive Summary

This is not a greenfield build — it's a hardening milestone on a live, in-production Google Apps Script automation that already reads form responses, aggregates them into enrollment "buckets," and emails staff when a bucket crosses a minimum-enrollment threshold. Experts harden systems like this by fixing the exact bug classes already documented (`.planning/codebase/CONCERNS.md`) using the platform's own built-in primitives rather than importing new frameworks: `LockService` for concurrency, confirm-then-record state transitions for idempotent alert delivery, `PropertiesService` for bridging headless-trigger failures to a human-visible surface, and characterization-tests-first extraction for the five pure `Core.gs` functions. No new npm dependencies are required beyond a single dev-only test runner (Vitest or Node's built-in `node:test`), and the existing manual copy-paste deploy model is untouched.

The single most important research conclusion is that **`clasp` is not needed for this milestone**, correcting a "Pending" Key Decision in `PROJECT.md`. Live verification in this research session confirmed that a guarded `module.exports` block is inert under the Apps Script V8 runtime (no global `module` exists there) and that the five target functions already take zero `SpreadsheetApp`/`MailApp` dependencies — so Node's `require()` can load `.gs` source files directly, today, with zero build tooling changes. Adopting `clasp` instead would introduce real, well-documented risk (full-file overwrite on push/pull, no merge capability, manifest/OAuth-scope drift) for a project whose git history predates any tool that treats the live editor as non-authoritative — a mismatch this research explicitly recommends avoiding this milestone.

The primary risks are not "will the fix work" but "will the fix be applied completely and in the right order." Pitfalls research repeatedly surfaces partial fixes that look done but leave the original bug class alive: locking without a `finally`-scoped release, fixing only the quota *pre-check* branch of `enviarAvisoUmbral()` while leaving the actual `MailApp.sendEmail()` call unwrapped, or writing tests against an already-refactored function without first capturing the original's real behavior. Architecture research independently confirms several of these fixes are two edits to the *same* ~20 lines of code (`src/Alertas.gs`) and should land as one atomic phase, not split across separate reviews. Mitigation is procedural as much as technical: sequence work so the test harness lands first (giving a regression net before `Core.gs`'s return shapes change), treat lock-acquire/release and per-bucket isolation as one inseparable edit, and verify every "silent failure" path terminates in a staff-visible dialog, not just `Logger.log()`.

## Key Findings

### Recommended Stack

No new frameworks or languages, per `PROJECT.md`'s explicit constraint. The only new artifact is a dev-only `package.json` + test runner that `require()`s `src/*.gs` files directly after adding a small guarded `module.exports` block (inert in the Apps Script V8 runtime) to the five target functions. Everything else needed for this milestone (locking, durable cross-execution state, staff-facing dialogs) is a built-in Apps Script service, not an installable package.

**Core technologies:**
- Node.js (>=20 LTS): dev-machine-only runtime to execute tests against `.gs` source — never runs in production; Apps Script's own V8 runtime is untouched
- Vitest 4.1.10 (or Node's built-in `node:test` for a zero-devDependency alternative): test runner + assertions for the five pure `Core.gs` functions — chosen over Jest for this project's simplicity/DX tradeoff; either is a valid HIGH-confidence choice
- Hand-rolled fake objects (no library) for `MailApp`/`SpreadsheetApp`/`Logger` in the handful of tests that touch impure functions — matches this project's zero-third-party-dependency convention; `gasmask` is a fallback only if fake object graphs become unwieldy (not expected this milestone)
- `LockService.getScriptLock()` + `tryLock(30000)` (not `waitLock`, which throws instead of returning `false`) for the `onFormSubmit` critical section — official Google-documented pattern for exactly this race condition
- `PropertiesService.getScriptProperties()` for durable state that survives a headless trigger execution and surfaces on the next human-facing menu action (both the "last-reset semester" bug and the alert-failure-bridging need)

**Explicitly rejected:** `clasp` (this milestone), QUnitGS2, GasT, `gas-local`, `gas-mock-globals` — all either unmaintained (verified via GitHub/npm API, several years stale) or unnecessary given the `require()`-works-natively finding.

### Expected Features

"Features" here means reliability/observability capabilities, each mapped directly to a `PROJECT.md` Active requirement — this is a hardening milestone, not a net-new feature milestone.

**Must have (table stakes — maps 1:1 to PROJECT.md Active scope):**
- Confirm-then-record alert-sent state — no more marking `_Estado_Avisos` before delivery is confirmed
- Per-bucket failure isolation — one bucket's send error doesn't block the rest of the run
- `LockService` around the recalculate + alert-dispatch critical section
- Malformed/unmatched-horario row visibility (counted and reported, not silently dropped) — raw rows stay in the existing responses sheet, no new storage needed
- Staff-facing status/error surfacing (extend the existing completion dialog) — not `Logger.log()`-only
- Automated unit tests for the five pure `Core.gs` functions
- In-sheet guidance and non-coder semester-setup documentation

**Should have (legitimate next-milestone differentiators — do not schedule into this milestone):**
- Ambient health-check sidebar block (persist last-run counts beyond the one-shot dialog)
- Scheduled Form-header drift detector (proactive detection of Form wording changes)
- Manual "retry pending alerts" menu action (partial closure beyond confirm-then-record)

**Defer (explicitly out of category or scope-conflicting):**
- Digest/batched alert emails — flagged as a genuine tension: it would reduce Gmail-quota risk but is a user-facing behavior change, conflicting with the "no new user-facing features" constraint; needs explicit sign-off if ever pursued
- Full admin analytics dashboard, external monitoring/alerting (PagerDuty/Slack), fuzzy/NLP horario matching, full `SpreadsheetApp`/`MailApp` mocking, per-registrant drill-down UI, migrating to `clasp`+CI "as a reliability feature" — all identified as over-engineering relative to this tool's actual scale (tens-to-low-hundreds of rows/semester, single primary maintainer)

### Architecture Approach

This is an integration plan onto the existing 5-file flat-global-scope `src/` codebase — no restructuring, no new module system. Four safeguards attach at specific, already-identified integration points: `LockService` at the entry points that perform non-idempotent writes (`onFormSubmit`, defensively `recalcularPanoramaConAlerta`) rather than inside the shared `recalcularPanorama()` internals (which would penalize the read-only sidebar path for no benefit); per-bucket try/catch inside the existing `forEach` in `src/Alertas.gs`; a guarded `module.exports` shim appended to `Core.gs` (inert in production) plus a sibling `tests/` directory for the Node test harness; and one new file, `src/Fiabilidad.gs`, holding small `PropertiesService` read/write helpers that bridge headless-trigger failures to the next human-opened menu dialog.

**Major components:**
1. `src/Alertas.gs` (`onFormSubmit`) — gets the lock acquire/finally-release, per-bucket try/catch, and the confirm-then-record fix to `enviarAvisoUmbral()`, all as one atomic edit to the same ~20 lines
2. `src/Core.gs` (pure functions) — unchanged logic, gains a guarded test-export shim; later gains extended return shapes to report discard/unmatched counts
3. `src/Main.gs` (`recalcularPanoramaConAlerta`, `onOpen`) — gets a short-timeout lock guard on the menu path and reads/clears any pending `Fiabilidad.gs` state to prepend a warning block to its existing `ui.alert()`
4. `src/Fiabilidad.gs` (new) — small `PropertiesService`-backed helpers (`registrarResultadoParcial`, `leerYLimpiarResultadoParcial`) that are the only durable channel available from a headless trigger execution
5. `tests/` (new, sibling to `src/`, never copy-pasted into the Apps Script editor) — Node/Vitest test suite `require()`-ing `src/Core.gs` directly

Suggested build order (from ARCHITECTURE.md): test harness first (independent, unblocks safe iteration) → trigger critical-section hardening (lock + per-bucket isolation + confirm-then-record, one atomic change) → menu-path lock guard → discard/unmatched-horario visibility (pinned by tests from step 1) → `Fiabilidad.gs` bridge (depends on both prior fixes having something to record) → staff-facing docs (describes the final state, so it goes last).

### Critical Pitfalls

1. **Lock acquired but never released because `releaseLock()` isn't in a bare `finally` block** — the most commonly cited LockService mistake; verify by forcing an exception inside the locked section and confirming the next execution isn't blocked. The `finally` block's only job should be `lock.releaseLock()` — no logging, no email inside it.
2. **Locking the entire `onFormSubmit` body instead of just the shared-state critical section** — extends lock hold time under a burst of submissions and can cause legitimate contention to be misdiagnosed as a hang, or (worse) cause a lock-timeout exception to be silently swallowed by this codebase's existing "never re-throw in triggers" convention.
3. **Fixing only the quota pre-check branch (`getRemainingDailyQuota() <= 0`), leaving the actual `MailApp.sendEmail()` call unwrapped in try/catch** — the documented bug anchors attention on the pre-check line, but transient Gmail errors and mid-loop quota exhaustion can throw *from inside* `sendEmail()` itself; both paths must converge on "not marked as sent."
4. **"Extracting" a pure function for testing subtly changes its behavior** — since zero tests exist today, characterization tests must be written against the *original, unmodified* function first (using the ~10 real form responses referenced in CHANGELOG.md), before any extraction/refactor, so drift is detectable rather than silently introduced.
5. **Adopting `clasp` mid-milestone would risk overwriting live-editor-only emergency edits** (e.g., a hand-edited `CONFIG.semestre`) with no merge capability and no guaranteed-current git baseline — this is the concrete risk behind the "don't adopt clasp this milestone" stack recommendation, not just an abstract preference.

## Implications for Roadmap

Based on combined research, the four Active-scope hardening items plus the two documentation items suggest **five phases**, sequenced by dependency (test harness before Core.gs changes; concurrency+confirm-then-record as one atomic phase; visibility work after tests exist; docs last since they describe final behavior):

### Phase 1: Test Harness & Characterization Tests
**Rationale:** Independent of every other change, and architecture research explicitly recommends doing this first so later `Core.gs` edits (Phase 3) are guarded by tests from day one rather than tested manually.
**Delivers:** `package.json` + Vitest (or `node:test`), guarded `module.exports` shims on the five pure functions, characterization tests capturing *current* behavior (including known edge cases: unmatched horario label, Francés falling to `_default`, empty header match) before any refactor.
**Addresses:** FEATURES.md Active item "Automated unit tests cover the pure data-transformation functions"
**Avoids:** Pitfall 6 (extraction silently changing behavior) — the characterization-first order is the only way to make this pitfall detectable, and Pitfall 4/5 (clasp adoption risk) is sidestepped entirely by confirming clasp is unnecessary before writing a single test.

### Phase 2: Trigger Critical-Section Hardening (Concurrency + Idempotent Alerts)
**Rationale:** Architecture research is explicit that the lock-acquire/release skeleton, per-bucket try/catch, and the confirm-then-record fix to `enviarAvisoUmbral()` all touch the exact same ~20 lines in `src/Alertas.gs` and must land as one atomic edit — splitting them across phases means re-touching (and re-reviewing) the same block twice, and a half-applied state leaves one of the two known production bugs still live.
**Delivers:** `LockService.getScriptLock()` with `tryLock(30000)` + `finally`-scoped release wrapping `onFormSubmit`'s full recompute+dispatch sequence; per-bucket try/catch inside the alert-dispatch loop; `enviarAvisoUmbral()` wrapping the actual `MailApp.sendEmail()` call (not just the quota pre-check) and returning a real boolean; `marcarComoAvisado()` gated on confirmed success.
**Uses:** `LockService`, `MailApp` quota-check + exception handling (STACK.md Reliability Service Patterns)
**Implements:** `src/Alertas.gs` (`onFormSubmit`) component from ARCHITECTURE.md
**Avoids:** Pitfalls 1, 2, 3, 7 (lock leak, over-broad lock scope, uncalibrated timeout, quota-fix-covers-pre-check-only)

### Phase 3: Menu-Path Lock Guard + Discard/Unmatched-Horario Visibility
**Rationale:** Logically follows Phase 2 (same `getScriptLock()` convention/timeout decided once) but is otherwise independent — a different code path (normalize/read side) than the alert-dispatch side. Doing this after Phase 1 means the changed `leerRespuestas()`/`parsearHorarios()` return shapes are pinned by tests immediately.
**Delivers:** Short-timeout (`5-10s`) `tryLock` guard + friendly "busy" dialog on `recalcularPanoramaConAlerta()`; extended return shapes from `leerRespuestas()`/`parsearHorarios()`/`recalcularPanorama()` reporting discard/unmatched-horario counts; updated completion dialog surfacing those counts.
**Addresses:** FEATURES.md Active items "malformed-row visibility" and part of "staff-facing failure/status surfacing"
**Avoids:** the UX pitfall of lock-timeout exceptions being invisible to staff (PITFALLS.md UX Pitfalls table)

### Phase 4: PropertiesService Reliability Bridge (`src/Fiabilidad.gs`)
**Rationale:** Depends on Phase 2 (needs a per-bucket error list to have something to record) and Phase 3 (needs discard counts to have something to record) — wire both into the new file together since it's one small addition either way.
**Delivers:** New `src/Fiabilidad.gs` with `registrarResultadoParcial`/`leerYLimpiarResultadoParcial` helpers backed by `PropertiesService.getScriptProperties()`; wired into `onFormSubmit`'s per-bucket catch and read-and-cleared at the top of `recalcularPanoramaConAlerta()`/`onOpen()` to prepend a warning block to the existing dialog.
**Uses:** `PropertiesService` (STACK.md Reliability Service Patterns — 9 KB/value, 500 KB/store limits, confirmed non-issue at this scale)
**Implements:** the "bridging headless-trigger state to a human-visible surface" architecture pattern — this is what makes "no more Logger.log()-only silent failures" actually true for the one execution context (`onFormSubmit`) that cannot show a UI dialog directly.

### Phase 5: Staff-Facing Documentation & In-Sheet Guidance
**Rationale:** Should describe the *final* post-hardening state of the menu dialogs (which change in Phases 2-4), so it must go last, not in parallel.
**Delivers:** In-sheet help (labels, cell notes, or a help tab) explaining menu options and Panorama columns; semester setup documentation clear enough for a non-coder to follow end-to-end, extending the README's existing "Cada semestre nuevo" section.
**Addresses:** FEATURES.md Active items "in-sheet self-documentation" and "non-coder semester setup documentation"

### Phase Ordering Rationale

- Test harness first because it's fully independent and de-risks every subsequent `Core.gs`-touching phase (Phase 3) — this is the one sequencing point both STACK.md and ARCHITECTURE.md agree on independently.
- Phases 2 and 3 are kept separate despite both touching reliability because they sit on genuinely different code paths (alert-dispatch vs. read/normalize) and different lock-timeout profiles (background trigger vs. interactive menu click) — but within Phase 2, the lock/isolation/confirm-then-record trio is deliberately *not* split further, per ARCHITECTURE.md's explicit warning that these are one atomic edit to shared lines.
- Phase 4 is placed after both 2 and 3 because `Fiabilidad.gs` has nothing to bridge until both failure-count sources (alert errors, discard counts) exist.
- Documentation is last because writing accurate staff-facing docs before the dialogs they describe are finalized would require rewriting them, per FEATURES.md's dependency note ("dialog has nothing to show until the counts exist") extended to the doc-writing phase itself.
- This ordering directly avoids the pitfall of shipping a "looks done" partial fix (PITFALLS.md's "Looks Done But Isn't" checklist) by ensuring each phase's prerequisite state actually exists before the phase that depends on it begins.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (test harness):** ARCHITECTURE.md rates this MEDIUM confidence and explicitly recommends "a short spike before roadmap commitment" — specifically to confirm how `Core.gs`'s pure functions currently receive `CONFIG` (ambient global vs. parameter), since that determines whether tests need `global.CONFIG = {...}` fixtures or can call functions directly. Recommend `/gsd:plan-phase --research-phase 1` or at minimum reading the actual current function signatures in `src/Core.gs` before finalizing the test-file pattern.

Phases with standard patterns (skip research-phase):
- **Phase 2 (LockService + confirm-then-record):** HIGH confidence — official Google docs directly document `tryLock`/`finally`/`SpreadsheetApp.flush()` sequencing for exactly this race-condition class; concrete code pattern already validated in STACK.md and ARCHITECTURE.md.
- **Phase 3 (menu lock guard + discard visibility):** LOW-MEDIUM complexity, well-understood extension of existing `recalcularPanoramaConAlerta()`/`ui.alert()` pattern already in the codebase.
- **Phase 4 (PropertiesService bridge):** HIGH confidence — official docs confirm quotas, copy-not-live-view semantics, and the get/set pattern; no ambiguity requiring a research spike.
- **Phase 5 (docs):** No research needed — documentation-only work for a known, already-scoped audience.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against official Google Apps Script docs, live npm registry `engines` fields, live GitHub commit-history checks, and a session-live test of `require('./sample.gs')` — not training-data assumptions. The clasp-not-needed conclusion in particular is directly tested, not inferred. |
| Features | MEDIUM-HIGH | Apps Script platform mechanics (Ui/dialogs/quotas) confirmed via official docs (HIGH); the specific "count + alert is the pragmatic middle ground" and "extend existing sidebar/dialog rather than build new artifacts" recommendations are applied judgment for this tool's scale, not a documented industry standard (MEDIUM) — flagged per-item in FEATURES.md. |
| Architecture | HIGH (integration points) / MEDIUM (test-harness specifics) | Lock/trigger integration points are HIGH confidence (official docs + direct reads of this repo's actual file/line structure). The Jest/Vitest `moduleFileExtensions`-vs-plain-`require()` mechanics for `.gs` loading are MEDIUM — architecture research itself recommends a short spike before roadmap commitment. |
| Pitfalls | MEDIUM (overall), HIGH (individual mechanics) | LockService/clasp/quota *mechanics* are HIGH confidence (official docs + multiple independent community/GitHub-issue sources). The "teams commonly get X wrong" framing and this project's specific risk exposure (e.g., emergency `CONFIG.semestre` hand-edits) are MEDIUM — synthesized/inferred from this codebase's own documented bug history rather than directly observed elsewhere. |

**Overall confidence:** HIGH

### Gaps to Address

- **Whether `Core.gs`'s pure functions read `CONFIG` as an ambient global or receive it as a parameter** — directly affects the test-fixture pattern in Phase 1; architecture research flags this as unverified and recommends checking the actual function signatures before finalizing the test harness design, not asserting a pattern here.
- **Exact `waitLock`/`tryLock` timeout value for Phase 2** — PITFALLS.md is explicit this should not be a copy-pasted round number; it should be derived from measuring the locked section's actual worst-case duration at current data volumes during implementation, not decided in planning.
- **Digest/batched email tension** — FEATURES.md flags this differentiator as conflicting with the "no new user-facing features" constraint even though it would reduce Gmail-quota risk; explicitly deferred, but the roadmapper should not schedule it as a "quick win" alongside the Phase 2 quota fix.
- **Pending-alert retry queue (full closure vs. partial mitigation)** — the confirm-then-record fix (Phase 2) prevents *false* "sent" marks but a quota-failed alert is only retried if a *future* form submission arrives for that same bucket/semester; a full automated retry queue is judged disproportionate for this milestone, but the roadmapper/user should explicitly confirm partial mitigation is acceptable, or add a lightweight manual "retry pending" menu action as a P2 candidate.

## Sources

### Primary (HIGH confidence)
- https://developers.google.com/apps-script/reference/lock/lock and .../lock-service — Lock/tryLock/waitLock/releaseLock semantics, official form-submission locking example
- https://developers.google.com/apps-script/guides/properties and .../services/quotas — PropertiesService use-case guidance, quotas, copy-not-live-view gotcha
- https://developers.google.com/apps-script/reference/mail/mail-app — MailApp quota/exception behavior
- https://developers.google.com/apps-script/guides/dialogs and .../reference/base/ui — staff-facing dialog/sidebar mechanisms
- https://developers.google.com/apps-script/guides/clasp — official clasp guide (clone-before-push, full-overwrite-not-merge workflow)
- https://www.npmjs.com/package/@google/clasp / registry.npmjs.org API — confirmed clasp v3.3.0, Node >=20.0.0 engine floor
- https://github.com/google/clasp (releases + issues #424, #468, #756, #994) — manifest/OAuth-scope overwrite risk, actively maintained
- Live session verification: `require('./sample.gs')` from plain Node successfully loading a guarded `module.exports` block, zero configuration
- Project-internal: `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `CONCERNS.md`, `.planning/PROJECT.md` — ground truth for exact file/line integration points and documented bug history

### Secondary (MEDIUM confidence)
- https://pulse.appsscript.info/p/2024/01/control-google-form-submissions-script-executions-with-script-lock/ and Google Apps Script community group threads — LockService finally-block pattern confirmation
- https://medium.com/geekculture/taking-away-the-pain-from-unit-testing-in-google-apps-script-98f2feee281d, https://github.com/mzagorny/gas-local, https://github.com/lastlink/google-app-script-ts-jest — community patterns for dual-loadable `.gs` files (informed but not the sole basis for the recommendation, which was independently verified live)
- https://appsscript.tools/blog/best-google-apps-script-libraries-2026 — "80% shim-tested pure logic / 20% in-runtime tested" framing
- GitHub API commit-history checks for `gas-local`, `QUnitGS2`, `GasT`, `gasmask`, `app-script-mock` — staleness/maintenance verification for the "what NOT to use" list

### Tertiary (LOW confidence)
- None flagged — all findings in this research round were either verified against official docs/live tests or explicitly labeled MEDIUM with reasoning, per each source document's own confidence notes.

---
*Research completed: 2026-07-25*
*Ready for roadmap: yes*
