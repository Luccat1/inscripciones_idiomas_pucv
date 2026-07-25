# Codebase Structure

**Analysis Date:** 2026-07-25

## Directory Layout

```
inscripciones_idiomas_pucv/
├── appsscript.json        # Apps Script manifest — timezone, OAuth scopes, runtime version
├── src/                   # All application code (5 .gs files, shared global scope)
│   ├── Config.gs          # CONFIG constant: threshold, catalogs, sheet names, form column mapping, colors
│   ├── Core.gs             # Read/normalize/aggregate form responses into inscripciones + buckets
│   ├── Panorama.gs         # "Panorama de Cursos" sheet writer + sidebar dashboard
│   ├── Alertas.gs           # Threshold-crossing detection, email dispatch, dedup via _Estado_Avisos
│   └── Main.gs              # onOpen() menu, trigger install, semester reset, help
├── README.md               # User-facing install/config/menu docs (Spanish)
├── AGENTS.md               # AI-agent collaboration guide: data model, code patterns, gotchas
├── CHANGELOG.md            # Version history
├── .gitignore
├── .claude/                # Claude Code local settings (not part of the app)
│   └── settings.local.json
└── graphify-out/           # Generated knowledge-graph artifacts (not part of the app; see below)
```

## Directory Purposes

**`src/`:**
- Purpose: The entire application. Every `.gs` file here is copy-pasted directly into the Google Apps Script editor for the container-bound project (no build/bundle step).
- Contains: 5 files, all sharing one global scope at runtime (no `import`/`require`, no module boundaries enforced by tooling — only by convention/file naming).
- Key files: `Config.gs` (must be understood first — every other file depends on `CONFIG`), `Core.gs` (data pipeline), `Panorama.gs` (orchestrator + sheet output), `Alertas.gs` (trigger handler + email), `Main.gs` (UI menu + entry-point wiring).

**`.claude/`:**
- Purpose: Claude Code local tool settings for this repo (permissions, etc.).
- Contains: `settings.local.json` only. Not application code.

