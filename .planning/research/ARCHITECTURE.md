# Architecture Research

**Domain:** Reliability hardening of an existing single-container Google Apps Script automation (Panorama de Inscripciones — IDIOMAS PUCV)
**Researched:** 2026-07-25
**Confidence:** HIGH (Apps Script trigger/lock semantics verified against official docs) / MEDIUM (local-testing scaffold, not yet spiked against this repo)

This is not a greenfield architecture doc — it is an integration plan for four safeguards (LockService, per-bucket error isolation, testable pure functions, PropertiesService state) onto the **existing** 5-file flat-global-scope codebase described in `.planning/codebase/ARCHITECTURE.md`. All integration points below reference actual file/function names from this repo. No new module system, no restructuring of `src/`.

## Current System Overview (baseline, unchanged)

```
Google Form submit
      │
      ▼
onFormSubmit(e)              ◄── installable trigger, src/Alertas.gs:14
      │  (headless — no SpreadsheetApp.getUi() available here)
      ▼
recalcularPanorama()          src/Panorama.gs:20
      │  leerRespuestas() → mapearColumnas() → parsearHorarios()/determinarNivel()
      │  → construirBuckets() → escribirHojaPanorama()               (src/Core.gs, src/Panorama.gs)
      ▼
buckets returned to onFormSubmit
      │
      ▼
Object.values(buckets).forEach(bucket => {           ◄── no per-bucket try/catch today
  enviarAvisoUmbral(bucket);                          src/Alertas.gs:103 (silent no-op on quota exhaustion)
  marcarComoAvisado(bucket);                          src/Alertas.gs:58 (runs unconditionally — the known bug)
})
      │
      ▼
outer try/catch (src/Alertas.gs:15) — logs everything, never rethrows, never blocks Form recording
```

Parallel manual path: menu "🔄 Recalcular Panorama" → `recalcularPanoramaConAlerta()` (`src/Main.gs:25`) → same `recalcularPanorama()` → summarized via `ui.alert()`. This path never touches `_Estado_Avisos` or sends mail, but **does** write the same "Panorama de Cursos" sheet that `onFormSubmit` writes — so it shares the same race surface for the Sheet-write part of the critical section, just not the email-dedup part.

## Where Each Safeguard Integrates

### 1. LockService — boundary placement

**Verified (HIGH confidence, official docs):**
- `LockService.getScriptLock()` returns a lock that blocks *all* users/executions of the script, not just one document — this is the correct scope here since both `onFormSubmit` and the menu-driven `recalcularPanoramaConAlerta()` write the same sheet.
- `Lock.tryLock(timeoutInMillis)` returns `false` on timeout — **does not throw**.
- `Lock.waitLock(timeoutInMillis)` **throws an exception** on timeout (same as `tryLock` otherwise).
- `Lock.releaseLock()` is a no-op if the lock was never acquired — safe to call unconditionally in a `finally`.
- Google's own documented pattern (form-submission unique-ID example) explicitly recommends `waitLock(30000)` around form-submission critical sections and releasing in a `finally`; `SpreadsheetApp.flush()` before release is recommended when the guarded section wrote sheet data, so the write is durable before another execution proceeds.
- Source: https://developers.google.com/apps-script/reference/lock/lock

**Recommended placement — do NOT put the lock inside `recalcularPanorama()`.**

