# Coding Conventions

**Analysis Date:** 2026-07-25

## Language Split: Spanish-Domain, English-Infra

This codebase deliberately mixes two languages by role, not by file:

- **Spanish** for everything that maps to the business domain: function names, variable names, config keys, comments, log messages, UI strings (menu items, alerts, sidebar/email HTML), commit-adjacent docs (`CHANGELOG.md`, `README.md`).
  - Examples: `leerRespuestas()`, `mapearColumnas()`, `parsearHorarios()`, `construirBuckets()`, `determinarNivel()`, `CONFIG.umbralMinimo`, `CONFIG.horariosPorIdioma`, `CONFIG.nivelPorEvaluar` (`src/Core.gs`, `src/Config.gs`).
- **English** only for platform/API surface that Google Apps Script itself defines: global lifecycle hooks (`onOpen`, `onFormSubmit`), and all Apps Script service/class names (`SpreadsheetApp`, `MailApp`, `HtmlService`, `ScriptApp`, `Logger`, `Utilities`).

**Rule for new code:** name anything that represents a domain concept (inscription, level, schedule, threshold, semester) in Spanish, matching existing terms exactly (`idioma`, `nivel`, `horario`, `umbral`, `semestre`, `inscripcion`, `bucket` is the one accepted English loanword — used throughout for the aggregation unit). Only use English for Apps Script platform API calls and for the required lifecycle function names (`onOpen`, `onFormSubmit`, `doGet`/`doPost` if added).

## File Naming and Organization

**Files:** `PascalCase.gs`, one logical concern per file, matching AGENTS.md's documented split:

| File | Owns |
|---|---|
| `src/Config.gs` | All configuration constants (`CONFIG` object) — single source of truth |
| `src/Core.gs` | Reading, normalizing, aggregating form responses |
| `src/Panorama.gs` | Building/writing the "Panorama de Cursos" sheet + sidebar |
| `src/Alertas.gs` | Threshold-crossing detection + duplicate-safe email dispatch |
| `src/Main.gs` | Menu (`onOpen`), all menu-handler entry points |

There is no build system or bundler — `.gs` files share global scope (Apps Script convention) and are copy-pasted into the Apps Script editor (see `README.md` step 2). Do not add `import`/`require`/`export` — they do not exist in this runtime.

**Adding a new file:** only justified for a new distinct concern (e.g., a future `Reportes.gs`). Otherwise extend the existing file that owns that concern.

## Naming Patterns

**Functions:** `verboSustantivo()` camelCase, Spanish verb + noun — e.g. `leerRespuestas`, `construirBuckets`, `contarPersonasUnicasPorNivel`, `escribirHojaPanorama`, `obtenerOCrearHojaEstadoAvisos`. Boolean/derivation helpers follow `normalizarX()` / `parsearX()` / `determinarX()` / `estadoParaX()` / `colorParaX()` families — reuse these prefixes for new normalizers rather than inventing new ones.

**Variables:** camelCase Spanish nouns (`inscripciones`, `buckets`, `filas`, `horariosCelda`, `claveNivel`). Loop/index variables (`i`, `idx`) stay short English/generic — consistent with plain `for` loops used throughout (`src/Core.gs:27`, `src/Panorama.gs:84`).

**Constants:** `SCREAMING_SNAKE_CASE` at module scope for fixed arrays/lookups — `HEADERS_PANORAMA` (`src/Panorama.gs:7`), `HEADERS_ESTADO_AVISOS` (`src/Alertas.gs:7`), `COL_ESTADO` (`src/Panorama.gs:13`). The single global config object is `CONFIG` (`src/Config.gs:11`), always accessed as `CONFIG.campo`, never destructured or copied.

**Config keys:** camelCase Spanish (`umbralMinimo`, `emailAvisos`, `horariosPorIdioma`, `formCols`, `nivelPrincipiante`, `nivelPorEvaluar`, `hojas.respuestas`). Nested objects group related keys (`CONFIG.hojas.*`, `CONFIG.colores.*`, `CONFIG.formCols.*`).

**Sheet/tab names:** Spanish strings stored in `CONFIG.hojas` (never hardcoded elsewhere) — `'Respuestas de formulario 1'`, `'Panorama de Cursos'`, `'_Estado_Avisos'` (leading underscore marks an internal/hidden control sheet).

## Code Style

