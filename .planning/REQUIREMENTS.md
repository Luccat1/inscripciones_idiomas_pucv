# Requirements: Panorama de Inscripciones — IDIOMAS PUCV (Hardening Milestone)

**Defined:** 2026-07-25
**Core Value:** Staff can trust the Panorama and its alerts completely — no silently dropped registrations, no silently failed notifications, and no reliance on someone reading Apps Script execution logs to know something went wrong.

This is a **hardening-only milestone** on an existing production system. No new user-facing features. Every v1 requirement below fixes or de-risks something already built, per `.planning/codebase/CONCERNS.md` and `.planning/research/`.

## v1 Requirements

### Alert Reliability

- [ ] **ALRT-01**: Alert-sent state (`_Estado_Avisos`) is only recorded after the email is confirmed to have actually sent — not unconditionally after attempting to send. Closes the bug where Gmail quota exhaustion silently marks a bucket as notified without ever delivering the email.
- [ ] **ALRT-02**: A failure sending one bucket's alert does not block evaluation or notification of the other buckets in the same trigger run — each bucket's send+mark is isolated so one failure can't stall the rest.

### Concurrency

- [ ] **CONC-01**: Concurrent form submissions are serialized around the recalculate-and-alert-dispatch critical section (`LockService`), so simultaneous submissions can't interleave writes to the Panorama sheet or `_Estado_Avisos`.

### Data Integrity

- [ ] **DATA-01**: Rows with an unmatched or unparseable horario label are counted and reported as a distinct category (not conflated with "no horario answered"), instead of silently discarding the respondent's entire registration from all reporting.

### Testing

- [ ] **TEST-01**: Automated unit tests cover the five pure data-transformation functions in `Core.gs` (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) using a guarded `module.exports` shim (inert under the Apps Script V8 runtime) + Vitest or `node:test` — no `clasp` adoption, no changes to the copy-paste deploy workflow.

### Staff Visibility

- [ ] **VISB-01**: Discard/error counts (unmatched horario rows, other skipped rows, alerts sent/failed) are surfaced in the "🔄 Recalcular Panorama" completion dialog shown to staff — not just logged to `Logger.log()`/Stackdriver, which non-technical staff can't access.

### Documentation & Readability

- [ ] **DOCS-01**: In-sheet guidance (labels, help text, or a help tab) explains what the menu options and Panorama sheet columns mean, so non-technical staff don't need to read source code to understand the tool.
- [ ] **DOCS-02**: Semester setup documentation is clear enough for a non-coder to follow end-to-end, building on README's existing "Cada semestre nuevo" section.

## v2 Requirements

Deferred to a future milestone. Not in this roadmap.

### Reliability Enhancements

- **RELY-01**: Manual "🔁 Reintentar avisos pendientes" menu action to retry quota-failed alerts that never got a subsequent form submission to piggyback a retry on. (User explicitly deferred — ALRT-01 already closes the main trust gap; this residual case is rare.)
- **RELY-02**: Ambient health-check sidebar block persisting last-run counts (timestamp, rows processed/discarded, alerts sent) so staff can check status anytime, not just right after running a menu action. (User explicitly deferred in favor of the one-shot dialog in VISB-01.)
- **RELY-03**: Scheduled Form-header drift detector — a time-driven trigger comparing live Form headers against `CONFIG.formCols` and emailing staff on mismatch, catching Form wording changes proactively instead of reactively. (Flagged in CONCERNS.md "Dependencies at Risk"; not requested this milestone.)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Any new user-facing feature or workflow change | User explicitly chose "strictly hardening" over "hardening + new capability" |
| Digest/batched alert emails (one email per run instead of one per bucket) | Would reduce Gmail quota pressure, but changes the user-facing email format — conflicts with the no-new-features constraint; needs its own scope decision |
| Adopting `clasp` / migrating off copy-paste deployment | Research confirmed it's unnecessary for TEST-01 (a guarded `module.exports` shim is sufficient); clasp adds migration risk (full-file overwrite, manifest/OAuth drift) for no benefit this milestone |
| Adding a verified `Francés` horario catalog entry | Blocked on real form responses to verify correct label text — not something that can be hardened preemptively |
| Full admin analytics dashboard / external monitoring integrations (PagerDuty, Slack, etc.) | Disproportionate for a low-frequency, single-maintainer institutional tool; plain counts in the existing dialog are sufficient |
| Fuzzy/NLP-based horario label matching | Trades a simple, auditable exact-match catalog for an unverifiable probabilistic system; DATA-01 fixes the *visibility* problem instead |
| Full mocking of `SpreadsheetApp`/`MailApp` for 100% test coverage | Disproportionate — TEST-01 scopes tests to the pure functions where the actual historical bugs occurred |
| Per-registrant drill-down UI (names/emails visible per bucket) | Genuinely new feature, not hardening |
| Archiving/pruning historical response rows | Current volume (tens–low hundreds of rows/semester) doesn't need it yet |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 - Test Harness & Characterization Tests | Pending |
| ALRT-01 | Phase 2 - Trigger Critical-Section Hardening | Pending |
| ALRT-02 | Phase 2 - Trigger Critical-Section Hardening | Pending |
| CONC-01 | Phase 2 - Trigger Critical-Section Hardening | Pending |
| DATA-01 | Phase 3 - Menu-Path Lock Guard & Discard Visibility | Pending |
| VISB-01 | Phase 4 - PropertiesService Reliability Bridge | Pending |
| DOCS-01 | Phase 5 - Staff-Facing Documentation & In-Sheet Guidance | Pending |
| DOCS-02 | Phase 5 - Staff-Facing Documentation & In-Sheet Guidance | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8/8 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-25*
*Last updated: 2026-07-25 after roadmap creation (5 phases, full coverage)*
