<!-- refreshed: 2026-07-25 -->
# Architecture

**Analysis Date:** 2026-07-25

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    ENTRY POINTS / TRIGGERS                   │
├──────────────────────────┬────────────────────────────────────┤
│  onOpen() → menu          │  onFormSubmit() → installable      │
│  `src/Main.gs`            │  trigger  `src/Alertas.gs`          │
└────────────┬──────────────┴───────────────┬────────────────────┘
             │                               │
             ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  ORCHESTRATION (Main.gs)                     │
│  recalcularPanoramaConAlerta(), instalarAutomatizacion(),     │
│  iniciarNuevoSemestre(), probarAviso(), detectarColumnas()    │
└────────────┬──────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│              AGGREGATION (Panorama.gs)                       │
│  recalcularPanorama() : Sheet → inscripciones → buckets       │
│  `src/Panorama.gs`                                            │
└──────┬───────────────────────────────────────┬────────────────┘
       │ reads/normalizes                      │ writes
       ▼                                        ▼
┌───────────────────────────┐      ┌──────────────────────────────┐
│  READ + NORMALIZE (Core)   │      │  SHEET OUTPUT                │
│  leerRespuestas(),          │      │  "Panorama de Cursos" +       │
│  mapearColumnas(),          │      │  sidebar HTML                │
│  parsearHorarios(),         │      │  `src/Panorama.gs`            │
│  construirBuckets()         │      └──────────────────────────────┘
│  `src/Core.gs`              │
└──────────────┬──────────────┘
               │ buckets returned to caller
               ▼
┌─────────────────────────────────────────────────────────────┐
│         THRESHOLD DETECTION + EMAIL (Alertas.gs)              │
│  onFormSubmit() re-checks buckets vs CONFIG.umbralMinimo,     │
│  dedups via hidden sheet "_Estado_Avisos", sends MailApp email│
│  `src/Alertas.gs`                                              │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                  CONFIG (Config.gs) — read by all layers      │
│  umbralMinimo, idiomas, niveles, horariosPorIdioma, formCols,  │
│  hojas, colores   `src/Config.gs`                              │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| CONFIG | Single source of institutional configuration: threshold, language/level/schedule catalog, sheet names, form column mapping, colors | `src/Config.gs` |
| Core | Reads raw form-response rows, detects/maps columns, normalizes fields, resolves level, parses checkbox cells, aggregates into buckets and unique-person counts | `src/Core.gs` |
| Panorama | Orchestrates read→aggregate→write cycle for the "Panorama de Cursos" sheet; renders sidebar HTML dashboard | `src/Panorama.gs` |
| Alertas | Detects buckets that just crossed the threshold, deduplicates via hidden `_Estado_Avisos` sheet, sends HTML email via MailApp | `src/Alertas.gs` |
| Main | Installs custom UI menu (`onOpen`), wires menu items to handlers, installs/reinstalls the `onFormSubmit` trigger, semester reset flow, column-detection helper, help dialog | `src/Main.gs` |

## Pattern Overview

**Overall:** Layered script-global pipeline (no classes, no modules) — a linear ETL-style pipeline (read → normalize → aggregate → write/notify) implemented as global functions sharing one script-wide namespace, characteristic of container-bound Google Apps Script projects.

**Key Characteristics:**
- No `import`/`require` — all five `.gs` files are concatenated into one global scope at runtime by the Apps Script engine; execution order in the editor does not matter, only function/variable names matter.
- Single global `CONFIG` object (`src/Config.gs`) acts as the only configuration surface; every other file reads from it, nothing hardcodes institutional values.
- State persistence is entirely spreadsheet-based — there is no database. Two "hidden" state surfaces exist: the visible "Panorama de Cursos" sheet (derived, disposable, recomputed) and the hidden `_Estado_Avisos` sheet (durable notification dedup log).
- Idempotent notification design: `onFormSubmit` recomputes the *entire* panorama from scratch on every single form submission (full recompute, not incremental), then filters for buckets that (a) meet threshold and (b) are not yet marked as notified.

## Layers

