<!-- GSD:project-start source:PROJECT.md -->

## Project

**Panorama de Inscripciones — IDIOMAS PUCV**

A Google Apps Script automation, container-bound to a Google Sheet, that processes responses from IDIOMAS PUCV's language-course enrollment interest form. It normalizes each response (idioma, nivel, horario, modalidad), maintains a live "Panorama de Cursos" sheet showing 🟢/🟡/⚪ status per (idioma, nivel, horario) combination against a minimum-enrollment threshold, and emails the team automatically the moment a combination crosses that threshold. Already built and in production use (v1.1.0 shipped); this milestone hardens it rather than adding new user-facing behavior.

**Core Value:** Staff can trust the Panorama and its alerts completely — no silently dropped registrations, no silently failed notifications, and no reliance on someone reading Apps Script execution logs to know something went wrong.

### Constraints

- **Platform**: Google Apps Script V8 runtime, container-bound to the enrollment Google Sheet — no standalone deployment target
- **Tech stack**: No new frameworks/languages; stay within Apps Script's built-in services (`SpreadsheetApp`, `MailApp`, `ScriptApp`, `HtmlService`, `Utilities`, `Logger`) unless a Key Decision below says otherwise
- **Scope**: No new user-facing features this milestone — hardening and readability only, confirmed with the user
- **Gmail quota**: Alert sending is subject to Gmail's daily sending quota; fixes must account for this rather than assume unlimited retries
- **Non-technical maintainers**: Semester-to-semester handoff must remain usable by IDIOMAS PUCV staff without coding knowledge — readability/documentation work should be written for that audience

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- Google Apps Script (JavaScript, ES5/ES6-ish subset on V8 runtime) - all `.gs` files under `src/`: `src/Config.gs`, `src/Core.gs`, `src/Panorama.gs`, `src/Alertas.gs`, `src/Main.gs`
- HTML (inline template strings, not separate `.html` files) - embedded in `src/Panorama.gs` (`getPanoramaHtml()`) and `src/Alertas.gs` (`getAvisoHtml()`) for sidebar UI and email bodies
- Markdown - documentation: `README.md`, `AGENTS.md`, `CHANGELOG.md`

## Runtime

- Google Apps Script V8 runtime (`"runtimeVersion": "V8"` in `appsscript.json`)
- Container-bound to a Google Sheet (the sheet holding the enrollment Form responses) — there is no standalone deployment; the script executes inside the Google Sheets/Apps Script execution environment
- Timezone fixed to `America/Santiago` (`"timeZone"` in `appsscript.json`), used for date formatting via `Utilities.formatDate()` in `src/Panorama.gs` and `src/Alertas.gs`
- None. This is a classic (non-clasp) Apps Script project — no `package.json`, no npm/yarn/pnpm, no `node_modules`
- Deployment is manual copy-paste: `.gs` files from `src/` are pasted directly into the Apps Script editor bound to the Sheet, and `appsscript.json` contents are pasted into the editor's manifest file (see `README.md` "🚀 Instalación" section)
- No lockfile (not applicable — no external JS packages are installed)

## Frameworks

- None (no application framework). Uses only built-in Apps Script global services (`SpreadsheetApp`, `MailApp`, `ScriptApp`, `HtmlService`, `Utilities`, `Logger`) — all `.gs` files share one global scope, no `import`/`require`/modules
- None detected. No test framework, no test files, no `*.test.*`/`*.spec.*` files in the repository
- None. No bundler, no transpiler, no linter/formatter config found (no `.eslintrc*`, no `.prettierrc*`, no `tsconfig.json`)
- No CI/CD pipeline files (no `.github/workflows/`, no `.gitlab-ci.yml`)

## Key Dependencies

