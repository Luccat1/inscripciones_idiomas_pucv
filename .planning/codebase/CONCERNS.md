# Codebase Concerns

**Analysis Date:** 2026-07-25

## Tech Debt

**Manual semester reset (`CONFIG.semestre`) is a single point of human error:**
- Issue: `CONFIG.semestre` (`src/Config.gs:13`) must be updated by hand at the start of every semester. It is used as part of the idempotency key for alert emails (`claveBucket()` in `src/Alertas.gs:34-36`, which joins `CONFIG.semestre` with idioma/nivel/horarioId) and is displayed in the panorama sidebar (`src/Panorama.gs:160`) and every alert email (`src/Alertas.gs:139`).
- Files: `src/Config.gs`, `src/Main.gs` (`iniciarNuevoSemestre()`, lines 78-96), `src/Alertas.gs`
- Impact: If an admin runs "🆕 Iniciar nuevo semestre" without first editing `CONFIG.semestre`, the alert-dedup keys collide with the previous semester's keys only if the string wasn't changed — but worse, if it *is* forgotten, all new-semester emails and the panorama header will silently display the old semester label, misleading staff about which cohort the numbers represent. There is no runtime validation that `CONFIG.semestre` actually changed since last reset.
- Fix approach: Store the "last reset semester" value in a script property or in `_Estado_Avisos`, and have `iniciarNuevoSemestre()` warn (not just remind via alert text) if `CONFIG.semestre` matches the previously recorded value.

**Hardcoded horario catalog requires manual sync with the live Google Form:**
- Issue: `CONFIG.horariosPorIdioma` (`src/Config.gs:39-55`) hardcodes the exact label text (hours, days, suffixes) that must byte-for-byte match (case-insensitively) the Form's checkbox option text. This already caused a real production bug fixed in v1.1.0 (see `CHANGELOG.md:12-14`: wrong hours for Alemán, missing Italiano entry, Inglés falling into `_default` with mismatched casing).
- Files: `src/Config.gs:39-55`, `src/Core.gs:149-166` (`parsearHorarios()`)
- Impact: Any time the Form's horario wording changes (new semester, new time slot, admin edits a typo in the Form), matching silently breaks for that option. `parsearHorarios()` only logs unmatched options via `Logger.log()` (`src/Core.gs:161`), which is invisible unless someone actively opens the Apps Script execution log.
- Fix approach: Surface unmatched-horario counts in the "🔄 Recalcular Panorama" completion alert (`recalcularPanoramaConAlerta()` in `src/Main.gs:25-42`) instead of only logging, so staff notice mismatches immediately after each recalculation.

**`Francés` has no dedicated horario catalog entry:**
- Issue: `CONFIG.horariosPorIdioma` has no `'Francés'` key and falls back to `_default` (`src/Config.gs:37-38, 51-54`), which is explicitly called out as unverified in the code comment ("sin datos reales aún").
- Files: `src/Config.gs:37-38`
- Impact: Once real Francés respondents submit the form, their horario labels may not match `_default`'s catalog, causing their registrations to be silently discarded (see "Known Bugs" below).
- Fix approach: Add a verified `'Francés'` entry as soon as the first real responses arrive, per the existing comment/AGENTS.md gotcha (`AGENTS.md:82`).

**Form column mapping relies on exact uppercase header-text matching:**
- Issue: `mapearColumnas()` (`src/Core.gs:75-102`) matches `CONFIG.formCols` values against the sheet's header row via exact uppercase string comparison, with a keyword fallback only for single-index fields (not for the branching `horarios`/`modalidad` fields, which use `buscarTodos()` with only exact match, no fallback).
- Files: `src/Core.gs:75-102`, `src/Config.gs:80-90`
- Impact: Any rewording of Form questions (even punctuation/accent changes) breaks column detection for `horarios`/`modalidad` with no fallback safety net, silently producing empty index arrays and losing all rows for that field.
- Fix approach: Extend `buscarTodos()` with an optional keyword-based fallback similar to `buscarUno()`, or add a startup check in `recalcularPanorama()` that fails loudly (not just via `throw` inside `leerRespuestas()`) when `horarios`/`modalidad` arrays are empty.