**Configuration Layer:**
- Purpose: Centralize all institutional constants (threshold, catalogs, sheet names, form column headers, colors) so no other file hardcodes values.
- Location: `src/Config.gs`
- Contains: `const CONFIG = {...}` object only, no functions.
- Depends on: Nothing.
- Used by: `src/Core.gs`, `src/Panorama.gs`, `src/Alertas.gs`, `src/Main.gs` (all reference `CONFIG.*` directly as a global).

**Data Access / Normalization Layer:**
- Purpose: Turn raw spreadsheet rows from the Google Form response sheet into a clean, typed-in-spirit list of "inscripción" objects, and aggregate those into count buckets.
- Location: `src/Core.gs`
- Contains: `leerRespuestas()`, `mapearColumnas()`, `primeraCeldaNoVacia()`, `determinarNivel()`, `parsearHorarios()`, `parsearModalidad()`, `construirBuckets()`, `contarPersonasUnicasPorNivel()`, `obtenerLabelHorario()`, and a normalization block (`normalizarTexto`, `normalizarEmail`, `normalizarIdioma`, `normalizarNivel`, `normalizarNombre`).
- Depends on: `CONFIG` (catalogs, formCols), `SpreadsheetApp` service (via the sheet object passed in), `Logger` (unmatched-schedule logging).
- Used by: `src/Panorama.gs` (`recalcularPanorama()` calls `leerRespuestas`/`construirBuckets`/`contarPersonasUnicasPorNivel`), `src/Main.gs` (`detectarColumnas()` calls `mapearColumnas` directly).

**Presentation / Output Layer:**
- Purpose: Materialize the aggregated buckets into the visible "Panorama de Cursos" sheet (colored semáforo rows) and into an on-demand sidebar HTML view.
- Location: `src/Panorama.gs`
- Contains: `recalcularPanorama()` (orchestrator that also returns buckets for Alertas to reuse), `escribirHojaPanorama()`, `formatearModalidades()`, `estadoParaConteo()`, `colorParaConteo()`, `showPanoramaSidebar()`, `getPanoramaHtml()`.
- Depends on: `src/Core.gs` (aggregation functions), `CONFIG` (colors, sheet names, threshold), `SpreadsheetApp`/`HtmlService`/`Utilities` services.
- Used by: `src/Main.gs` (menu items), `src/Alertas.gs` (`onFormSubmit()` calls `recalcularPanorama()` to get fresh buckets).

**Notification / Alerting Layer:**
- Purpose: Detect buckets that just crossed the minimum-enrollment threshold and send exactly one email per bucket per semester, using a persisted dedup log.
- Location: `src/Alertas.gs`
- Contains: `onFormSubmit()` (trigger handler), `claveBucket()`, `leerEstadoAvisos()`, `marcarComoAvisado()`, `obtenerOCrearHojaEstadoAvisos()`, `limpiarEstadoAvisos()`, `enviarAvisoUmbral()`, `getAvisoHtml()`.
- Depends on: `src/Panorama.gs` (`recalcularPanorama()`), `CONFIG` (threshold, semester, email recipients, colors, sheet names), `MailApp`/`SpreadsheetApp`/`Utilities` services.
- Used by: The installable `onFormSubmit` trigger (installed by `src/Main.gs`); `src/Main.gs` also calls `limpiarEstadoAvisos()` during semester reset and `getAvisoHtml()` during the test-email flow.

**Orchestration / UI Layer:**
- Purpose: Bind everything to a human-facing custom menu and provide operational entry points (recompute, install trigger, semester reset, test email, column detection, help).
- Location: `src/Main.gs`
- Contains: `onOpen()`, `recalcularPanoramaConAlerta()`, `instalarAutomatizacion()`, `iniciarNuevoSemestre()`, `probarAviso()`, `detectarColumnas()`, `showHelp()`.
- Depends on: `src/Panorama.gs`, `src/Alertas.gs`, `src/Core.gs` (`mapearColumnas()`), `CONFIG`, `SpreadsheetApp.getUi()`, `ScriptApp` (trigger management).
- Used by: End users via the Sheets UI menu; `ScriptApp` invokes `onFormSubmit` (defined in Alertas.gs) as an installable trigger set up here.