**`graphify-out/`:**
- Purpose: Output of a `/graphify` knowledge-graph run over this repo (generated artifact, per the user's global `graphify` skill).
- Contains: `graph.json`, `graph.html`, `GRAPH_REPORT.md`, `manifest.json`, `cost.json`, plus a `cache/` subdirectory of AST/semantic analysis JSON.
- Generated: Yes — entirely tool-generated, safe to regenerate/delete.
- Committed: Yes (present in the repo per `git log`, commit "Agregar knowledge graph del proyecto (graphify)").

## Key File Locations

**Entry Points:**
- `src/Main.gs` (`onOpen()`): Simple trigger, builds the custom Sheets menu on spreadsheet open.
- `src/Alertas.gs` (`onFormSubmit(e)`): Installable trigger, fired on new Form response; must be manually (re)installed via the menu each time the sheet/form is duplicated (installable triggers do not copy over).

**Configuration:**
- `appsscript.json`: Apps Script manifest — timezone (`America/Santiago`), runtime (`V8`), OAuth scopes (`spreadsheets.currentonly`, `gmail.send`, `script.scriptapp`).
- `src/Config.gs`: All institutional/business configuration (`CONFIG` object) — threshold, language/level catalogs, per-language schedule catalog, sheet name mapping, form column header mapping, color palette.

**Core Logic:**
- `src/Core.gs`: Reading, column mapping, normalization, level resolution, schedule/modality parsing, bucket aggregation, unique-person counting.
- `src/Panorama.gs`: Panorama sheet recompute/write, semáforo coloring, sidebar HTML rendering.
- `src/Alertas.gs`: Threshold detection, dedup state (`_Estado_Avisos` hidden sheet), HTML email composition/sending.
- `src/Main.gs`: Menu wiring, trigger install/reinstall, semester reset flow, test-email flow, column-detection helper, help dialog.

**Testing:**
- Not applicable — no automated test suite exists in this repository. `probarAviso()` (`src/Main.gs:102`) is a manual, UI-driven smoke test for the email template only (sends a real email with fake bucket data; does not touch `_Estado_Avisos`).

## Naming Conventions

**Files:**
- One `.gs` file per responsibility area, PascalCase, named after its layer/domain: `Config.gs`, `Core.gs`, `Panorama.gs`, `Alertas.gs`, `Main.gs`. No test-file or index-file naming pattern exists.

**Functions and variables:**
- All identifiers are Spanish (matches the institutional/user-facing domain language): `leerRespuestas`, `mapearColumnas`, `construirBuckets`, `recalcularPanorama`, `enviarAvisoUmbral`, `instalarAutomatizacion`, `iniciarNuevoSemestre`. English is only used for Apps Script service/API calls themselves (`SpreadsheetApp`, `MailApp`, `HtmlService`, `ScriptApp`, `Logger`).
- Functions: camelCase, verb-first (`leerRespuestas`, `parsearHorarios`, `obtenerLabelHorario`, `showPanoramaSidebar` — the latter two are the only English-named functions, both tied to UI display).
- Constants: `CONFIG` (single global config object, always `UPPER_CASE` at top level, camelCase for nested keys — e.g. `CONFIG.umbralMinimo`, `CONFIG.horariosPorIdioma`). Other top-level constants use `UPPER_SNAKE_CASE`: `HEADERS_PANORAMA`, `COL_ESTADO`, `HEADERS_ESTADO_AVISOS`.
- Sheet names referenced only via `CONFIG.hojas.*` — never hardcoded as string literals inside logic functions.

**Data shapes (informal, no TypeScript/JSDoc typedefs):**
- "Inscripción" object: `{ rowIndex, nombre, email, idioma, nivel, horarios: [id], modalidades: [string] }` — documented in a comment above `leerRespuestas()` (`src/Core.gs:7-10`) and in `AGENTS.md`.
- "Bucket" object: `{ idioma, nivel, horarioId, horarioLabel, count, emails: Set, modalidades: {} }` — documented above `construirBuckets()` (`src/Core.gs:178-183`) and in `AGENTS.md`.

## Where to Add New Code

**New institutional value (threshold, colors, catalog entry, sheet name, form column mapping):**
- Add to `CONFIG` in `src/Config.gs` only. Never hardcode institutional values in `Core.gs`, `Panorama.gs`, `Alertas.gs`, or `Main.gs`.

**New form field to parse (single-answer question):**
- Add the header mapping to `CONFIG.formCols` in `src/Config.gs`.
- Add a `buscarUno(...)` entry inside `mapearColumnas()` in `src/Core.gs`.
- Extract/normalize the value inside `leerRespuestas()` in `src/Core.gs`, attach it to the inscripción object.

**New form field with per-language conditional branching (repeats once per language section, like horarios/modalidad):**
- Use `buscarTodos()` (not `buscarUno()`) inside `mapearColumnas()` (`src/Core.gs`) to collect all matching column indices.
- Use `primeraCeldaNoVacia()` in `leerRespuestas()` to pick the populated cell per row (`src/Core.gs`).

**New language or level:**
- Add to `CONFIG.idiomas` / `CONFIG.niveles` in `src/Config.gs`.
- Add a corresponding entry to `CONFIG.horariosPorIdioma` (or accept fallback to `'_default'`) in `src/Config.gs`.

**New menu item / entry point:**
- Add `.addItem(...)` inside `onOpen()` in `src/Main.gs`.
- Define the handler function in `src/Main.gs` (or delegate to a function in another file, following the existing pattern where `Main.gs` handlers call into `Panorama.gs`/`Alertas.gs`/`Core.gs`).
- Wrap the handler body in try/catch with a `ui.alert(...)` result/error dialog, matching existing handlers.

**New aggregation/output column in the panorama sheet:**
- Add the header string to `HEADERS_PANORAMA` in `src/Panorama.gs`.
- Add the corresponding value to the row-building `.map()` inside `escribirHojaPanorama()` in `src/Panorama.gs`.

**New notification channel or dedup logic:**
- Extend `src/Alertas.gs` — follow the existing `claveBucket()` + hidden-sheet dedup pattern (`_Estado_Avisos`) rather than introducing a new persistence mechanism.

## Special Directories

**`graphify-out/`:**
- Purpose: Auto-generated knowledge graph of the codebase (via the `/graphify` skill).
- Generated: Yes.
- Committed: Yes (already present in git history).
- Note: Not consulted by the application at runtime; purely a documentation/analysis artifact for AI-assisted development.

**`.claude/`:**
- Purpose: Local Claude Code tool permission settings.
- Generated: Partially (settings file is user-configured, not app-generated).
- Committed: Not typically expected to be committed for secrets, but here contains only non-sensitive local settings (`settings.local.json`).

---

*Structure analysis: 2026-07-25*
