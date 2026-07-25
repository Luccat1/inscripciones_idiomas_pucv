# Testing Patterns

**Analysis Date:** 2026-07-25

## No Automated Test Framework

**There is no automated test suite in this repository.** Confirmed by exploration:

- No `*.test.*` or `*.spec.*` files anywhere in the repo.
- No `jest.config.*`, `vitest.config.*`, `mocha.opts`, or any other test-runner config.
- No `package.json` at all (no npm project, no `devDependencies`, no `scripts.test`).
- No CI configuration (no `.github/workflows/`) that could run tests on push.

This is expected and normal for a Google Apps Script container-bound project: the code runs inside the Apps Script V8 sandbox, tied to a specific Google Sheet and Google Form, with `SpreadsheetApp`, `MailApp`, `HtmlService`, `ScriptApp`, and `Utilities` as ambient globals provided by the runtime. These globals cannot be required/imported or mocked outside of Apps Script itself, so standard Node-based test runners (Jest, Mocha, Vitest) cannot exercise this code without a substantial mocking layer that this project does not have. `AGENTS.md` confirms: "Google Apps Script (V8 runtime), sin build system — los `.gs` se copian directo al editor."

**Do not introduce Jest/Mocha/Vitest configs expecting them to run this code as-is** — any future automated testing effort would need a GAS-mocking library (e.g. `gas-local`, `@google/clasp` + manual stubs) and is a nontrivial addition, not a drop-in.

## What Exists Instead: Manual, Menu-Driven Verification

All verification of behavior happens by running functions from inside the live Google Sheet, via the custom menu installed by `onOpen()` (`src/Main.gs:7-20`). This is the project's only "test harness."

### Menu: 🎓 Inscripciones (`src/Main.gs`)

| Menu item | Handler function | What it verifies |
|---|---|---|
| 🔄 Recalcular Panorama | `recalcularPanoramaConAlerta()` (`src/Main.gs:25-42`) | End-to-end read → aggregate → write pipeline against real sheet data; reports bucket/threshold counts in a `ui.alert` |
| 📊 Ver Panorama | `showPanoramaSidebar()` (`src/Panorama.gs:118-124`) | Same pipeline, rendered as an HTML sidebar for quick visual check |
| 🔔 Instalar/Reinstalar automatización | `instalarAutomatizacion()` (`src/Main.gs:49-71`) | Confirms the `onFormSubmit` trigger is (re)installed without duplicates |
| 🆕 Iniciar nuevo semestre | `iniciarNuevoSemestre()` (`src/Main.gs:78-96`) | Full reset path: clears `_Estado_Avisos`, reinstalls trigger, recalculates panorama — guarded by a confirmation dialog |
| **🧪 Enviar aviso de prueba** | `probarAviso()` (`src/Main.gs:102-132`) | **The project's dedicated test feature** — see below |
| 🔍 Detectar columnas del formulario | `detectarColumnas()` (`src/Main.gs:138-169`) | Diagnostic: shows which form-response columns were matched to `CONFIG.formCols`, to catch mapping drift when the Form changes |

### `probarAviso()` — the manual "test email" feature

This is the closest thing to a test case in the codebase (`src/Main.gs:102-132`, menu label **"🧪 Enviar aviso de prueba"**, mentioned in `README.md` under 🔧 Menú):

```javascript
function probarAviso() {
  const ui = SpreadsheetApp.getUi();
  const emailResponse = ui.prompt(
    '🧪 Aviso de prueba',
    `Ingresa el email de destino:\n\n(Por defecto: ${CONFIG.emailAvisos[0]})`,
    ui.ButtonSet.OK_CANCEL
  );

  if (emailResponse.getSelectedButton() !== ui.Button.OK) return;
  const destino = emailResponse.getResponseText().trim() || CONFIG.emailAvisos[0];

  const bucketPrueba = {
    idioma: 'Inglés',
    nivel: 'A1.1',
    horarioId: 'PRUEBA',
    horarioLabel: 'Lunes y miércoles (17:30 - 19:30) [PRUEBA]',
    count: CONFIG.umbralMinimo
  };

  try {
    MailApp.sendEmail({
      to: destino,
      subject: '[PRUEBA] ' + `🟢 Curso listo para abrir: ${bucketPrueba.idioma} ${bucketPrueba.nivel}`,
      htmlBody: getAvisoHtml(bucketPrueba),
      name: 'Panorama de Inscripciones - IDIOMAS PUCV'
    });
    ui.alert('✅ Enviado', 'Correo de prueba enviado a ' + destino, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}
```

