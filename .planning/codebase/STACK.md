# Technology Stack

**Analysis Date:** 2026-07-25

## Languages

**Primary:**
- Google Apps Script (JavaScript, ES5/ES6-ish subset on V8 runtime) - all `.gs` files under `src/`: `src/Config.gs`, `src/Core.gs`, `src/Panorama.gs`, `src/Alertas.gs`, `src/Main.gs`
- HTML (inline template strings, not separate `.html` files) - embedded in `src/Panorama.gs` (`getPanoramaHtml()`) and `src/Alertas.gs` (`getAvisoHtml()`) for sidebar UI and email bodies

**Secondary:**
- Markdown - documentation: `README.md`, `AGENTS.md`, `CHANGELOG.md`

## Runtime

**Environment:**
- Google Apps Script V8 runtime (`"runtimeVersion": "V8"` in `appsscript.json`)
- Container-bound to a Google Sheet (the sheet holding the enrollment Form responses) — there is no standalone deployment; the script executes inside the Google Sheets/Apps Script execution environment
- Timezone fixed to `America/Santiago` (`"timeZone"` in `appsscript.json`), used for date formatting via `Utilities.formatDate()` in `src/Panorama.gs` and `src/Alertas.gs`

**Package Manager:**
- None. This is a classic (non-clasp) Apps Script project — no `package.json`, no npm/yarn/pnpm, no `node_modules`
- Deployment is manual copy-paste: `.gs` files from `src/` are pasted directly into the Apps Script editor bound to the Sheet, and `appsscript.json` contents are pasted into the editor's manifest file (see `README.md` "🚀 Instalación" section)
- No lockfile (not applicable — no external JS packages are installed)

## Frameworks

**Core:**
- None (no application framework). Uses only built-in Apps Script global services (`SpreadsheetApp`, `MailApp`, `ScriptApp`, `HtmlService`, `Utilities`, `Logger`) — all `.gs` files share one global scope, no `import`/`require`/modules

**Testing:**
- None detected. No test framework, no test files, no `*.test.*`/`*.spec.*` files in the repository

**Build/Dev:**
- None. No bundler, no transpiler, no linter/formatter config found (no `.eslintrc*`, no `.prettierrc*`, no `tsconfig.json`)
- No CI/CD pipeline files (no `.github/workflows/`, no `.gitlab-ci.yml`)

## Key Dependencies

**Critical:**
- None — zero third-party libraries or npm packages. All functionality is implemented using native Apps Script global services (see appsscript.json `oauthScopes` below) plus vanilla JavaScript

**Infrastructure:**
- `SpreadsheetApp` (built-in Apps Script service) - reads/writes the bound Google Sheet; used throughout `src/Panorama.gs`, `src/Alertas.gs`, `src/Main.gs`
- `MailApp` (built-in) - sends HTML notification emails; used in `src/Alertas.gs` (`enviarAvisoUmbral()`) and `src/Main.gs` (`probarAviso()`)
- `ScriptApp` (built-in) - manages the installable `onFormSubmit` trigger; used in `src/Main.gs` (`instalarAutomatizacion()`)
- `HtmlService` (built-in) - renders the sidebar dashboard; used in `src/Panorama.gs` (`showPanoramaSidebar()`)
- `Utilities` (built-in) - date formatting (`Utilities.formatDate`); used in `src/Panorama.gs` and `src/Alertas.gs`
- `Logger` (built-in) - diagnostic logging (Stackdriver-backed, per manifest `"exceptionLogging": "STACKDRIVER"`); used in `src/Core.gs` and `src/Alertas.gs`

## Configuration

**Environment:**
- No `.env` files or environment-variable mechanism (not applicable to Apps Script's execution model)
- All configuration lives in a single global `CONFIG` object defined in `src/Config.gs`: current semester (`semestre`), minimum-enrollment threshold (`umbralMinimo`), alert recipient list (`emailAvisos`), offered languages (`idiomas`), offered levels (`niveles`), per-language schedule catalog (`horariosPorIdioma`), level-resolution fallbacks (`nivelPrincipiante`, `nivelPorEvaluar`), sheet name mapping (`hojas`), form column header mapping (`formCols`), and institutional brand colors (`colores`)
- Per project convention (see `AGENTS.md` "Code Patterns"), any institutional value must live in `CONFIG` — never hardcoded elsewhere

**Build:**
- `appsscript.json` is the only "build"/manifest config — declares timezone, runtime version, exception logging target, and OAuth scopes. It has no `dependencies` entry (empty `{}`), confirming there are no Apps Script library dependencies either

## Platform Requirements

**Development:**
- A Google account with edit access to the target Google Sheet/Form and its bound Apps Script project
- Browser-based Apps Script editor (script.google.com) — no local dev environment, no local runtime install (Node, etc.) needed for this project
- Manual deployment workflow: copy `src/*.gs` into the Apps Script editor's script files, and `appsscript.json` contents into the editor's manifest (see `README.md` step 2)

**Production:**
- Runs entirely inside Google's infrastructure as a container-bound script attached to a specific Google Sheet
- OAuth scopes requested (from `appsscript.json`):
  - `https://www.googleapis.com/auth/spreadsheets.currentonly` — read/write only the bound spreadsheet
  - `https://www.googleapis.com/auth/gmail.send` — send notification emails via `MailApp`/Gmail
  - `https://www.googleapis.com/auth/script.scriptapp` — manage installable triggers (`ScriptApp.newTrigger`/`deleteTrigger`)
- Subject to Gmail daily sending quota; `src/Alertas.gs` (`enviarAvisoUmbral()`) explicitly checks `MailApp.getRemainingDailyQuota()` before sending and logs (does not throw) if quota is exhausted
- Requires the installable `onFormSubmit` trigger to be (re)installed manually each time the Sheet/Form is duplicated (e.g., new semester) — triggers do not copy with the sheet; see `instalarAutomatizacion()` in `src/Main.gs`

---

*Stack analysis: 2026-07-25*
