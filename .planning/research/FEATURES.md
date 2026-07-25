# Feature Research

**Domain:** Reliability/observability hardening for a production Google Apps Script automation (form-processing + threshold-triggered email alerts)
**Researched:** 2026-07-25
**Confidence:** MEDIUM-HIGH (Apps Script platform mechanics confirmed via official docs; pattern recommendations synthesized from general production-notification-system practice and applied to Apps Script's specific constraints — flagged per item below)

## Framing Note

"Features" doesn't map cleanly onto a hardening-only milestone. This document treats **reliability/observability capabilities** as the feature set: idempotency, error surfacing, malformed-input handling, and staff-facing health visibility, evaluated against what a small institutional automation genuinely needs versus what would be over-engineering. Every table-stakes item below is cross-referenced to the specific `PROJECT.md` Active requirement it satisfies.

## Answers to the Four Specific Questions

**1. Idempotency/dedup for triggered email sends.** The standard pattern for any system that must not double-send and must not silently drop a notification is: **only record "notified" after the send is confirmed successful** (confirm-then-record, not record-then-send-and-hope). The current code (`enviarAvisoUmbral()` returning nothing + unconditional `marcarComoAvisado()`) is the classic anti-pattern — it fails "closed" (marks success unconditionally) instead of "open" (only marks on confirmed success). This is a well-established distributed-systems idempotency principle (write side-effect first, record intent-fulfilled second, verified) — confirmed applicable to Apps Script's `MailApp`, which throws or returns a checkable quota (`getRemainingDailyQuota()`) rather than silently failing at the API level. HIGH confidence (official `MailApp` docs confirm quota-check + exception behavior; the confirm-then-record pattern itself is general software-engineering practice, not Apps-Script-specific).

**2. Error surfacing for non-technical staff.** Apps Script's execution log (Stackdriver/Cloud Logging) is explicitly a developer tool — Google's own docs frame it as accessed via the script editor, not a staff-facing surface. The two idiomatic staff-facing surfaces in Apps Script are: (a) `Ui.alert()` / custom dialogs (`HtmlService` + `showModalDialog`) shown synchronously at the end of a menu-driven action — good for "here's what just happened" summaries; and (b) a **sidebar** (`Ui.showSidebar`), which persists without blocking the editor — good for "current state" that staff can glance at anytime. A `Ui.toast()` (non-blocking corner message) is the lightest-weight option for transient status. None of these require staff to know what Stackdriver is. MEDIUM-HIGH confidence (official `Ui` class docs confirm all three mechanisms and their blocking/non-blocking behavior).

**3. Malformed/unmatched input rows.** Three established strategies exist in data-pipeline design generally: **silently skip** (current behavior — cheapest, worst for trust), **quarantine** (route unmatched rows to a visible holding area — e.g., a distinct sheet, or a flag column — so nothing is lost and staff can inspect later), and **alert** (surface a count/summary immediately, without necessarily storing the row anywhere new). For a small-volume seasonal tool, the pragmatic middle ground is **count + alert**, not full quarantine infrastructure: track how many rows were dropped and why (already-existing data problem vs. no-answer-given), surface the count in the completion dialog, and rely on the existing raw response sheet as the "quarantine" (nothing is deleted — the row is just excluded from aggregation). This matches exactly what `PROJECT.md` Active scope already specifies. Full quarantine (writing unmatched rows to a dedicated `_FilasDescartadas` sheet with the reason) is a reasonable differentiator but adds a new sheet, new schema, and new staff-facing surface to maintain — heavier than the milestone's stated scope. MEDIUM confidence (synthesized from general ETL/data-pipeline practice; no Apps-Script-specific official guidance found on this exact tradeoff).

**4. Staff-facing "health check" / "last run summary" UI.** No single dominant convention exists across Apps Script projects, but three recurring patterns appear in official samples and community practice: (a) an **existing sidebar extended** with a "last run" block (timestamp, rows processed, rows discarded, alerts sent) — lowest incremental cost since this project already has a sidebar (`Panorama.gs`); (b) a **dedicated append-only log sheet** (one row per recalculation run) — gives historical trend visibility but is a new artifact to maintain and explain to staff; (c) a **completion dialog** shown immediately after a menu action (e.g., "🔄 Recalcular Panorama") — zero new artifacts, but only visible at the moment of action, not as an ambient "is everything OK?" check. Given this project already has a sidebar and a completion-dialog pattern (`recalcularPanoramaConAlerta()`), extending both with counts is the lowest-cost, highest-consistency option; a dedicated log sheet is a legitimate differentiator for historical drift-tracking but not needed to satisfy this milestone's Active scope. MEDIUM confidence (official docs confirm the mechanisms exist and their tradeoffs; no authoritative "this is best practice" ranking found — this is applied judgment for a low-volume institutional tool).

## Feature Landscape

### Table Stakes (Production Notification System Baseline)

Capabilities a production system that emails people based on aggregated thresholds cannot credibly ship without. Each maps to a `PROJECT.md` Active requirement.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Confirm-then-record send state (no false "notified" marks) | A notification system that can silently lose a message and never retry it is worse than having no automation at all — it creates false confidence | LOW | Maps to Active req 1. Make `enviarAvisoUmbral()` return/throw a distinguishable success signal; gate `marcarComoAvisado()` on it. No new infrastructure. |
| Per-unit failure isolation (one bucket's error doesn't block others) | Aggregate/batch processing systems universally isolate failures per-item so one bad record doesn't take down the whole batch | LOW | Maps to Active req 2. Wrap each bucket's send+mark pair in its own try/catch inside the existing `forEach`. |
| Concurrency control on shared-state critical sections | Any system with concurrent writers (form submissions) touching shared mutable state (Panorama sheet, `_Estado_Avisos`) needs mutual exclusion or it will eventually corrupt state | MEDIUM | Maps to Active req 4. `LockService.getScriptLock()` around recalculate + dispatch, per Google's own documented pattern for `onFormSubmit`. Also a **prerequisite for true idempotency** — see Dependencies below. |
| Malformed-row visibility (counted, not silently dropped) | Staff need to trust that "no alert" means "no threshold crossed," not "data was silently discarded" | LOW-MEDIUM | Maps to Active req 3. Track and surface unmatched-horario / unmatched-field counts distinct from "field genuinely blank." Row itself is preserved in the existing raw responses sheet — no new storage needed. |
| Staff-facing failure/status surfacing (not log-only) | Non-technical staff cannot and should not need Stackdriver access to know the automation is healthy | LOW | Maps to Active req 6. Extend existing completion dialog (`Ui.alert`) with counts already being tracked; no new UI paradigm. |
| Automated tests for pure transformation functions | The exact functions responsible for the real v1.1.0 production bugs have zero regression protection today | MEDIUM | Maps to Active req 5. Scoped to pure functions only (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) — deliberately not full `SpreadsheetApp`/`MailApp` mocking (see Anti-Features). Requires tooling decision (Key Decision, pending). |
| In-sheet self-documentation for menu/column meaning | Semester handoff to non-coders fails if understanding the tool requires reading source | LOW | Maps to Active req 7. Help tab, cell notes, or inline labels — no code logic change. |
| Clear, non-coder semester setup documentation | Institutional continuity across staff turnover depends on this, independent of code quality | LOW | Maps to Active req 8. Documentation-only. |

### Differentiators (Valuable, Legitimately Deferrable)

Capabilities that would strengthen reliability/observability further but are not required to satisfy this milestone's stated scope, and were deliberately excluded from `PROJECT.md` Active requirements. Recommended for a **future** milestone, not this one.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Ambient "health check" sidebar block (last run timestamp, rows processed/discarded, alert status) | Lets staff check system health anytime, not just right after running a menu action | LOW-MEDIUM | Enhances the table-stakes error-surfacing item — reuses the same counters, just persists them to script properties and renders in the existing sidebar instead of (or in addition to) the one-shot dialog. |
| Append-only run-log sheet (one row per recalculation) | Historical trend visibility — "has the discard rate been rising?" — which a one-shot dialog can't show | MEDIUM | New artifact (new sheet + schema) staff must understand; heavier than this milestone's documented scope. Good candidate for "if drift recurs, do this next." |
| Scheduled Form-header drift detector (time-driven trigger diff against `CONFIG.formCols`, email on mismatch) | Catches Form wording changes proactively instead of reactively after registrations start vanishing — directly targets the CONCERNS.md root cause | MEDIUM | Explicitly suggested as a future idea in `CONCERNS.md` ("Dependencies at Risk"), not in Active scope. Independent of this milestone's other items — could ship standalone later. |
| Digest/batched email (one email per run listing all crossed buckets, vs. one per bucket) | Reduces Gmail quota consumption on high-traffic days, lowering the odds of hitting the quota-exhaustion failure mode at all | LOW-MEDIUM | **Changes the user-facing email format** — conflicts with "no new user-facing features" constraint in `PROJECT.md`. Worth flagging as a tension: it's a reliability improvement that is also a behavior change. Recommend explicit user sign-off before including even in a future milestone. |
| Pending-alert retry queue (persist quota-failed sends, auto-retry on a time trigger once quota resets) | Closes the remaining gap after the "confirm-then-record" fix: that fix prevents *false* "sent" marks, but if no further form submission ever arrives for that bucket/semester, a quota-failed alert is never retried since retries currently piggyback on the next `onFormSubmit` | MEDIUM-HIGH | New hidden sheet/schema + new time-driven trigger. Legitimate gap in the current fix's coverage, but full retry infrastructure is disproportionate for a "few sends/day" institutional tool — a simpler stopgap (e.g., a menu action "🔁 Reintentar avisos pendientes") may suffice and should be discussed as a possible late addition to this milestone if the team wants full closure on the bug rather than partial mitigation. |
| Basic email-format validation on the manual test-alert tool | Clearer error message than raw `MailApp` exception when staff mistype a test address | LOW | Explicitly flagged as low-priority in `CONCERNS.md` Security Considerations; trusted-user-only surface. |

### Anti-Features (Would Seem Like Reliability Work, Actually Over-Engineering Here)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full admin analytics dashboard (charts, historical trend UI, filters) | "Health check" naturally suggests a dashboard | Massive surface area for a tool with tens-to-low-hundreds of rows/semester and one primary maintainer; nothing here needs BI-style visualization | Plain counts in the existing sidebar/dialog (see Table Stakes / Differentiators above) |
| External monitoring/alerting integration (PagerDuty, Slack webhooks, uptime monitors) | "Production systems should have real monitoring" | This is a low-frequency, low-stakes institutional tool, not a service with an SLA; adding an external dependency for monitoring increases the very fragility this milestone is trying to reduce | Email-based staff alerts (already the tool's native channel) are sufficient |
| Automatic retry with exponential backoff / queueing infrastructure for every failure mode | Feels like "proper" distributed-systems hygiene | Apps Script triggers are stateless/event-driven by design; building a generalized retry framework is disproportionate engineering for an occasional Gmail-quota edge case | Confirm-then-record (table stakes) + the next form submission's natural retry is sufficient for the common case; a manual "retry pending" menu action covers the rest (see Differentiators) |
| Fuzzy/NLP-based horario label matching to "smart-match" Form wording drift | Would seem to prevent the root-cause bug class entirely | Trades a simple, auditable exact-match catalog for a probabilistic system that could silently mismatch in new ways, and is unverifiable by non-coder staff | Keep exact-match catalog; fix the *visibility* problem (surface unmatched counts) instead of trying to make matching "smarter" |
| Full mocking of `SpreadsheetApp`/`MailApp` to unit-test the entire codebase | "More test coverage is always better" | Apps Script's built-in services aren't designed for unit-test mocking; chasing full coverage here means building/maintaining a mocking framework disproportionate to the actual risk, which lives almost entirely in the pure transform functions | Test only the pure functions (already the documented approach — Active req 5); leave `SpreadsheetApp`/`MailApp`-touching code to manual verification, as today |
| Per-registrant drill-down UI (names/emails visible per bucket in the Panorama) | Natural-seeming extension once you're already touching the reliability code | This is a new user-facing feature, not hardening — explicitly out of scope for this milestone per `PROJECT.md` | Leave as a candidate for a future *feature* milestone, not this one |
| Migrating off classic Apps Script deployment to `clasp`+CI as a "reliability feature" | Automated tests and CI feel inseparable from proper testing | Explicitly out of scope in `PROJECT.md` unless required to enable the one automated-testing requirement — don't let it scope-creep into a broader tooling migration | Use the minimum `clasp` + local Node runner needed to test pure functions; don't build a full CI pipeline this milestone |

## Feature Dependencies

```
Concurrency control (LockService)
    └──strengthens──> Confirm-then-record idempotency
                        (without the lock, two concurrent runs could both pass a
                         "not yet marked" check for the same bucket before either
                         marks it, still causing a double-send in the race window)

Malformed-row visibility (counts)
    └──required-by──> Staff-facing failure/status surfacing
                        (dialog has nothing to show until the counts exist)

Staff-facing failure/status surfacing (dialog)
    └──enhances──> Ambient health-check sidebar block [differentiator]
                     (same counters, persisted + rendered continuously instead of once)

Automated tests for pure functions
    └──requires──> Tooling decision (clasp + Node test runner)
                     (Key Decision in PROJECT.md, currently "Pending")

Digest/batched email [differentiator]
    └──conflicts-with──> "No new user-facing features" constraint
                            (changes what staff/recipients see — needs explicit sign-off
                             even if pursued in a later milestone)

Pending-alert retry queue [differentiator]
    └──builds-on──> Confirm-then-record idempotency
                      (retry queue only makes sense once "sent" is trustworthy;
                       building it before the confirm-then-record fix would just
                       add a queue on top of a lie)
```

### Dependency Notes

- **LockService strengthens confirm-then-record:** the sequential-request bug (marking sent before confirming) and the concurrency bug (two requests racing) are different bugs with the same symptom (bad `_Estado_Avisos` state). Fixing one without the other leaves a residual race window. `PROJECT.md` Active scope already includes both — worth sequencing them in the same phase or back-to-back phases rather than treating either as fully sufficient alone.
- **Malformed-row visibility required by staff-facing surfacing:** the dialog/sidebar work is presentation only — it has no content to show until the discard-counting logic exists. Implement counting first (or in the same phase).
- **Tooling decision blocks automated tests:** `PROJECT.md` lists the `clasp`+Node decision as "Pending — confirm during roadmap/research." This should be resolved before (or as part of) any phase that includes the testing requirement, since it changes what "done" looks like for that phase.
- **Digest email conflicts with scope constraint:** flagged so the roadmap doesn't accidentally schedule it as a "quick win" alongside the quota-related bug fix — the quota-exhaustion bug fix (confirm-then-record) is in scope; changing to a digest format is a distinct, out-of-scope product decision.

## MVP Definition (Reframed: Hardening Scope Tiers)

### This Milestone (Required)

Directly maps to `PROJECT.md` Active requirements — not open to renegotiation without a scope discussion.

- [ ] Confirm-then-record alert-sent state — closes the "marked sent but never delivered" bug
- [ ] Per-bucket error isolation — one failure doesn't block the rest of the run
- [ ] Unmatched/unparseable horario rows counted and reported, not silently discarded
- [ ] `LockService` around recalculate + alert-dispatch critical section
- [ ] Unit tests for the five pure transform functions in `Core.gs`
- [ ] Staff-facing surfacing of discard/error counts (dialog, not just `Logger.log()`)
- [ ] In-sheet guidance for menu options and Panorama columns
- [ ] Non-coder semester setup documentation

### Add After Validation (Next Milestone, If Warranted)

Trigger for adding: this milestone ships and staff confirm the fixes hold across at least one real semester's usage; or a new failure mode surfaces that these don't cover.

- [ ] Ambient health-check sidebar block (persist last-run counts beyond the one-shot dialog)
- [ ] Scheduled Form-header drift detector (proactive, not reactive, detection of Form wording changes)
- [ ] Pending-alert retry mechanism (menu-driven manual retry, not full automated queue) — only if the team decides partial mitigation from confirm-then-record isn't sufficient closure

### Future Consideration (Explicitly Deferred, Needs Separate Scope Decision)

- [ ] Digest/batched alert emails — deferred because it's a user-facing behavior change, not hardening; needs its own scope conversation
- [ ] Append-only historical run-log sheet — deferred until/unless trend visibility (not just point-in-time status) becomes a real staff need
- [ ] Per-registrant drill-down UI — deferred as a genuinely new feature, out of this milestone's category entirely

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Confirm-then-record alert state | HIGH | LOW | P1 |
| Per-bucket error isolation | HIGH | LOW | P1 |
| Unmatched-row counting/reporting | HIGH | LOW-MEDIUM | P1 |
| LockService concurrency guard | MEDIUM | MEDIUM | P1 |
| Staff-facing dialog/status surfacing | HIGH | LOW | P1 |
| Pure-function unit tests | MEDIUM (protects future changes, no immediate staff-visible benefit) | MEDIUM | P1 |
| In-sheet guidance / help tab | MEDIUM | LOW | P1 |
| Semester setup documentation | MEDIUM | LOW | P1 |
| Ambient health-check sidebar | MEDIUM | LOW-MEDIUM | P2 |
| Form-header drift detector | MEDIUM | MEDIUM | P2 |
| Manual pending-alert retry menu action | LOW-MEDIUM | MEDIUM | P2 |
| Digest/batched emails | LOW (solves a rare edge case, changes UX) | LOW-MEDIUM | P3 |
| Append-only run-log sheet | LOW | MEDIUM | P3 |
| Per-registrant drill-down UI | N/A (out of category) | N/A | Not this milestone |

**Priority key:**
- P1: Required this milestone (maps to `PROJECT.md` Active scope)
- P2: Legitimate next-milestone candidate
- P3: Defer indefinitely unless a specific trigger event occurs

## Reference Patterns (No Direct Competitors — Comparable System Classes)

This is an internal institutional tool with no market competitors. Instead, comparing against how comparable *classes* of systems (small-scale automation platforms and general notification pipelines) handle the same problems clarifies what's proportionate here.

| Concern | Typical SaaS automation platform (e.g., Zapier/Make error handling) | General distributed-systems practice | Our Approach |
|---------|----------------------------------------------------------------------|----------------------------------------|--------------|
| Idempotent delivery | Built-in "replay" and dedup keys per run, backed by a managed task queue | Confirm-then-record + idempotency keys, often backed by a durable store | Confirm-then-record using the existing `_Estado_Avisos` sheet as the durable store — no new infrastructure, matches project scale |
| Failure visibility | Dashboard with per-run status, retry buttons, email digests of failures | Structured logs + alerting (PagerDuty, etc.) | Sidebar + completion dialog with counts — proportionate to a single-maintainer, low-frequency tool |
| Malformed input handling | Often a "skipped step" indicator per run, with the raw payload retained for inspection | Dead-letter queues holding unprocessable messages for later reprocessing | Count + surface (not a new dead-letter sheet) — the raw response row already persists in the existing responses sheet, so nothing is actually lost, just excluded from aggregation |
| Concurrency | Managed platform handles this transparently (queued execution) | Distributed locks (Redis, etc.) | `LockService.getScriptLock()` — the Apps-Script-native equivalent, appropriately lightweight |

## Sources

- [Class Lock | Apps Script | Google for Developers](https://developers.google.com/apps-script/reference/lock/lock) — HIGH confidence, official
- [Concurrency and Google Apps Script - G Suite Developers Blog](https://gsuite-developers.googleblog.com/2011/10/concurrency-and-google-apps-script.html) — MEDIUM confidence, official but older post; core mechanics unchanged
- [Class MailApp | Apps Script | Google for Developers](https://developers.google.com/apps-script/reference/mail/mail-app) — HIGH confidence, official
- [Quotas for Google Services | Apps Script | Google for Developers](https://developers.google.com/apps-script/guides/services/quotas) — HIGH confidence, official
- [Dialogs and sidebars in Google Workspace documents | Apps Script | Google for Developers](https://developers.google.com/apps-script/guides/dialogs) — HIGH confidence, official
- [Class Ui | Apps Script | Google for Developers](https://developers.google.com/apps-script/reference/base/ui) — HIGH confidence, official
- [Custom Menus in Google Workspace | Apps Script | Google for Developers](https://developers.google.com/apps-script/guides/menus) — HIGH confidence, official
- [Logging | Apps Script | Google for Developers](https://developers.google.com/apps-script/guides/logging) — HIGH confidence, official (confirms execution log is a developer-facing tool, not staff-facing)
- [apps-script-samples/forms/notifications/notification.gs — googleworkspace](https://github.com/googleworkspace/apps-script-samples/blob/main/forms/notifications/notification.gs) — MEDIUM confidence, official sample repo, illustrates try/catch-around-form-processing pattern
- `.planning/PROJECT.md` and `.planning/codebase/CONCERNS.md` (project-internal sources establishing exact scope and known bug mechanics)

---
*Feature research for: Apps Script production notification/automation hardening*
*Researched: 2026-07-25*