**No automated tests anywhere in the project:**
- Issue: There is no test framework, no test files, and no CI configuration in the repository.
- Files: N/A (absence confirmed across the whole `src/` directory and repo root)
- Impact: Every change (adding a language, adjusting the horario catalog, modifying `determinarNivel()`) is verified only by manual menu execution against live or sample data, as documented in `CHANGELOG.md:12` ("Al comparar el sistema contra 10 respuestas reales del formulario..."). Regressions like the ones fixed in v1.1.0 are likely to recur.
- Fix approach: Extract the pure functions in `src/Core.gs` (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) into logic that can be unit-tested with `clasp` + a local Node test runner (e.g., mock `CONFIG` and feed synthetic header/row arrays), since these functions have no direct `SpreadsheetApp`/`MailApp` dependency.

## Known Bugs

**Alert marked as sent even when the email was never actually delivered:**
- Symptoms: A bucket crosses the threshold, but the team never receives the notification email, and no future submission retries it for that semester.
- Files: `src/Alertas.gs:14-32` (`onFormSubmit`), specifically lines 25-26
- Trigger: In `onFormSubmit()`, the loop body calls `enviarAvisoUmbral(bucket)` followed unconditionally by `marcarComoAvisado(bucket)`. `enviarAvisoUmbral()` (`src/Alertas.gs:103-120`) silently returns without sending when `MailApp.getRemainingDailyQuota() <= 0` (line 104) — it does not throw, and does not signal failure back to the caller. Because `marcarComoAvisado()` runs regardless of whether the send succeeded, the bucket is permanently recorded as "already notified" in `_Estado_Avisos` (idempotency key includes `CONFIG.semestre`, not a date), and the notification for that bucket/semester is lost forever, even after quota resets the next day.
- Workaround: None automated. An admin would need to manually delete the corresponding row from the hidden `_Estado_Avisos` sheet and re-trigger `recalcularPanorama()`/`onFormSubmit`.
- Fix approach: Make `enviarAvisoUmbral()` return a boolean (or throw a distinguishable error), and only call `marcarComoAvisado()` when the send actually succeeded.

**A single unrecognized horario label discards the entire registration, not just that option:**
- Symptoms: A respondent who filled out the form correctly disappears entirely from the panorama and from "Personas únicas (nivel)" counts, with no visible error to staff.
- Files: `src/Core.gs:42-48` (`leerRespuestas()`), `src/Core.gs:149-166` (`parsearHorarios()`)
- Trigger: `parsearHorarios()` returns an empty array for any comma-separated checkbox value that doesn't match the catalog (logs via `Logger.log()` only). Back in `leerRespuestas()`, line 48 (`if (!idioma || !nivel || horarios.length === 0) continue;`) drops the whole row whenever `horarios` is empty — even if the respondent's idioma/nivel were parsed correctly. This conflates "no horario selected" with "horario selected but label mismatch," and the person's whole enrollment interest vanishes from all reporting.
- Workaround: Manually cross-check `Logger.log()` execution transcripts (Apps Script → Executions) after each recalculation, which is not part of the documented workflow.
- Fix approach: Track and surface a per-run count of rows discarded due to unmatched horario (distinct from rows with no horario answered at all) in the "🔄 Recalcular Panorama" alert dialog (`src/Main.gs:25-42`).

**Single exception aborts alert processing for all remaining buckets in that trigger run:**
- Symptoms: If sending one bucket's email throws (e.g., malformed address in `CONFIG.emailAvisos`, transient Gmail error, or a `MailApp` quota exception raised mid-send rather than caught by the pre-check), no further buckets in the same `onFormSubmit` invocation get evaluated or notified.
- Files: `src/Alertas.gs:14-32`
- Trigger: The `Object.values(buckets).forEach(...)` loop in `onFormSubmit()` has no per-bucket try/catch; only the outer function-level try/catch (line 15) exists, which logs and swallows the error for the *entire* invocation, not per-bucket.
- Workaround: The next form submission's trigger run will retry any buckets not yet marked in `_Estado_Avisos`, so the failure is usually self-healing but delayed and silent.
- Fix approach: Wrap the per-bucket `enviarAvisoUmbral`/`marcarComoAvisado` pair in its own try/catch inside the `forEach`, so one bucket's failure doesn't block others.