## Data Flow

### Primary Request Path (form submission → panorama update → email)

1. A respondent submits the linked Google Form; Google Forms writes a new row to the "Respuestas de formulario 1" sheet, which fires the installed trigger `onFormSubmit(e)` (`src/Alertas.gs:14`).
2. `onFormSubmit` calls `recalcularPanorama()` (`src/Panorama.gs:20`), which:
   a. Reads the full response sheet via `leerRespuestas(sheetRespuestas)` (`src/Core.gs:11`) — maps headers to column indices (`mapearColumnas`, `src/Core.gs:75`), normalizes each row (email, idioma, nivel via `determinarNivel`, horarios via `parsearHorarios`, modalidad via `parsearModalidad`), and discards rows missing a valid email, idioma, nivel, or recognized horario.
   b. Aggregates the normalized inscripciones into buckets keyed by `idioma||nivel||horarioId` via `construirBuckets()` (`src/Core.gs:184`) and computes unique-person counts per (idioma, nivel) via `contarPersonasUnicasPorNivel()` (`src/Core.gs:217`).
   c. Writes the full "Panorama de Cursos" sheet from scratch via `escribirHojaPanorama()` (`src/Panorama.gs:44`), coloring each row's ESTADO cell per `colorParaConteo()`.
3. Back in `onFormSubmit`, buckets whose `count >= CONFIG.umbralMinimo` are checked against `leerEstadoAvisos()` (`src/Alertas.gs:42`, reads the hidden `_Estado_Avisos` sheet filtered by current `CONFIG.semestre`).
4. For each bucket not yet notified: `enviarAvisoUmbral(bucket)` sends an HTML email via `MailApp.sendEmail` (`src/Alertas.gs:103`, quota-checked first), then `marcarComoAvisado(bucket)` appends a row to `_Estado_Avisos` (`src/Alertas.gs:58`).
5. Any error in the chain is caught inside `onFormSubmit`'s try/catch and only logged (`Logger.log`) — it never propagates, so a bug here cannot block the Form's own response recording (`src/Alertas.gs:28-31`).

### Manual Recompute Path (menu-triggered)

1. User clicks "🔄 Recalcular Panorama" in the custom menu → `recalcularPanoramaConAlerta()` (`src/Main.gs:25`).
2. Same `recalcularPanorama()` pipeline as above runs, but the result is only summarized in a `ui.alert()` dialog — no email dedup/send logic runs on this path (alerting only happens via `onFormSubmit`).

### Sidebar View Path

1. User clicks "📊 Ver Panorama" → `showPanoramaSidebar()` (`src/Panorama.gs:118`) — recomputes the panorama (fresh data) and renders `getPanoramaHtml(buckets)` into an `HtmlService` sidebar, sorted by count descending.