**No formatter/linter configured.** No `.eslintrc*`, `.prettierrc*`, `eslint.config.*`, or `biome.json` found anywhere in the repo. Style consistency is maintained by hand — match the surrounding code exactly:
- 2-space indentation
- Single quotes for strings, template literals (`` ` ``) only when interpolating
- Semicolons always
- `const`/`let` only — no `var`
- Arrow functions for callbacks (`.map`, `.forEach`, `.filter`, `.find`, `.sort`), named `function` declarations for top-level module functions

**No `tsconfig.json` / TypeScript** — plain ES6+ JavaScript running on the Apps Script V8 runtime (`appsscript.json`: `"runtimeVersion": "V8"`).

## Comment Style

**JSDoc-style block comments** (`/** ... */`) above every non-trivial function, written in Spanish prose, explaining *why* not just *what* — e.g. the block above `mapearColumnas()` (`src/Core.gs:64-74`) explains the Form's conditional-branch quirk that motivates returning arrays of indices instead of one. Follow this pattern for new functions: state the purpose, then call out any non-obvious business rule or edge case the implementation encodes.

**File-header banner comments** at the top of each `.gs` file:
```javascript
/**
 * =============================================================================
 * Core.gs - Lectura, normalización y agregación de inscripciones
 * =============================================================================
 */
```
Use this exact banner style (`=` rule, filename, one-line Spanish purpose) when adding a new file.

**Inline comments** mark non-obvious business rules right where they apply, e.g. `src/Config.gs:37-38` documents that `'Francés'` has no dedicated schedule catalog entry yet and falls back to `_default`. Add this style of inline note whenever a value is a placeholder/TODO-adjacent decision rather than a settled fact.

**Section divider comments** (`// ====...`) separate logical groups within a file — see `src/Core.gs:238` (`NORMALIZACIÓN` section). Use this when a file accumulates more than one clear sub-group of functions.

## Error Handling

**Menu-invoked (user-facing) functions:** wrap the whole body in try/catch and surface failures via `ui.alert('❌ Error', error.message, ui.ButtonSet.OK)` — never fail silently on a user action (`recalcularPanoramaConAlerta()`, `probarAviso()` in `src/Main.gs`). Success also gets a `ui.alert(...)` confirmation. This is a strict convention — every new menu item's handler must follow it.

**Trigger-invoked (`onFormSubmit`) functions:** wrap in try/catch but only `Logger.log(...)` on error — **never re-throw**, because an uncaught error here would block the Form response from being recorded (`src/Alertas.gs:14-32`, explicitly commented: `// No relanzar: un error aquí no debe bloquear el registro de la respuesta.`). Apply this same non-rethrowing pattern to any future trigger handler.

**Data-integrity failures** (missing required sheet/columns) throw a plain `Error` with an actionable Spanish message pointing at the fix (which menu item or config key to check) — see `src/Core.gs:19-22` and `src/Panorama.gs:25`. Follow this pattern: throw with guidance, not a bare message.

**Unrecognized/unmatched data** (e.g., a schedule label from the sheet that doesn't match the catalog) is logged via `Logger.log(...)` and silently skipped rather than thrown — these are expected data variance, not bugs (`parsearHorarios()`, `src/Core.gs:161`).

## Function Design

**Size:** small, single-purpose functions (most under 30 lines). Aggregation/orchestration functions (`recalcularPanorama`, `leerRespuestas`) compose several single-purpose helpers rather than inlining logic.

**Parameters:** plain positional parameters, no options objects. Functions that operate on a sheet take the `Sheet` object explicitly rather than re-fetching it internally (`leerRespuestas(sheet)`), except top-level orchestrators which do fetch `SpreadsheetApp.getActiveSpreadsheet()` themselves once.

**Return values:** consistently return plain objects/arrays/primitives — never Apps Script UI objects. Empty/absent results return `''`, `[]`, or `{}` (never `null`/`undefined`) — e.g. `normalizarTexto()` returns `''`, `parsearHorarios()` returns `[]`. Match this convention in new normalizer/parser functions.

## Module Design

**No exports/imports** — Apps Script shares one global scope per project; every top-level `function` and `const` in `src/*.gs` is implicitly global and callable from any other file. Avoid name collisions by keeping the one-file-per-concern discipline above.

**Single global config object** (`CONFIG` in `src/Config.gs`) is the only piece of shared mutable-looking state meant to be read from everywhere; nothing else should become an ad hoc cross-file global. Institutional/business values (thresholds, catalogs, colors, sheet names, column mappings) always go in `CONFIG` — never hardcoded inline in `Core.gs`/`Panorama.gs`/`Alertas.gs`/`Main.gs` (explicit rule in `AGENTS.md`: "Config centralizada").

---

*Convention analysis: 2026-07-25*