**No concurrency protection for simultaneous form submissions:**
- Symptoms: Two people submitting the form within moments of each other could trigger two concurrent `onFormSubmit()` executions, both of which call `recalcularPanorama()` (full read of the responses sheet + full rewrite of "Panorama de Cursos") and both read/write `_Estado_Avisos` independently.
- Files: `src/Alertas.gs:14-32`, `src/Panorama.gs:20-42`
- Trigger: Concurrent Google Form submissions during a busy enrollment window.
- Workaround: None; Apps Script does not automatically serialize installable triggers for the same script.
- Fix approach: Wrap the critical section in `LockService.getScriptLock()` (acquire/release around `recalcularPanorama()` + alert dispatch) to prevent interleaved writes and duplicate email sends.

## Security Considerations

**Unescaped interpolation of form-derived text into HTML output:**
- Risk: `getAvisoHtml()` (`src/Alertas.gs:122-159`) and `getPanoramaHtml()` (`src/Panorama.gs:126-167`) interpolate `bucket.idioma`, `bucket.nivel`, `bucket.horarioLabel`, and formatted modalidad text directly into HTML strings without escaping. `idioma`/`nivel` are constrained by `CONFIG` catalogs, but `modalidades` values come from `parsearModalidad()` (`src/Core.gs:172-175`), which passes through raw comma-split checkbox text with no whitelist/catalog check.
- Files: `src/Alertas.gs:122-159`, `src/Panorama.gs:126-167`, `src/Core.gs:172-175`
- Current mitigation: None. Risk is currently low because the underlying Form field is checkbox-based (limited to admin-defined options), not free text.
- Recommendations: If the Form's modalidad question is ever changed to accept free text, or if a new free-text field is piped through similarly, escape all interpolated values (e.g., a small `escapeHtml()` helper) before building HTML strings for the sidebar or email body.

**Test-alert menu accepts arbitrary destination email with no validation:**
- Risk: `probarAviso()` (`src/Main.gs:102-132`) reads an arbitrary string from `ui.prompt()` and passes it directly to `MailApp.sendEmail({ to: destino, ... })` with no email-format validation.
- Files: `src/Main.gs:102-132`
- Current mitigation: Only reachable by users with edit access to the container spreadsheet (menu item), and wrapped in a try/catch that surfaces GAS's own validation errors via `ui.alert()`.
- Recommendations: Low priority given the trusted-user-only surface, but a basic regex check before calling `sendEmail` would produce a clearer error message than the raw `MailApp` exception.

**PII (names, emails) stored in the Google Sheet with no additional access control layer:**
- Risk: `leerRespuestas()` captures full name and canonical Google account email per respondent (`src/Core.gs:50-58`) and holds them in memory during processing. They are never written to the "Panorama de Cursos" sheet (only aggregate counts appear there), but they persist in the "Respuestas de formulario 1" sheet indefinitely.
- Files: `src/Core.gs:50-58`, `src/Panorama.gs` (headers list, `src/Panorama.gs:7-10`, confirms no PII columns in output)
- Current mitigation: Access is governed entirely by Google Sheets' own sharing permissions on the container spreadsheet — no additional control exists in the script itself.
- Recommendations: Document expected sharing settings for the response sheet in the README/AGENTS.md if not already enforced institutionally (out of scope for the script itself, but worth flagging since the code has no independent access check).

## Performance Bottlenecks

**Full sheet read + full panorama rewrite on every single form submission:**
- Problem: `onFormSubmit()` calls `recalcularPanorama()` unconditionally on every trigger execution (`src/Alertas.gs:16`), which in turn calls `leerRespuestas()` — reading the *entire* responses sheet with `sheet.getDataRange().getValues()` (`src/Core.gs:12`) — and then fully clears and rewrites the "Panorama de Cursos" sheet (`escribirHojaPanorama()`, `src/Panorama.gs:44-91`), including a per-row `setBackground()` call in a loop (`src/Panorama.gs:84-88`).
- Files: `src/Core.gs:11-62`, `src/Panorama.gs:20-91`
- Cause: No incremental processing — every submission reprocesses the full history from row 1, and the per-row background-color loop makes individual `Range` API calls (not batched), which is one of the more expensive Sheets API patterns in Apps Script.
- Improvement path: Batch the background-color writes using `setBackgrounds()` with a 2D color array in a single call instead of looping `getRange(fila, COL_ESTADO).setBackground(color)` per row. For the full-read cost, this is likely acceptable at current enrollment volumes (tens to low hundreds of rows per semester) but will degrade as the sheet grows across multiple semesters if old data is never archived.

