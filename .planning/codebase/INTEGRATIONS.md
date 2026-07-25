# External Integrations

**Analysis Date:** 2026-07-25

## APIs & External Services

**Google Workspace (native Apps Script services — no external SDKs/clients):**
- Google Sheets — `SpreadsheetApp` global service
  - Used for: reading form responses, writing the "Panorama de Cursos" summary sheet, and the hidden `_Estado_Avisos` state sheet
  - SDK/Client: built-in Apps Script global (`SpreadsheetApp`), no separate npm/SDK install
  - Auth: OAuth scope `https://www.googleapis.com/auth/spreadsheets.currentonly` (declared in `appsscript.json`); implicit via the container-bound script identity, no API key/token in code
- Gmail — `MailApp` global service
  - Used for: sending HTML threshold-crossing alert emails (`src/Alertas.gs` → `enviarAvisoUmbral()`) and test alert emails (`src/Main.gs` → `probarAviso()`)
  - SDK/Client: built-in Apps Script global (`MailApp`)
  - Auth: OAuth scope `https://www.googleapis.com/auth/gmail.send` (declared in `appsscript.json`)
  - Quota-aware: `MailApp.getRemainingDailyQuota()` is checked before every send (`src/Alertas.gs:104`) — if the quota is exhausted, the send is skipped and logged via `Logger.log()`, never thrown
- Apps Script triggers — `ScriptApp` global service
  - Used for: installing/reinstalling the `onFormSubmit` installable trigger (`src/Main.gs` → `instalarAutomatizacion()`)
  - SDK/Client: built-in Apps Script global (`ScriptApp`)
  - Auth: OAuth scope `https://www.googleapis.com/auth/script.scriptapp` (declared in `appsscript.json`)
- Google Forms (indirect) — no direct Forms API call. The Sheet is linked to a Google Form; form responses land as new rows in the sheet named by `CONFIG.hojas.respuestas` (`'Respuestas de formulario 1'`, `src/Config.gs`). The script never talks to the Forms API directly — it only reacts to the resulting spreadsheet row via the `onFormSubmit` trigger and reads/parses that row's cell values

**No third-party (non-Google) services detected** — no Stripe, no analytics, no external REST APIs, no HTTP fetch calls (`UrlFetchApp` is not used anywhere in `src/`).

## Data Storage

**Databases:**
- None. Google Sheets itself is the only data store.
  - Response data source (read-only): sheet `CONFIG.hojas.respuestas` = `'Respuestas de formulario 1'` — populated externally by the linked Google Form
  - Derived/output sheet (read-write): `CONFIG.hojas.panorama` = `'Panorama de Cursos'` — recreated/overwritten on every recalculation by `escribirHojaPanorama()` in `src/Panorama.gs`
  - Internal state sheet (read-write, hidden): `CONFIG.hojas.estadoAvisos` = `'_Estado_Avisos'` — tracks which `(semestre, idioma, nivel, horarioId)` buckets have already triggered an alert email, to prevent duplicate notifications (`src/Alertas.gs`); created via `obtenerOCrearHojaEstadoAvisos()` and hidden with `sheet.hideSheet()`
  - Connection: implicit — `SpreadsheetApp.getActiveSpreadsheet()` always refers to the single Sheet the script is bound to (container-bound project, no cross-spreadsheet access; enforced by the `spreadsheets.currentonly` OAuth scope)
  - Client/ORM: none — raw `Range`/`Sheet` API calls (`getDataRange().getValues()`, `getRange(...).setValues(...)`, `appendRow(...)`)

**File Storage:**
- None. No Google Drive API usage, no file uploads/attachments handled by the script.

**Caching:**
- None. Every recalculation (`recalcularPanorama()` in `src/Panorama.gs`) re-reads the entire response sheet from scratch via `sheet.getDataRange().getValues()` — no in-memory or persistent cache layer.

## Authentication & Identity