`recalcularPanorama()` (`src/Panorama.gs:20`) has three callers: `onFormSubmit` (needs strict serialization — it's the only path with non-idempotent side effects, i.e. sending mail + marking `_Estado_Avisos`), `recalcularPanoramaConAlerta()` (menu — wants serialization against `onFormSubmit`, but is user-interactive and should fail fast, not hang), and `showPanoramaSidebar()` (`src/Panorama.gs:118`, read-only dashboard view — does not need to block on a lock; tolerating a stale read is fine, and adding lock-wait latency to an interactive sidebar click is a bad tradeoff). Locking inside the shared low-level function would penalize the sidebar path for no correctness gain and risks the same execution re-entering a lock it already holds (undocumented/unsafe behavior to rely on — avoid instead of testing it).

Put the lock at each **entry point that performs the non-idempotent write**, not the shared internals:

- **`onFormSubmit(e)`** (`src/Alertas.gs:14`): acquire the lock as the very first statement, and release only after the full alert-dispatch `forEach` completes — i.e. the lock must span `recalcularPanorama()` **and** the entire `_Estado_Avisos` read/check/send/mark sequence, not just the sheet recompute. The dedup check-then-write (`leerEstadoAvisos()` → decide → `enviarAvisoUmbral()` → `marcarComoAvisado()`) is the actually non-idempotent part; if the lock only wrapped the recompute, two concurrent submissions could still both decide "not yet notified" and both send.
  - Use `tryLock(30000)` (matches Google's own documented example timeout), not `waitLock`. If it returns `false`, `Logger.log` and return early **without** attempting the recompute — this is safe specifically *because* `recalcularPanorama()` is already a full, idempotent recompute from row 1 (documented in `.planning/codebase/ARCHITECTURE.md`'s "Idempotent notification design" note): skipping one submission's trigger run just means the next submission's trigger run will pick up the missed row. No queueing/retry logic is needed.
  - Release in a `finally` block that wraps the recompute + dispatch, calling `SpreadsheetApp.flush()` immediately before `releaseLock()` so the Panorama sheet write is committed before another waiting execution proceeds.
- **`recalcularPanoramaConAlerta()`** (`src/Main.gs:25`): also acquire `getScriptLock()` with a short `tryLock` timeout (e.g. 5–10s — this is a user click, not a background job; long waits feel broken). On failure, surface a friendly `ui.alert('⏳ Ocupado', 'El panorama se está actualizando automáticamente, intenta de nuevo en unos segundos.', ...)` instead of proceeding — this is new user-facing behavior but is explicitly about reliability (avoiding a torn/overlapping write), not a product feature, so it's in-scope for a hardening milestone.
- **`showPanoramaSidebar()`**: no lock. Leave as-is.

**GAS-specific risk that constrains this design:** `SpreadsheetApp.getUi()` throws when called from an installable trigger context (no active UI session tied to a headless `onFormSubmit` execution). This means the `tryLock` failure path inside `onFormSubmit` can **only** `Logger.log` — it cannot show any dialog. This is exactly why safeguard #4 (PropertiesService state) is required to bridge a trigger-context failure to a later human-visible surface; see below.

**Sequencing implication:** the lock-acquire/release skeleton and the per-bucket try/catch (#2 below) must land in the **same edit** to `onFormSubmit`'s body — the `finally`-release has to wrap the same block the per-bucket try/catch protects, and there is no safe partial state (lock without per-bucket isolation still lets one thrown bucket-send error skip the release unless it's already inside a `finally`; per-bucket isolation without the lock still leaves the race). Treat "trigger critical section" as one atomic phase of work touching `src/Alertas.gs:14-32` in full, not two separate phases.

### 2. Per-bucket error isolation — pattern

**Problem today:** `Object.values(buckets).forEach(...)` has no per-iteration try/catch; a thrown error inside `enviarAvisoUmbral()` for bucket N aborts evaluation of buckets N+1..end for that trigger run (only the outer function-level try/catch at `src/Alertas.gs:15` catches it, and it swallows for the whole invocation).

**Recommended pattern** (standard JS idiom, not Apps-Script-specific — verified as the correct approach given the constraint that `forEach` itself has no way to `continue`/`break` past a thrown error other than per-iteration try/catch):

```javascript
function onFormSubmit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('onFormSubmit: no se pudo obtener el lock, se omite este intento (el próximo envío lo recalculará).');
    return;
  }
  const erroresEnvio = [];
  try {
    const buckets = recalcularPanorama();
    const estadoAvisos = leerEstadoAvisos();

    Object.values(buckets).forEach(bucket => {
      if (bucket.count < CONFIG.umbralMinimo) return;
      if (yaAvisado(bucket, estadoAvisos)) return;

      try {
        const enviado = enviarAvisoUmbral(bucket);   // now returns boolean — see fix below
        if (enviado) {
          marcarComoAvisado(bucket);
        } else {
          erroresEnvio.push({ bucket: claveBucket(bucket), motivo: 'cuota de Gmail agotada' });
        }
      } catch (err) {
        erroresEnvio.push({ bucket: claveBucket(bucket), motivo: String(err) });
        Logger.log('Error enviando aviso para bucket ' + claveBucket(bucket) + ': ' + err);
      }
    });

    if (erroresEnvio.length > 0) {
      registrarResultadoParcial('ultimoErrorAvisos', erroresEnvio); // PropertiesService bridge, see #4
    }
  } catch (err) {
    Logger.log('Error en onFormSubmit: ' + err);
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}
```

Key points:
- The **inner** try/catch is what fixes the "single exception aborts all remaining buckets" bug (`CONCERNS.md` Known Bugs). The **outer** try/catch remains as the last-resort net (never let an unexpected bug in the recompute step block the Form's own response recording), matching the existing documented `onFormSubmit` error strategy in `.planning/codebase/ARCHITECTURE.md`.
- This same edit is the natural place to fix the "marked as sent even when never delivered" bug (`CONCERNS.md` Known Bugs #1): change `enviarAvisoUmbral()` (`src/Alertas.gs:103`) to `return true` only after `MailApp.sendEmail` actually executes, and `return false` on the quota pre-check short-circuit (or let a thrown MailApp exception propagate to the per-bucket catch above, which now records it instead of silently continuing to mark). Do this in the same phase as per-bucket isolation — they are two edits to the same 15-20 lines and reviewing them together avoids re-touching the same block twice.
- "Never silently swallow" means: **log always**, and **additionally record durable state** (PropertiesService) when running headless, since `Logger.log` output from a trigger execution is invisible to staff unless someone actively opens Executions.

### 3. Extracting testable pure functions — keeping the copy-paste deploy model

**Good news specific to this codebase:** the five functions named in scope (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) are **already pure** per the existing architecture map — they take arrays/strings/CONFIG and return values; only `leerRespuestas()` (their caller) touches `SpreadsheetApp`. No code needs to move out of `src/Core.gs`. The task is adding a **local Node test harness that can load the same `.gs` file unmodified**, not extracting/relocating logic.

**Recommended approach (MEDIUM confidence — verify with a small spike before committing in the roadmap):**

1. Add a `tests/` directory **sibling to `src/`**, not inside it — `src/` is copy-pasted verbatim into the Apps Script editor per `STRUCTURE.md`, so anything Node/Jest-only must live outside it to avoid ever being pasted into the GAS project.
2. Add a root `package.json` with `jest` as a devDependency only. This has zero effect on the deployed Apps Script project (Apps Script never sees `package.json`/`node_modules`).
3. Configure Jest's `moduleFileExtensions` to include `gs` (e.g. `["js", "gs", "json"]`) so `require('../src/Core')` (no extension) resolves to `Core.gs` directly — Jest natively supports extensionless resolution against a configured extension list; this is Jest's own documented mechanism and avoids monkey-patching Node's `require.extensions` (which works but is a legacy/deprecated hook — prefer the Jest-native config).
4. Since `Core.gs` currently has no `module.exports` (it's not meant to be a CommonJS module — it's pasted into a flat global-scope runtime), add a small guarded export block at the bottom of `Core.gs`:
   ```javascript
   if (typeof module !== 'undefined' && module.exports) {
     module.exports = { mapearColumnas, parsearHorarios, determinarNivel, normalizarNombre, construirBuckets, /* ...other pure fns as needed */ };
   }
   ```
   `typeof module` safely evaluates to `'undefined'` in the Apps Script V8 runtime (no CommonJS globals exist there), so this block is inert when pasted into the Apps Script editor — it does not throw, does not require any GAS-side change, and does not affect production behavior. This is the same pattern used by community GAS-testing tooling (e.g. `gas-local`, and documented in community write-ups on Jest-testing Apps Script projects) for making a `.gs` file dual-loadable.
5. `CONFIG` is a `const` at global scope in `src/Config.gs` — when `Core.gs` is `require()`'d standalone in Node, `CONFIG` will be undefined unless `Config.gs` is also loaded first. Either `require('../src/Config')` before `require('../src/Core')` in each test file (relying on the fact that `const CONFIG = {...}` in `Config.gs`, once required, still only exists in that module's own scope in Node — **this will not work as-is**, since Node module scoping isn't the same as GAS's shared-global-scope), **or** — the more correct fix — pass a test `CONFIG` fixture object directly into the pure functions instead of relying on the ambient global. Check the actual function signatures in `src/Core.gs` before finalizing: if `parsearHorarios(texto, catalogoHorarios)` already takes the catalog as a parameter rather than reading `CONFIG.horariosPorIdioma` from the enclosing scope, no fixture-injection change is needed at all, only a direct call from the test. If it reads `CONFIG` as an ambient global instead, the test file should `global.CONFIG = { ...fixture }` before requiring `Core.gs`, matching Apps Script's own "everything is a shared global" execution model rather than fighting it.
6. **This does not require `clasp`.** `PROJECT.md`'s Key Decision ("tests will need `clasp` + local Node test runner") is broader than necessary for this specific goal — `clasp` is only needed if the team wants to change the *push/pull deployment mechanism* (syncing local files to the live Apps Script project via the Apps Script API instead of manual copy-paste). Testing the pure functions locally needs only Jest + the guarded `module.exports` shim above; the copy-paste deployment model is completely untouched. **Recommend confirming this simplification in the roadmap** — it removes an unnecessary dependency/tooling-adoption step from the milestone.

**Sequencing:** Set this harness up **first**, before making the Alertas.gs/onFormSubmit edits above. It is fully independent of the LockService/per-bucket work (different files, no shared lines), and it gives a regression safety net for later scope items that *do* touch `Core.gs` — specifically the "unmatched horario / discarded row counts" surfacing work (below), which changes `leerRespuestas()`'s and `parsearHorarios()`'s return shapes. Doing the harness first means that change is guarded by tests from day one instead of being the first thing tested manually against the 5 pure functions.

### 4. PropertiesService — bridging headless-trigger state to a human-visible surface

**Why it's needed here specifically:** `onFormSubmit` cannot call `SpreadsheetApp.getUi()` (throws — no active UI in an installable-trigger execution context) and any `Logger.log()` output is invisible unless staff proactively open Executions — exactly the anti-pattern this milestone exists to fix. `PropertiesService.getScriptProperties()` is the one durable, always-available store that both a headless trigger execution and a later menu-invoked function can read/write.

**Concrete integration points:**
- New small helper functions — `registrarResultadoParcial(clave, datos)` (writes `JSON.stringify(datos)` to a script property) and `leerYLimpiarResultadoParcial(clave)` (reads, then deletes the property so it's shown once) — used for two kinds of state:
  1. **Bucket send failures** collected in `onFormSubmit`'s per-bucket catch (see #2 above) — key e.g. `ultimoErrorAvisos`.
  2. **Unmatched-horario / discarded-row counts** from `leerRespuestas()`/`parsearHorarios()` (CONCERNS.md "no visibility into discarded rows") — these can actually be surfaced **synchronously** within the same execution when triggered from the menu (`recalcularPanoramaConAlerta()` already builds a `ui.alert()` from `recalcularPanorama()`'s return value, so just extend that return shape with `{ buckets, discardCounts, unmatchedHorarioCounts }` and read it directly — no PropertiesService needed for the menu path). PropertiesService is specifically needed to carry the **same** counts from an `onFormSubmit`-triggered recompute (headless, no dialog available) forward to the *next* time a human opens the menu, so a form-submission-time discard doesn't go unnoticed until someone happens to manually recalculate.
- Read-and-clear point: `recalcularPanoramaConAlerta()` (`src/Main.gs:25`) and/or `onOpen()` (`src/Main.gs:7`) checks `leerYLimpiarResultadoParcial('ultimoErrorAvisos')` / `('ultimoDescartes')` at the start and prepends a warning block to its `ui.alert()` if anything was pending, e.g.: "⚠️ Desde la última apertura: 2 avisos no se pudieron enviar (cuota agotada), 3 filas con horario no reconocido." This directly satisfies the "Staff-facing error/status messages replace silent Logger.log()-only failure paths" requirement in `PROJECT.md`.
- File placement: add these as a small new file, `src/Fiabilidad.gs` — this is a genuinely new cross-cutting responsibility area (used by both `Alertas.gs` and `Main.gs`), and the project's own convention (per `STRUCTURE.md`, "one `.gs` file per responsibility area") argues for a new file over bolting infra helpers onto an unrelated business-logic file. This is the only new file this milestone should need; it does not change any existing file's role.

## Suggested Build/Sequencing Order

1. **Test harness for `Core.gs` pure functions** (`tests/`, `package.json`, Jest config, guarded `module.exports` shim in `Core.gs`). Independent of everything else; unblocks safe iteration on Core.gs in step 4.
2. **Trigger critical-section hardening** — `onFormSubmit()` in `src/Alertas.gs`, done as one atomic change: LockService acquire/finally-release + per-bucket try/catch + `enviarAvisoUmbral()` returning a real boolean + only marking `_Estado_Avisos` on confirmed send. These are one tightly-coupled edit to the same ~20 lines; do not split across phases.
3. **Menu-path lock guard** — `recalcularPanoramaConAlerta()` in `src/Main.gs`: short `tryLock` + friendly busy-dialog. Small, independent, but logically follows step 2 (same `getScriptLock()` convention/timeout values should be decided once).
4. **Discard/unmatched-horario visibility** — extend `leerRespuestas()`/`parsearHorarios()` return shapes in `src/Core.gs` to report counts, update `recalcularPanorama()`'s return value, update `recalcularPanoramaConAlerta()`'s dialog. Do this after step 1 so the changed return shapes are pinned by tests immediately; independent of steps 2-3 (different code path — normalize/read side, not alert-dispatch side).
5. **`src/Fiabilidad.gs` (new file) — PropertiesService bridge** — depends on step 2 (needs the per-bucket error list to have something to record) and step 4 (needs discard counts to have something to record); wire both into it together since it's one small new file either way.
6. **Staff-facing docs / in-sheet guidance / semester setup docs** — last, since it should describe the *final* state of the menu dialogs (which change in steps 2-5), not the pre-hardening behavior.

## Anti-Patterns to Avoid in This Hardening Work

### Locking inside the shared `recalcularPanorama()` instead of at entry points
**What people do:** put `LockService.getScriptLock()` inside the shared aggregation function since "that's where the write happens."
**Why it's wrong:** penalizes the read-only sidebar path with lock-wait latency for no correctness benefit, and risks the same execution attempting to re-acquire a lock it already holds if any caller nests calls (undocumented/unreliable behavior to depend on).
**Do this instead:** lock at the entry points with real non-idempotent side effects (`onFormSubmit`, and defensively `recalcularPanoramaConAlerta`), not the shared internal function.

### Fixing "marked as sent" and "aborts remaining buckets" as two separate phases
**What people do:** ship the boolean-return fix for `enviarAvisoUmbral()` in one PR/phase and the per-bucket try/catch in another.
**Why it's wrong:** both edits land on the exact same forEach block in `src/Alertas.gs`; splitting them means re-touching (and re-reviewing) the same lines twice, and a half-applied state (boolean return without per-bucket catch, or vice versa) still leaves one of the two known bugs live.
**Do this instead:** one phase, one edit, both fixes together.

### Assuming `Logger.log` in a trigger is "handled"
**What people do:** add a `Logger.log()` call and consider a headless-trigger failure "surfaced."
**Why it's wrong:** nobody reads Stackdriver/Executions proactively — this is literally the root cause of every "silent" bug in `CONCERNS.md`.
**Do this instead:** any failure state generated inside `onFormSubmit` needs a `PropertiesService` write so it becomes visible the next time a human opens the sheet or the menu.

## Integration Points Summary

### External services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `LockService.getScriptLock()` | `tryLock(ms)` at top of `onFormSubmit` (30s) and `recalcularPanoramaConAlerta` (5-10s); release in `finally` after `SpreadsheetApp.flush()` | Script-scoped lock correctly serializes both entry points against each other; `tryLock` (not `waitLock`) chosen so failure is a graceful boolean, not an exception funneled through the outer try/catch |
| `PropertiesService.getScriptProperties()` | `setProperty`/`getProperty`/`deleteProperty` via two small helpers in new `src/Fiabilidad.gs` | Only durable channel available from a headless trigger execution; bridges to the next human-facing menu action |
| Jest (Node, dev-only) | `require()`s `src/Core.gs` via `moduleFileExtensions` config + guarded `module.exports` shim | Zero production/deploy impact; no `clasp` needed for this specific goal |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `Alertas.gs` (`onFormSubmit`) ↔ `Panorama.gs` (`recalcularPanorama`) | Direct function call, return value (buckets) | Unchanged; lock now wraps this call from the `Alertas.gs` side |
| `Alertas.gs` ↔ new `Fiabilidad.gs` | Direct function call (`registrarResultadoParcial`) | New; only from the per-bucket catch block |
| `Main.gs` (`recalcularPanoramaConAlerta`) ↔ new `Fiabilidad.gs` | Direct function call (`leerYLimpiarResultadoParcial`) | New; read-and-clear at the top of the handler, prepended to the existing `ui.alert()` |
| `tests/*.test.js` ↔ `src/Core.gs` | `require()` via Jest module resolution | New; one-directional, test-only, no runtime coupling |

## Sources

- LockService / Lock class reference (tryLock vs waitLock, releaseLock semantics): https://developers.google.com/apps-script/reference/lock/lock
- LockService overview and form-submission locking example (getScriptLock, waitLock(30000) pattern, flush-before-release): https://developers.google.com/apps-script/reference/lock/lock-service
- Installable Triggers guide (execution-failure email notifications, trigger quota reference pointer): https://developers.google.com/apps-script/guides/triggers/installable
- Community patterns for testing Apps Script pure functions with Jest/Node (`gas-local`, guarded `module.exports` shim, dual-environment `.gs` files) — MEDIUM confidence, WebSearch-sourced, recommend a short spike before roadmap commitment:
  - https://medium.com/geekculture/taking-away-the-pain-from-unit-testing-in-google-apps-script-98f2feee281d
  - https://github.com/mzagorny/gas-local
  - https://github.com/lastlink/google-app-script-ts-jest
- This repo's own architecture/structure/concerns maps (file/function-level ground truth used throughout): `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONCERNS.md`

---
*Architecture research for: Reliability hardening of an existing Google Apps Script automation*
*Researched: 2026-07-25*