**No LockService means potential wasted/duplicate compute under concurrent triggers:**
- Problem: Concurrent `onFormSubmit()` executions (see "Known Bugs" above) each independently perform the full read/rewrite cycle, doubling (or more) Sheets API calls during high-traffic enrollment windows.
- Files: `src/Alertas.gs:14-32`
- Cause: No mutual exclusion around the recalculation + alert-dispatch critical section.
- Improvement path: Same fix as the concurrency bug above — `LockService.getScriptLock()`.

## Fragile Areas

**Duplicate-column parsing for branching Form sections (`horarios`/`modalidad`):**
- Files: `src/Core.gs:82-116` (`buscarTodos()`, `primeraCeldaNoVacia()`), `src/Config.gs:75-79`
- Why fragile: The Form repeats the same question text ("¿Cuál horario prefieres?", "¿Qué modalidad te acomoda más?") once per idioma-conditional branch, producing multiple columns with identical headers. `mapearColumnas()` collects all matching column indices, and `primeraCeldaNoVacia()` takes the first non-empty cell per row. This works only as long as: (1) exactly one of those columns is populated per row (guaranteed by the Form's own branching logic, not enforced by this code), and (2) any *new* field added with the same branching pattern also uses `buscarTodos()` + `primeraCeldaNoVacia()` rather than `buscarUno()` — a mistake explicitly warned against in `AGENTS.md:86` but not enforced by any runtime check or test.
- Safe modification: When adding a new branching field, follow the existing `horarios`/`modalidad` pattern exactly; do not use `buscarUno()`. Verify via "🔍 Detectar columnas del formulario" that all expected branch columns are found (array, not `-1`).
- Test coverage: None — this logic has no automated tests, only the documented manual verification against 10 real responses referenced in `CHANGELOG.md:12`.

**`determinarNivel()` matches on hardcoded Spanish substrings of the "conoce nivel" answer:**
- Files: `src/Core.gs:126-140`
- Why fragile: The function does `normalizarTexto(conoceNivelResp).indexOf('con exactitud')`, `.indexOf('principiante absoluto')`, `.indexOf('he tomado clases')` — three exact substring checks against the live Form's answer options. If the Form's answer wording is edited even slightly (e.g., "Soy un principiante absoluto" vs. "Soy principiante absoluto"), the row silently returns `''` for `nivel`, causing `leerRespuestas()` to discard the row entirely (line 48).
- Safe modification: Any Form wording change to the "¿Conoces tu nivel actual...?" question's options must be mirrored in these three substring checks. No fallback or fuzzy matching exists.
- Test coverage: None.

**`horariosPorIdioma` label matching is case-insensitive but not fuzzy on whitespace/punctuation beyond simple collapsing:**
- Files: `src/Core.gs:242-245` (`normalizarTexto()`), `src/Config.gs:39-55`
- Why fragile: `normalizarTexto()` only lowercases, trims, and collapses whitespace runs — it does not normalize punctuation, dashes, or accented-character variants. A Form option using a different dash character (en-dash vs. hyphen) or an extra period would silently fail to match.
- Safe modification: When updating `CONFIG.horariosPorIdioma`, copy the label text directly from the live Form (not retyped) to avoid subtle character mismatches.
- Test coverage: None.

## Scaling Limits

**Google Apps Script installable-trigger execution time limit (6 minutes):**
- Current capacity: At current enrollment volumes (per `CHANGELOG.md`, verified against ~10 real responses), full-sheet reprocessing on every submission is effectively instantaneous.
- Limit: If the responses sheet accumulates several thousand rows (e.g., data retained across many semesters without archiving), the O(n) full-sheet read/rewrite on every single form submission risks approaching Apps Script's execution time quota for triggers.
- Scaling path: Archive or move prior-semester rows out of the live "Respuestas de formulario 1" sheet (or filter `leerRespuestas()` by a semester/date boundary) once the sheet grows large; batch the panorama color-writing (see Performance section) to reduce per-call overhead.

**Gmail daily sending quota (`MailApp.getRemainingDailyQuota()`):**
- Current capacity: Consumer/free-tier Gmail quotas for Apps Script are limited (typically 100/day for consumer accounts, higher for Workspace); each threshold-crossing bucket sends one email per address in `CONFIG.emailAvisos` (currently one address).
- Limit: A single busy day with many buckets crossing threshold simultaneously (e.g., right after a marketing push) could exhaust the daily quota, and — per the "Known Bugs" section above — any bucket that fails to send due to exhausted quota is permanently marked as notified and never retried.
- Scaling path: Fix the "marked as sent even on failure" bug first (highest priority), then consider batching all threshold crossings from a single run into one digest email rather than one email per bucket, reducing quota consumption per trigger execution.

## Dependencies at Risk

**Live Google Form structure is the primary "dependency" and is not version-controlled:**
- Risk: The entire header-mapping (`CONFIG.formCols`), the horario catalog (`CONFIG.horariosPorIdioma`), and the level-detection substrings (`determinarNivel()`) all depend on the exact wording of a Google Form that is edited independently of this codebase, with no way to detect drift automatically.
- Impact: Any Form edit (question rewording, added/removed answer option, a new idioma branch) can silently break parsing for the affected respondents (see "Known Bugs" and "Fragile Areas").
- Migration plan: None currently — mitigated only by the manual "🔍 Detectar columnas del formulario" menu action (`src/Main.gs:138-169`), which must be run proactively by staff after any Form edit. Consider adding a lightweight automated diff (e.g., a scheduled time trigger that compares live headers against `CONFIG.formCols` and emails staff on mismatch).

## Missing Critical Features

**No visibility into discarded/unmatched rows after recalculation:**
- Problem: `leerRespuestas()` silently `continue`s past rows missing a valid email, idioma, nivel, or horario match (`src/Core.gs:30, 48`), with no aggregate reporting of how many rows were skipped or why. Combined with the fragile parsing described above, staff have no way to notice when real registrations are being dropped except by manually cross-referencing raw response counts against panorama totals.
- Blocks: Early detection of Form/catalog drift (the exact class of bug that caused the v1.1.0 fix per `CHANGELOG.md`).

**No per-bucket "who's interested" drill-down:**
- Problem: Names and emails are captured (`src/Core.gs:50-58`) but never surfaced anywhere in the panorama sheet or sidebar — only aggregate counts are shown (`HEADERS_PANORAMA` in `src/Panorama.gs:7-10` has no name/email column).
- Blocks: Staff following up individually with interested students (e.g., to notify them a course is opening, or to chase people who selected "Por evaluar" for a placement test) must go back to the raw responses sheet and manually filter by idioma/nivel/horario.

## Test Coverage Gaps

**All parsing/normalization logic (`src/Core.gs`):**
- What's not tested: `mapearColumnas()`, `parsearHorarios()`, `determinarNivel()`, `normalizarNombre()`, `normalizarIdioma()`, `normalizarNivel()`, `construirBuckets()`, `contarPersonasUnicasPorNivel()` — the entire data-transformation core of the project.
- Files: `src/Core.gs` (all functions)
- Risk: These are the functions most frequently touched when the Form changes each semester, and are exactly where the v1.1.0 bugs originated (per `CHANGELOG.md:8-16`). Regressions would only be caught by manual comparison against a handful of real responses, as was done for v1.1.0.
- Priority: High.

**Alert idempotency and quota-failure paths (`src/Alertas.gs`):**
- What's not tested: `onFormSubmit()`'s interaction between `enviarAvisoUmbral()` and `marcarComoAvisado()`, especially the quota-exhaustion silent-failure path described in "Known Bugs."
- Files: `src/Alertas.gs:14-32, 103-120`
- Risk: This is the mechanism most likely to fail silently in production with no visible symptom until staff notice a course never got announced.
- Priority: High.

**Panorama sheet writing (`src/Panorama.gs`):**
- What's not tested: `escribirHojaPanorama()`, `estadoParaConteo()`, `colorParaConteo()`, `formatearModalidades()`.
- Files: `src/Panorama.gs`
- Risk: Lower — these are simpler, more mechanical transformations with less business-logic complexity than `Core.gs`.
- Priority: Medium.

---

*Concerns audit: 2026-07-25*
