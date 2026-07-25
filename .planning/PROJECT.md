# Panorama de Inscripciones — IDIOMAS PUCV

## What This Is

A Google Apps Script automation, container-bound to a Google Sheet, that processes responses from IDIOMAS PUCV's language-course enrollment interest form. It normalizes each response (idioma, nivel, horario, modalidad), maintains a live "Panorama de Cursos" sheet showing 🟢/🟡/⚪ status per (idioma, nivel, horario) combination against a minimum-enrollment threshold, and emails the team automatically the moment a combination crosses that threshold. Already built and in production use (v1.1.0 shipped); this milestone hardens it rather than adding new user-facing behavior.

## Core Value

Staff can trust the Panorama and its alerts completely — no silently dropped registrations, no silently failed notifications, and no reliance on someone reading Apps Script execution logs to know something went wrong.

## Requirements

### Validated

- ✓ Form responses are read, normalized, and aggregated into (idioma, nivel, horario) buckets — existing
- ✓ "Panorama de Cursos" sheet shows live 🟢 Abre / 🟡 Evaluar / ⚪ Sin interés status per bucket — existing
- ✓ Automatic email alert sent to the team the moment a bucket crosses `umbralMinimo` — existing
- ✓ Alert deduplication so the same bucket/semester doesn't re-notify — existing
- ✓ Menu-driven semester reset (clear alert history, reinstall trigger, recalculate) — existing
- ✓ Manual test-alert tool to preview email formatting without affecting real state — existing
- ✓ Sidebar view of the panorama — existing
- ✓ Column-detection helper to re-map form headers after form edits — existing

### Active

This milestone is **strictly hardening/quality work** — no new user-facing features. Scope, per `.planning/codebase/CONCERNS.md`:

- [ ] Alert-sent state (`_Estado_Avisos`) is only recorded after `enviarAvisoUmbral()` actually confirms delivery — fixes the bug where Gmail quota exhaustion silently marks a bucket as notified without ever sending the email
- [ ] A failure sending one bucket's alert doesn't block evaluation/notification of the other buckets in the same trigger run (per-bucket isolation instead of one function-level try/catch)
- [ ] Rows with an unmatched/unparseable horario label are surfaced (counted and reported), not silently discarded — a respondent's whole registration currently vanishes from all reporting on a single label mismatch
- [ ] Concurrent form submissions are serialized (`LockService`) around the recalculate + alert-dispatch critical section, so simultaneous submissions can't interleave writes to the Panorama sheet or `_Estado_Avisos`
- [ ] Automated unit tests cover the pure data-transformation functions in `Core.gs` (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) — the exact functions responsible for the real regressions fixed in v1.1.0
- [ ] Staff-facing error/status messages replace silent `Logger.log()`-only failure paths — e.g. discarded-row counts and unmatched-horario counts surfaced in the "🔄 Recalcular Panorama" completion dialog, not just the execution log
- [ ] In-sheet guidance (labels, help text, or a help tab) exists so non-technical staff understand what the menu options and Panorama columns mean without reading code
- [ ] Semester setup documentation is clear enough for a non-coder to follow end-to-end, building on README's existing "Cada semestre nuevo" section

### Out of Scope

- New user-facing features or workflow changes — explicitly deferred; this milestone is hardening only
- Adding a verified `Francés` horario catalog entry — blocked on real form responses to verify correct label text; not something that can be hardened preemptively (per existing code comment, "sin datos reales aún")
- Migrating the deployment model away from manual copy-paste into the Apps Script editor — out of scope unless required to enable automated testing (see Key Decisions)
- Archiving/pruning historical response rows for scale — current volume (tens to low hundreds of rows/semester) doesn't need it yet; revisit if the "Missing Critical Features" scaling note in CONCERNS.md becomes relevant

## Context

- This is a brownfield project. `.planning/codebase/` contains a full map generated 2026-07-25: `STACK.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `INTEGRATIONS.md`, `CONCERNS.md`. `CONCERNS.md` in particular documents every issue in this milestone's scope with exact file/line references — read it before planning phases.
- No build system today: classic (non-clasp) Apps Script project, deployed by copy-pasting `.gs` files into the Apps Script editor. No `package.json`, no test framework, no CI.
- Zero automated tests currently exist anywhere in the project; all verification today is manual, menu-driven, and was done against ~10 real form responses for the v1.1.0 fix (per CHANGELOG.md).
- The live Google Form is the primary external dependency and is not version-controlled — form wording changes can silently break parsing (this is the root cause behind most of the hardening scope above).
- Institutional config (semester label, threshold, alert recipients, language/level/horario catalogs) lives in a single `CONFIG` object in `Config.gs`, per project convention documented in `AGENTS.md`.

## Constraints

- **Platform**: Google Apps Script V8 runtime, container-bound to the enrollment Google Sheet — no standalone deployment target
- **Tech stack**: No new frameworks/languages; stay within Apps Script's built-in services (`SpreadsheetApp`, `MailApp`, `ScriptApp`, `HtmlService`, `Utilities`, `Logger`) unless a Key Decision below says otherwise
- **Scope**: No new user-facing features this milestone — hardening and readability only, confirmed with the user
- **Gmail quota**: Alert sending is subject to Gmail's daily sending quota; fixes must account for this rather than assume unlimited retries
- **Non-technical maintainers**: Semester-to-semester handoff must remain usable by IDIOMAS PUCV staff without coding knowledge — readability/documentation work should be written for that audience

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Milestone scope is hardening-only, no new features | User explicitly chose this over "hardening + new capability" to keep risk and review surface small | — Pending |
| Automated tests will need `clasp` + local Node test runner (extracting pure functions from `Core.gs`) since Apps Script has no native test framework | Identified in CONCERNS.md as the only viable path to unit-test `mapearColumnas`/`parsearHorarios`/etc. without a live Sheet | — Pending (confirm during roadmap/research) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-25 after initialization*