- None — zero third-party libraries or npm packages. All functionality is implemented using native Apps Script global services (see appsscript.json `oauthScopes` below) plus vanilla JavaScript
- `SpreadsheetApp` (built-in Apps Script service) - reads/writes the bound Google Sheet; used throughout `src/Panorama.gs`, `src/Alertas.gs`, `src/Main.gs`
- `MailApp` (built-in) - sends HTML notification emails; used in `src/Alertas.gs` (`enviarAvisoUmbral()`) and `src/Main.gs` (`probarAviso()`)
- `ScriptApp` (built-in) - manages the installable `onFormSubmit` trigger; used in `src/Main.gs` (`instalarAutomatizacion()`)
- `HtmlService` (built-in) - renders the sidebar dashboard; used in `src/Panorama.gs` (`showPanoramaSidebar()`)
- `Utilities` (built-in) - date formatting (`Utilities.formatDate`); used in `src/Panorama.gs` and `src/Alertas.gs`
- `Logger` (built-in) - diagnostic logging (Stackdriver-backed, per manifest `"exceptionLogging": "STACKDRIVER"`); used in `src/Core.gs` and `src/Alertas.gs`

## Configuration

- No `.env` files or environment-variable mechanism (not applicable to Apps Script's execution model)
- All configuration lives in a single global `CONFIG` object defined in `src/Config.gs`: current semester (`semestre`), minimum-enrollment threshold (`umbralMinimo`), alert recipient list (`emailAvisos`), offered languages (`idiomas`), offered levels (`niveles`), per-language schedule catalog (`horariosPorIdioma`), level-resolution fallbacks (`nivelPrincipiante`, `nivelPorEvaluar`), sheet name mapping (`hojas`), form column header mapping (`formCols`), and institutional brand colors (`colores`)
- Per project convention (see `AGENTS.md` "Code Patterns"), any institutional value must live in `CONFIG` — never hardcoded elsewhere
- `appsscript.json` is the only "build"/manifest config — declares timezone, runtime version, exception logging target, and OAuth scopes. It has no `dependencies` entry (empty `{}`), confirming there are no Apps Script library dependencies either

## Platform Requirements

- A Google account with edit access to the target Google Sheet/Form and its bound Apps Script project
- Browser-based Apps Script editor (script.google.com) — no local dev environment, no local runtime install (Node, etc.) needed for this project
- Manual deployment workflow: copy `src/*.gs` into the Apps Script editor's script files, and `appsscript.json` contents into the editor's manifest (see `README.md` step 2)
- Runs entirely inside Google's infrastructure as a container-bound script attached to a specific Google Sheet
- OAuth scopes requested (from `appsscript.json`):
- Subject to Gmail daily sending quota; `src/Alertas.gs` (`enviarAvisoUmbral()`) explicitly checks `MailApp.getRemainingDailyQuota()` before sending and logs (does not throw) if quota is exhausted
- Requires the installable `onFormSubmit` trigger to be (re)installed manually each time the Sheet/Form is duplicated (e.g., new semester) — triggers do not copy with the sheet; see `instalarAutomatizacion()` in `src/Main.gs`

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Language Split: Spanish-Domain, English-Infra

- **Spanish** for everything that maps to the business domain: function names, variable names, config keys, comments, log messages, UI strings (menu items, alerts, sidebar/email HTML), commit-adjacent docs (`CHANGELOG.md`, `README.md`).
- **English** only for platform/API surface that Google Apps Script itself defines: global lifecycle hooks (`onOpen`, `onFormSubmit`), and all Apps Script service/class names (`SpreadsheetApp`, `MailApp`, `HtmlService`, `ScriptApp`, `Logger`, `Utilities`).

## File Naming and Organization

| File | Owns |
|---|---|
| `src/Config.gs` | All configuration constants (`CONFIG` object) — single source of truth |
| `src/Core.gs` | Reading, normalizing, aggregating form responses |
| `src/Panorama.gs` | Building/writing the "Panorama de Cursos" sheet + sidebar |
| `src/Alertas.gs` | Threshold-crossing detection + duplicate-safe email dispatch |
| `src/Main.gs` | Menu (`onOpen`), all menu-handler entry points |

## Naming Patterns

## Code Style

- 2-space indentation
- Single quotes for strings, template literals (`` ` ``) only when interpolating
- Semicolons always
- `const`/`let` only — no `var`
- Arrow functions for callbacks (`.map`, `.forEach`, `.filter`, `.find`, `.sort`), named `function` declarations for top-level module functions

## Comment Style

## Error Handling

## Function Design

## Module Design

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- No `import`/`require` — all five `.gs` files are concatenated into one global scope at runtime by the Apps Script engine; execution order in the editor does not matter, only function/variable names matter.
- Single global `CONFIG` object (`src/Config.gs`) acts as the only configuration surface; every other file reads from it, nothing hardcodes institutional values.
- State persistence is entirely spreadsheet-based — there is no database. Two "hidden" state surfaces exist: the visible "Panorama de Cursos" sheet (derived, disposable, recomputed) and the hidden `_Estado_Avisos` sheet (durable notification dedup log).
- Idempotent notification design: `onFormSubmit` recomputes the *entire* panorama from scratch on every single form submission (full recompute, not incremental), then filters for buckets that (a) meet threshold and (b) are not yet marked as notified.

## Layers

- Purpose: Centralize all institutional constants (threshold, catalogs, sheet names, form column headers, colors) so no other file hardcodes values.
- Location: `src/Config.gs`
- Contains: `const CONFIG = {...}` object only, no functions.
- Depends on: Nothing.
- Used by: `src/Core.gs`, `src/Panorama.gs`, `src/Alertas.gs`, `src/Main.gs` (all reference `CONFIG.*` directly as a global).
- Purpose: Turn raw spreadsheet rows from the Google Form response sheet into a clean, typed-in-spirit list of "inscripción" objects, and aggregate those into count buckets.
- Location: `src/Core.gs`
- Contains: `leerRespuestas()`, `mapearColumnas()`, `primeraCeldaNoVacia()`, `determinarNivel()`, `parsearHorarios()`, `parsearModalidad()`, `construirBuckets()`, `contarPersonasUnicasPorNivel()`, `obtenerLabelHorario()`, and a normalization block (`normalizarTexto`, `normalizarEmail`, `normalizarIdioma`, `normalizarNivel`, `normalizarNombre`).
- Depends on: `CONFIG` (catalogs, formCols), `SpreadsheetApp` service (via the sheet object passed in), `Logger` (unmatched-schedule logging).
- Used by: `src/Panorama.gs` (`recalcularPanorama()` calls `leerRespuestas`/`construirBuckets`/`contarPersonasUnicasPorNivel`), `src/Main.gs` (`detectarColumnas()` calls `mapearColumnas` directly).
- Purpose: Materialize the aggregated buckets into the visible "Panorama de Cursos" sheet (colored semáforo rows) and into an on-demand sidebar HTML view.
- Location: `src/Panorama.gs`
- Contains: `recalcularPanorama()` (orchestrator that also returns buckets for Alertas to reuse), `escribirHojaPanorama()`, `formatearModalidades()`, `estadoParaConteo()`, `colorParaConteo()`, `showPanoramaSidebar()`, `getPanoramaHtml()`.
- Depends on: `src/Core.gs` (aggregation functions), `CONFIG` (colors, sheet names, threshold), `SpreadsheetApp`/`HtmlService`/`Utilities` services.
- Used by: `src/Main.gs` (menu items), `src/Alertas.gs` (`onFormSubmit()` calls `recalcularPanorama()` to get fresh buckets).
- Purpose: Detect buckets that just crossed the minimum-enrollment threshold and send exactly one email per bucket per semester, using a persisted dedup log.
- Location: `src/Alertas.gs`
- Contains: `onFormSubmit()` (trigger handler), `claveBucket()`, `leerEstadoAvisos()`, `marcarComoAvisado()`, `obtenerOCrearHojaEstadoAvisos()`, `limpiarEstadoAvisos()`, `enviarAvisoUmbral()`, `getAvisoHtml()`.
- Depends on: `src/Panorama.gs` (`recalcularPanorama()`), `CONFIG` (threshold, semester, email recipients, colors, sheet names), `MailApp`/`SpreadsheetApp`/`Utilities` services.
- Used by: The installable `onFormSubmit` trigger (installed by `src/Main.gs`); `src/Main.gs` also calls `limpiarEstadoAvisos()` during semester reset and `getAvisoHtml()` during the test-email flow.
- Purpose: Bind everything to a human-facing custom menu and provide operational entry points (recompute, install trigger, semester reset, test email, column detection, help).
- Location: `src/Main.gs`
- Contains: `onOpen()`, `recalcularPanoramaConAlerta()`, `instalarAutomatizacion()`, `iniciarNuevoSemestre()`, `probarAviso()`, `detectarColumnas()`, `showHelp()`.
- Depends on: `src/Panorama.gs`, `src/Alertas.gs`, `src/Core.gs` (`mapearColumnas()`), `CONFIG`, `SpreadsheetApp.getUi()`, `ScriptApp` (trigger management).
- Used by: End users via the Sheets UI menu; `ScriptApp` invokes `onFormSubmit` (defined in Alertas.gs) as an installable trigger set up here.

## Data Flow

### Primary Request Path (form submission → panorama update → email)

### Manual Recompute Path (menu-triggered)

### Sidebar View Path

- No in-memory or cross-execution state; every entry point recomputes from the raw response sheet on demand (Apps Script executions are stateless/short-lived).
- Durable state lives only in two spreadsheet sheets: "Panorama de Cursos" (fully overwritten each run — purely derived/disposable) and `_Estado_Avisos` (append-only log, the only durable record of what's already been emailed; must be explicitly cleared via `limpiarEstadoAvisos()` for a new semester).

## Key Abstractions

- Purpose: Represents one valid, normalized form response row.
- Shape: `{ rowIndex, nombre, email, idioma, nivel, horarios: [horarioId], modalidades: [string] }`
- Examples: constructed in `leerRespuestas()` (`src/Core.gs:50-58`)
- Pattern: Rows failing validation (missing email/@ / idioma / nivel / horarios) are silently skipped (`continue`), never raise.
- Purpose: Represents one (idioma, nivel, horarioId) combination and its interest count.
- Shape: `{ idioma, nivel, horarioId, horarioLabel, count, emails: Set, modalidades: {texto: count} }`
- Examples: built in `construirBuckets()` (`src/Core.gs:184-210`), consumed in `escribirHojaPanorama()` and `onFormSubmit()`.
- Pattern: `count` can overcount a single person who checked multiple schedules; the parallel `personasUnicas` map (keyed `idioma||nivel`) is the counterweight, surfaced as its own panorama column.
- Purpose: Canonical list of valid schedule blocks per language, each with a stable `id` (internal key) and `label` (must textually match the Form's checkbox option).
- Examples: `src/Config.gs:39-55`, matched in `parsearHorarios()` (`src/Core.gs:149-166`) via `normalizarTexto()` (case-insensitive, whitespace-collapsed) comparison. Non-matching labels are silently dropped from the count and only logged.
- Pattern: A `_default` catalog entry is used for languages without their own entry (e.g., 'Francés' as of 2026-07 per `src/Config.gs:37-38`).
- Purpose: The Google Form repeats "¿Cuál horario prefieres?" / "¿Qué modalidad te acomoda más?" once per language branch (conditional section jump), producing duplicate-header columns in the response sheet where only one is populated per row.
- Examples: `mapearColumnas()`'s `buscarTodos()` helper (`src/Core.gs:82-89`) returns *all* matching column indices for these two fields (arrays, not a single index); `primeraCeldaNoVacia()` (`src/Core.gs:108-116`) picks the first non-empty cell among them per row.
- Pattern: Any future form field using the same per-language branching pattern must use `buscarTodos()` + `primeraCeldaNoVacia()`, not the single-index `buscarUno()` (documented gotcha in `AGENTS.md`).

## Entry Points

- Triggers: Automatically on spreadsheet open (simple trigger).
- Responsibilities: Builds the "🎓 Inscripciones" custom menu and binds each item to its handler function.
- Triggers: Installable trigger fired by a new Google Form response row; must be (re)installed via the menu after every spreadsheet/form duplication (installable triggers are not copied automatically).
- Responsibilities: Full recompute of the panorama + threshold-crossing email dispatch with dedup. Wrapped in try/catch that never rethrows.
- `recalcularPanoramaConAlerta()`, `showPanoramaSidebar()` (in `src/Panorama.gs`), `instalarAutomatizacion()`, `iniciarNuevoSemestre()`, `probarAviso()`, `detectarColumnas()`, `showHelp()`.

## Architectural Constraints

- **Threading:** Single-threaded, single-execution-per-invocation. Apps Script has no worker/thread model; concurrent trigger firings (e.g., rapid-fire form submissions) could theoretically race on `_Estado_Avisos` reads/writes, but no locking (`LockService`) is used anywhere in the codebase.
- **Global state:** `CONFIG` (`src/Config.gs`) and `HEADERS_PANORAMA`/`COL_ESTADO` (`src/Panorama.gs:7-13`) and `HEADERS_ESTADO_AVISOS` (`src/Alertas.gs:7`) are module-level constants shared across the entire global scope; there is no encapsulation preventing any file from mutating them at runtime (though none currently do).
- **No import graph / no circular imports possible:** All `.gs` files share one flat global namespace by design of the Apps Script runtime — "dependencies" between files are implicit (function name references), not declared. `src/Config.gs` must define `CONFIG` before any other file's functions execute, but since Apps Script loads all files before any trigger fires, load order in the editor does not matter for correctness.
- **Execution time limits:** Apps Script enforces a 6-minute (consumer)/30-minute (Workspace) execution cap per run. `recalcularPanorama()` does a full sheet re-read and re-aggregate on every single form submission — this is a scaling constraint if the response sheet grows very large (see CONCERNS.md-equivalent note: no incremental/append-only recompute path exists).
- **Gmail quota:** `enviarAvisoUmbral()` checks `MailApp.getRemainingDailyQuota()` before sending (`src/Alertas.gs:104`), but does not queue/retry on exhaustion — a bucket that crosses threshold while quota is exhausted is marked "not yet notified" only if `enviarAvisoUmbral` returns before `marcarComoAvisado` is called, so it will be retried on the next submission (this is intentional: `marcarComoAvisado` is only called after `enviarAvisoUmbral`, and the quota-exhausted path returns early without marking).

## Anti-Patterns

### Full recompute on every trigger firing

### Silent discard on schedule-label mismatch

## Error Handling

- Trigger handler (`onFormSubmit`, `src/Alertas.gs:14-32`): catches all errors, logs via `Logger.log`, and deliberately does not rethrow — an internal bug must never block the underlying Form response from being recorded.
- Menu handlers (`src/Main.gs`): catch errors and surface them to the user via `ui.alert('❌ Error', error.message, ...)` (e.g., `recalcularPanoramaConAlerta()` at `src/Main.gs:39-41`, `probarAviso()` at `src/Main.gs:129-131`) — no silent failure for user-initiated actions.
- Internal validation (`src/Core.gs:18-23`): `leerRespuestas()` throws a descriptive `Error` if the minimum required columns (email, idioma) aren't found, directing the user to the "🔍 Detectar columnas" menu item.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
