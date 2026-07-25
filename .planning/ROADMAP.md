# Roadmap: Panorama de Inscripciones — IDIOMAS PUCV (Hardening Milestone)

## Overview

This milestone hardens an existing, in-production Google Apps Script automation without adding new user-facing features. The five phases below follow the dependency chain surfaced by research: a test harness lands first so every later change to `Core.gs`-adjacent code has a regression net; the two production bugs that share the same ~20 lines of `src/Alertas.gs` (unconfirmed alert-sent state, one bucket's failure blocking the rest) ship together with the `LockService` fix that closes the race between them; discard/unmatched-horario visibility follows once tests pin down the affected return shapes; the `PropertiesService` bridge comes next because it has nothing to report until the prior two phases produce failure/discard data to bridge; and staff-facing documentation comes last so it describes the tool's final, post-hardening behavior rather than an intermediate state.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Test Harness & Characterization Tests** - Automated tests capture the current, real behavior of the five pure `Core.gs` functions before anything is refactored
- [ ] **Phase 2: Trigger Critical-Section Hardening** - Concurrent form submissions are serialized and a bucket is only ever marked notified after its email is confirmed sent
- [ ] **Phase 3: Menu-Path Lock Guard & Discard Visibility** - The interactive recalculate path is protected from concurrent runs, and unmatched-horario rows are counted and shown instead of silently discarded
- [ ] **Phase 4: PropertiesService Reliability Bridge** - Alert-send and discard failures from a headless trigger run surface to staff the next time they open the menu
- [ ] **Phase 5: Staff-Facing Documentation & In-Sheet Guidance** - Non-technical staff can understand the tool and run a full semester setup without reading source code

## Phase Details

### Phase 1: Test Harness & Characterization Tests
**Goal**: The five pure `Core.gs` functions (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) have automated regression coverage of their current, real behavior — with zero changes to the copy-paste deploy workflow.
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01
**Success Criteria** (what must be TRUE):
  1. Running the test command (`npm test` or `node --test`) from the project root executes and passes tests for all five target functions.
  2. Tests are characterization tests — written against the original, unmodified functions — and capture known edge cases (unmatched horario label, Francés falling to `_default`, an empty/missing header match) as they behave *today*, before any refactor.
  3. `Core.gs` still runs unmodified inside the Apps Script V8 editor: the guarded `module.exports` shim added for testing is confirmed inert in production (no `module` global exists there, so nothing changes about the copy-paste deploy).
  4. A short note (README or inline comment) documents how to run the tests locally, so this suite becomes the standard regression check for any future edit to these five functions.
**Plans**: 2 plans
- [ ] 01-01-PLAN.md — Add guarded module.exports shims to src/Config.gs and src/Core.gs + create root package.json
- [ ] 01-02-PLAN.md — Write test/Core.test.js characterization suite + README Tests section + end-of-phase Apps Script inertness check

### Phase 2: Trigger Critical-Section Hardening
**Goal**: `onFormSubmit`'s recalculate-and-alert-dispatch sequence is safe under concurrent form submissions, and a bucket is only ever marked as notified after its email delivery is actually confirmed.
**Depends on**: Phase 1 (tests exist as a regression net before this phase's changes to the alert-dispatch path)
**Requirements**: ALRT-01, ALRT-02, CONC-01
**Success Criteria** (what must be TRUE):
  1. Two form submissions arriving at effectively the same time are serialized: `LockService.getScriptLock()` with `tryLock()` ensures the second `onFormSubmit` execution waits or gracefully times out instead of interleaving writes to the Panorama sheet or `_Estado_Avisos` with the first.
  2. A forced exception thrown inside the locked critical section still releases the lock — verified by confirming the lock's `finally` block contains only `lock.releaseLock()`, and that the next execution isn't blocked afterward.
  3. `enviarAvisoUmbral()` wraps the actual `MailApp.sendEmail()` call (not just the `getRemainingDailyQuota()` pre-check) in try/catch and returns a real boolean reflecting whether delivery was confirmed.
  4. `marcarComoAvisado()` is only called when `enviarAvisoUmbral()` returns true — a simulated quota exhaustion or a thrown exception during `sendEmail()` both leave the bucket unmarked in `_Estado_Avisos`.
  5. One bucket's send failure inside the alert-dispatch loop does not prevent the remaining buckets in the same run from being evaluated and notified (per-bucket try/catch, not one function-level try/catch around the whole loop).
**Plans**: TBD

### Phase 3: Menu-Path Lock Guard & Discard Visibility
**Goal**: The interactive "🔄 Recalcular Panorama" path is also protected from concurrent writes, and rows with an unmatched/unparseable horario label are counted and reported as a distinct category instead of silently vanishing from all reporting.
**Depends on**: Phase 2 (reuses the same `LockService` convention/timeout decided there, though it protects a different code path)
**Requirements**: DATA-01
**Success Criteria** (what must be TRUE):
  1. Running "🔄 Recalcular Panorama" while another recalculation/alert-dispatch is in progress shows a friendly "try again shortly" message instead of failing silently or corrupting the Panorama sheet.
  2. A form response whose horario label doesn't match any catalog entry is counted in a distinct "horario no reconocido" category, not merged into "sin horario" or dropped from all reporting.
  3. The distinct unmatched-horario count is visible in the "🔄 Recalcular Panorama" completion dialog, separate from any other skipped-row count.
  4. The Phase 1 characterization test covering the "unmatched horario" edge case still passes after this phase's changes to `leerRespuestas()`/`parsearHorarios()`/`recalcularPanorama()` return shapes (confirms the new counting logic didn't silently change existing behavior).
**Plans**: TBD

### Phase 4: PropertiesService Reliability Bridge
**Goal**: Failures that happen during a headless trigger execution — a bucket whose alert failed to send — are no longer invisible; they surface to staff the next time they open the menu, alongside the discard counts from Phase 3.
**Depends on**: Phase 2 (needs a per-bucket alert-error record to bridge) and Phase 3 (needs discard/unmatched counts to bridge)
**Requirements**: VISB-01
**Success Criteria** (what must be TRUE):
  1. When `onFormSubmit`'s per-bucket catch records an alert-send failure, that failure is still visible to staff after the trigger execution ends — opening the sheet or running "🔄 Recalcular Panorama" shows a warning listing which bucket(s) failed to notify, with no need to open Apps Script execution logs.
  2. The discard/unmatched-horario counts (Phase 3) and the alert-send failure counts (Phase 2) both appear together in the same completion dialog, not split across two separate manual checks.
  3. Once staff have seen a pending-failure warning, it is cleared (`leerYLimpiarResultadoParcial`) so the same stale warning doesn't repeat on every subsequent menu open.
  4. `PropertiesService` usage stays well within documented quota (9 KB/value, 500 KB/store) at this project's real data volume — confirmed by inspecting the actual size of what gets written.
**Plans**: TBD

### Phase 5: Staff-Facing Documentation & In-Sheet Guidance
**Goal**: A non-technical IDIOMAS PUCV staff member can understand what the tool's menu options and Panorama columns mean, and can run a full semester setup end-to-end, without reading source code or asking a developer.
**Depends on**: Phase 4 (documents the tool's final, post-hardening dialog/menu behavior)
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. Every menu option and each Panorama sheet column has an in-sheet explanation (label, cell note, or help tab) reachable without opening the Apps Script editor.
  2. The existing "❓ Ayuda" dialog (and/or a help tab) reflects the final hardened behavior — busy/lock messages, discard counts, alert-failure warnings — rather than the pre-hardening behavior.
  3. A non-coder following only the semester-setup documentation (extending README's "Cada semestre nuevo" section) can complete the full new-semester setup end-to-end without reading any `.gs` source file.
  4. The documentation explicitly calls out the one manual step that can't be automated (updating `CONFIG.semestre` in `Config.gs`) with clear before/after guidance.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Test Harness & Characterization Tests | 0/TBD | Not started | - |
| 2. Trigger Critical-Section Hardening | 0/TBD | Not started | - |
| 3. Menu-Path Lock Guard & Discard Visibility | 0/TBD | Not started | - |
| 4. PropertiesService Reliability Bridge | 0/TBD | Not started | - |
| 5. Staff-Facing Documentation & In-Sheet Guidance | 0/TBD | Not started | - |