**State Management:**
- No in-memory or cross-execution state; every entry point recomputes from the raw response sheet on demand (Apps Script executions are stateless/short-lived).
- Durable state lives only in two spreadsheet sheets: "Panorama de Cursos" (fully overwritten each run — purely derived/disposable) and `_Estado_Avisos` (append-only log, the only durable record of what's already been emailed; must be explicitly cleared via `limpiarEstadoAvisos()` for a new semester).

## Key Abstractions

**Inscripción (enrollment record):**
- Purpose: Represents one valid, normalized form response row.
- Shape: `{ rowIndex, nombre, email, idioma, nivel, horarios: [horarioId], modalidades: [string] }`
- Examples: constructed in `leerRespuestas()` (`src/Core.gs:50-58`)
- Pattern: Rows failing validation (missing email/@ / idioma / nivel / horarios) are silently skipped (`continue`), never raise.

**Bucket (aggregation unit):**
- Purpose: Represents one (idioma, nivel, horarioId) combination and its interest count.
- Shape: `{ idioma, nivel, horarioId, horarioLabel, count, emails: Set, modalidades: {texto: count} }`
- Examples: built in `construirBuckets()` (`src/Core.gs:184-210`), consumed in `escribirHojaPanorama()` and `onFormSubmit()`.
- Pattern: `count` can overcount a single person who checked multiple schedules; the parallel `personasUnicas` map (keyed `idioma||nivel`) is the counterweight, surfaced as its own panorama column.

**Catalog-driven matching (`CONFIG.horariosPorIdioma`):**
- Purpose: Canonical list of valid schedule blocks per language, each with a stable `id` (internal key) and `label` (must textually match the Form's checkbox option).
- Examples: `src/Config.gs:39-55`, matched in `parsearHorarios()` (`src/Core.gs:149-166`) via `normalizarTexto()` (case-insensitive, whitespace-collapsed) comparison. Non-matching labels are silently dropped from the count and only logged.
- Pattern: A `_default` catalog entry is used for languages without their own entry (e.g., 'Francés' as of 2026-07 per `src/Config.gs:37-38`).

**Conditional-branch column resolution (`buscarTodos` + `primeraCeldaNoVacia`):**
- Purpose: The Google Form repeats "¿Cuál horario prefieres?" / "¿Qué modalidad te acomoda más?" once per language branch (conditional section jump), producing duplicate-header columns in the response sheet where only one is populated per row.
- Examples: `mapearColumnas()`'s `buscarTodos()` helper (`src/Core.gs:82-89`) returns *all* matching column indices for these two fields (arrays, not a single index); `primeraCeldaNoVacia()` (`src/Core.gs:108-116`) picks the first non-empty cell among them per row.
- Pattern: Any future form field using the same per-language branching pattern must use `buscarTodos()` + `primeraCeldaNoVacia()`, not the single-index `buscarUno()` (documented gotcha in `AGENTS.md`).

## Entry Points

**`onOpen()`** (`src/Main.gs:7`):
- Triggers: Automatically on spreadsheet open (simple trigger).
- Responsibilities: Builds the "🎓 Inscripciones" custom menu and binds each item to its handler function.

**`onFormSubmit(e)`** (`src/Alertas.gs:14`):
- Triggers: Installable trigger fired by a new Google Form response row; must be (re)installed via the menu after every spreadsheet/form duplication (installable triggers are not copied automatically).
- Responsibilities: Full recompute of the panorama + threshold-crossing email dispatch with dedup. Wrapped in try/catch that never rethrows.

**Menu handlers in `src/Main.gs`** (invoked only via the Sheets UI menu, not programmatically chained):
- `recalcularPanoramaConAlerta()`, `showPanoramaSidebar()` (in `src/Panorama.gs`), `instalarAutomatizacion()`, `iniciarNuevoSemestre()`, `probarAviso()`, `detectarColumnas()`, `showHelp()`.

## Architectural Constraints

- **Threading:** Single-threaded, single-execution-per-invocation. Apps Script has no worker/thread model; concurrent trigger firings (e.g., rapid-fire form submissions) could theoretically race on `_Estado_Avisos` reads/writes, but no locking (`LockService`) is used anywhere in the codebase.
- **Global state:** `CONFIG` (`src/Config.gs`) and `HEADERS_PANORAMA`/`COL_ESTADO` (`src/Panorama.gs:7-13`) and `HEADERS_ESTADO_AVISOS` (`src/Alertas.gs:7`) are module-level constants shared across the entire global scope; there is no encapsulation preventing any file from mutating them at runtime (though none currently do).
- **No import graph / no circular imports possible:** All `.gs` files share one flat global namespace by design of the Apps Script runtime — "dependencies" between files are implicit (function name references), not declared. `src/Config.gs` must define `CONFIG` before any other file's functions execute, but since Apps Script loads all files before any trigger fires, load order in the editor does not matter for correctness.
- **Execution time limits:** Apps Script enforces a 6-minute (consumer)/30-minute (Workspace) execution cap per run. `recalcularPanorama()` does a full sheet re-read and re-aggregate on every single form submission — this is a scaling constraint if the response sheet grows very large (see CONCERNS.md-equivalent note: no incremental/append-only recompute path exists).
- **Gmail quota:** `enviarAvisoUmbral()` checks `MailApp.getRemainingDailyQuota()` before sending (`src/Alertas.gs:104`), but does not queue/retry on exhaustion — a bucket that crosses threshold while quota is exhausted is marked "not yet notified" only if `enviarAvisoUmbral` returns before `marcarComoAvisado` is called, so it will be retried on the next submission (this is intentional: `marcarComoAvisado` is only called after `enviarAvisoUmbral`, and the quota-exhausted path returns early without marking).

## Anti-Patterns

### Full recompute on every trigger firing

**What happens:** `onFormSubmit()` calls `recalcularPanorama()`, which re-reads and re-aggregates the *entire* response sheet from row 1, on every single form submission (`src/Alertas.gs:16`, `src/Panorama.gs:28`).
**Why it's wrong:** As the response sheet grows across a semester, each submission triggers an O(n) re-scan of all prior rows plus a full rewrite of the panorama sheet, increasing latency and execution-time risk per submission.
**Do this instead:** For this project's scale (per-semester enrollment, hundreds of rows), this is an accepted tradeoff for simplicity/correctness (guarantees the panorama is always fully consistent); if response volume grows significantly, consider incremental bucket updates keyed off `e.range` in the trigger event object instead of a full re-read.

### Silent discard on schedule-label mismatch

**What happens:** `parsearHorarios()` (`src/Core.gs:149-166`) silently drops any Form checkbox value that doesn't exactly match (case/whitespace-insensitive) a `label` in `CONFIG.horariosPorIdioma`, only recording a `Logger.log()` line that nobody reviews unless actively checking Apps Script execution logs.
**Why it's wrong:** A form-text change (e.g., a Form editor tweaking hour ranges) silently drops that schedule from all counts with no visible error to end users — the panorama would just under-report without indication that data is missing (documented as a known gotcha in `AGENTS.md`).
**Do this instead:** Continue relying on periodic manual checks via "🔍 Detectar columnas del formulario" plus the `AGENTS.md` gotcha note; if this recurs, consider surfacing unmatched-schedule counts directly in the panorama sheet or an alert email rather than only `Logger.log`.

## Error Handling

**Strategy:** Try/catch at the boundary of each entry point (menu handlers and the trigger handler), never inside the internal pipeline functions themselves.

**Patterns:**
- Trigger handler (`onFormSubmit`, `src/Alertas.gs:14-32`): catches all errors, logs via `Logger.log`, and deliberately does not rethrow — an internal bug must never block the underlying Form response from being recorded.
- Menu handlers (`src/Main.gs`): catch errors and surface them to the user via `ui.alert('❌ Error', error.message, ...)` (e.g., `recalcularPanoramaConAlerta()` at `src/Main.gs:39-41`, `probarAviso()` at `src/Main.gs:129-131`) — no silent failure for user-initiated actions.
- Internal validation (`src/Core.gs:18-23`): `leerRespuestas()` throws a descriptive `Error` if the minimum required columns (email, idioma) aren't found, directing the user to the "🔍 Detectar columnas" menu item.

## Cross-Cutting Concerns

**Logging:** `Logger.log()` only (Apps Script's built-in logger, viewable in the Apps Script editor's execution log / Stackdriver per `appsscript.json`'s `exceptionLogging: STACKDRIVER`). Used for unmatched-schedule warnings (`src/Core.gs:161`) and caught-error diagnostics (`src/Alertas.gs:29`, `src/Alertas.gs:105`). No structured logging or external log aggregation.

**Validation:** Row-level validation happens inline during normalization in `leerRespuestas()` — rows missing required fields are skipped, not rejected with a hard error. Sheet-level validation (missing required columns, missing "Respuestas de formulario 1" sheet) throws a descriptive `Error` that bubbles to the calling menu handler's try/catch.

**Authentication/Authorization:** None in-app — access control is entirely delegated to Google Sheets/Forms sharing permissions. OAuth scopes are declared in `appsscript.json` (`spreadsheets.currentonly`, `gmail.send`, `script.scriptapp`) and requested once at trigger-installation time (`instalarAutomatizacion()`).

---

*Architecture analysis: 2026-07-25*