**Auth Provider:**
- Google account identity only, implicit through the Apps Script execution context and the OAuth scopes in `appsscript.json`. There is no application-level login/session system.
- "Identity" of a respondent is captured from the Form's auto-collected "Dirección de correo electrónico" column (the signed-in Google account that submitted the form), mapped via `CONFIG.formCols.email` in `src/Config.gs` and normalized in `normalizarEmail()` (`src/Core.gs`) — explicitly NOT a free-typed email field, to avoid duplicate/typo'd identities (see `AGENTS.md` "Correo canónico").
- No JWT/session tokens, no user database — deduplication of "unique persons" is done purely via email-string matching in `contarPersonasUnicasPorNivel()` (`src/Core.gs`).

## Monitoring & Observability

**Error Tracking:**
- Google Stackdriver (Cloud Logging), enabled via `"exceptionLogging": "STACKDRIVER"` in `appsscript.json`. This is the platform-level exception log for uncaught errors in the Apps Script project; no custom error-tracking SDK (e.g., Sentry) is integrated.

**Logs:**
- `Logger.log(...)` calls used for diagnostic, non-fatal logging:
  - `src/Core.gs` (`parsearHorarios()`) — logs unrecognized schedule option strings that fail to match the `CONFIG.horariosPorIdioma` catalog
  - `src/Alertas.gs` (`onFormSubmit()`) — logs any error caught in the trigger handler instead of rethrowing, so a script error never blocks the Form response from being recorded
  - `src/Alertas.gs` (`enviarAvisoUmbral()`) — logs when Gmail's daily quota is exhausted and a send is skipped
- No structured logging framework, no external log aggregation.

## CI/CD & Deployment

**Hosting:**
- Google Apps Script platform itself (script bound to a Google Sheet). No separate hosting/server — this is not a web app deployment (`doGet`/`doPost` are not implemented; only container-bound triggers and menu-invoked functions).

**CI Pipeline:**
- None. No `.github/workflows`, no clasp-based push/deploy scripts. Deployment is entirely manual: copy `.gs` file contents from `src/` into the Apps Script web editor, and paste `appsscript.json` contents into the editor's manifest (`README.md` "🚀 Instalación").

## Environment Configuration

**Required env vars:**
- None (not applicable — Apps Script has no environment-variable mechanism). All tunables live in the `CONFIG` object in `src/Config.gs`: `semestre`, `umbralMinimo`, `emailAvisos`, `idiomas`, `niveles`, `horariosPorIdioma`, `nivelPrincipiante`, `nivelPorEvaluar`, `hojas`, `formCols`, `colores`.

**Secrets location:**
- No secrets are stored or required in this codebase. No API keys, tokens, or credentials appear anywhere in `src/` or `appsscript.json` — all access is via the ambient OAuth scopes granted to the container-bound script identity when a project maintainer authorizes it in the Apps Script editor.

## Webhooks & Callbacks

**Incoming:**
- Installable trigger `onFormSubmit` (`src/Alertas.gs`), registered on the bound spreadsheet via `ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit().create()` in `instalarAutomatizacion()` (`src/Main.gs`). This is Google's internal event delivery (new Form response → new sheet row → trigger fires) — not an HTTP webhook endpoint. There is no `doGet()`/`doPost()` web app entry point in this project.
- Note (operational gotcha, per `AGENTS.md`): this trigger is NOT copied when the Sheet/Form is duplicated for a new semester — it must be manually reinstalled each semester via the "🔔 Instalar/Reinstalar automatización" menu item, or `onFormSubmit` silently never fires.

**Outgoing:**
- Outbound HTML emails via `MailApp.sendEmail(...)`:
  - Threshold-crossing alert to `CONFIG.emailAvisos` recipients (`src/Alertas.gs` → `enviarAvisoUmbral()`, HTML built by `getAvisoHtml()`)
  - Ad-hoc test alert to a user-specified address (`src/Main.gs` → `probarAviso()`)
- No outbound webhooks/HTTP calls to third-party systems (`UrlFetchApp` not used anywhere in `src/`).

---

*Integration audit: 2026-07-25*