**What it tests:** the HTML email template (`getAvisoHtml()`, `src/Alertas.gs:122-159`) and the `MailApp.sendEmail` call path, using a fabricated `bucketPrueba` object instead of real aggregated data.

**What it deliberately does NOT touch:** the real alert/idempotency state. It calls `MailApp.sendEmail` directly rather than going through `enviarAvisoUmbral()`, so it never calls `marcarComoAvisado()` and never writes to the hidden `_Estado_Avisos` control sheet (`src/Alertas.gs:58-71`). This lets someone re-send the test email repeatedly without corrupting the real "already notified" bookkeeping used by `onFormSubmit()`.

**How to use it:** Menu → 🧪 Enviar aviso de prueba → enter a destination email (or accept the default `CONFIG.emailAvisos[0]`) → check the inbox for correct subject line, HTML rendering, and institutional styling (`CONFIG.colores`).

### Other manual verification paths

- **`Logger.log(...)` calls** are the closest thing to test assertions/diagnostics available. Check via Apps Script editor's **Executions** log (or `View > Logs` in legacy editor) after running any function. Notable log points:
  - `src/Core.gs:161` — logs each schedule-label string from the sheet that failed to match the `CONFIG.horariosPorIdioma` catalog (silent data-loss detector).
  - `src/Alertas.gs:29` — logs the error message when `onFormSubmit()` throws internally (since it never re-throws).
  - `src/Alertas.gs:105` — logs when `MailApp.getRemainingDailyQuota()` is exhausted and an alert email could not be sent.
- **`detectarColumnas()`** (`src/Main.gs:138-169`) is used as a manual regression check after any Google Form edit — it surfaces exactly which configured column names/keywords matched which real header, so a broken mapping is caught before `recalcularPanorama()` silently drops rows.
- **Real-data validation runs**, documented in `CHANGELOG.md` under `[1.1.0]`: "Al comparar el sistema contra 10 respuestas reales del formulario, se detectó que el panorama descartaba casi todas las inscripciones." This is the project's actual QA method — running the recalculation menu item against a known sample of real form responses and manually checking the resulting "Panorama de Cursos" sheet against expectations, then fixing catalog/mapping mismatches found this way.

## Coverage

**No coverage tooling, no coverage requirement.** Correctness confidence comes entirely from:
1. Manual menu-driven runs against real or sample Form data.
2. Inline `Logger.log()` diagnostics for silently-dropped/unmatched rows.
3. The `🧪 Enviar aviso de prueba` menu item for verifying the outbound email template without touching production alert state.

## Guidance for Adding New Functionality

Because there is no automated harness, any new parsing/normalization logic (e.g., a new `normalizarX()` or `parsearX()` function in `src/Core.gs`) should be manually verified by:
1. Running `🔍 Detectar columnas del formulario` first to confirm the relevant column(s) are mapped.
2. Running `🔄 Recalcular Panorama` and inspecting the resulting "Panorama de Cursos" sheet row-by-row against a small set of known real responses.
3. Checking the Apps Script **Executions** log for any `Logger.log(...)` warnings about unmatched values.

If a new feature sends email, follow the `probarAviso()` pattern: build a synthetic data object and call the HTML-generation + `MailApp.sendEmail` path directly, bypassing any idempotency/state-writing logic, so it can be re-run safely without corrupting `_Estado_Avisos`.

---

*Testing analysis: 2026-07-25*
