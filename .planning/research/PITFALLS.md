# Pitfalls Research

**Domain:** Retrofitting reliability (locking, error handling, automated testing) onto a live, unmonitored Google Apps Script automation with real institutional users (IDIOMAS PUCV enrollment panorama)
**Researched:** 2026-07-25
**Confidence:** MEDIUM — LockService/clasp/quota mechanics verified against official docs and multiple community sources (HIGH); specific "teams commonly get X wrong" framing is synthesized from community bug reports, GitHub issues, and this codebase's own documented history (MEDIUM). Flagged individually below.

## Critical Pitfalls

### Pitfall 1: Lock acquired but never released because `releaseLock()` isn't in a `finally` block

**What goes wrong:**
A developer wraps the critical section (`recalcularPanorama()` + alert dispatch) with `lock.waitLock(ms)` ... `lock.releaseLock()`, but places the release call at the end of the `try` block or after the risky code, not in `finally`. The very bug this milestone is fixing (`enviarAvisoUmbral` throwing mid-send, a `MailApp` quota exception, or a data-shape error in `construirBuckets`) then throws *inside* the locked section. The lock is never released. Every subsequent form submission blocks until the script's own lock timeout elapses on `waitLock()`, and in the worst case (a lock acquired outside any script execution boundary, e.g. via a manually invoked debug run that then errors) it can appear "stuck" until Apps Script's own lock expiry (locks auto-expire after some minutes, but that can still mean an entire enrollment day of the panorama not updating).

**Why it happens:**
This codebase's own convention (documented in CONVENTIONS.md) is "never re-throw" and "log and continue" inside trigger handlers — a habit of defensive-but-loose error handling. Developers porting that same mental model to lock management often write `try { ...; lock.releaseLock(); } catch (e) { Logger.log(e); }` — release only on the happy path — instead of recognizing that lock release is exactly the kind of operation that must run unconditionally, unlike alert-sending which can legitimately be skipped on failure.

**How to avoid:**
Every lock acquisition must have exactly one `finally` block whose only job is `lock.releaseLock()`. Do not put any other logic in that `finally` (no logging, no email — those can throw and abort the release). Pattern:
```javascript
const lock = LockService.getScriptLock();
try {
  lock.waitLock(30000);
  // critical section: recalcularPanorama() + alert dispatch
} catch (e) {
  Logger.log('No se pudo adquirir el lock o falló el proceso: ' + e.message);
} finally {
  lock.releaseLock();
}
```
Note `releaseLock()` itself is safe to call even if the lock was never successfully acquired (it's a no-op then), so it is always safe to put in `finally` unconditionally.

**Warning signs:**
- Code review finds `releaseLock()` anywhere other than the last line of a `finally` block.
- Manual test: force an exception inside the locked section (e.g., temporarily throw in `recalcularPanorama`) and confirm the *next* trigger execution still completes promptly — if it hangs or times out, the lock leaked.

**Phase to address:**
Locking (LockService) hardening item.

**Confidence:** HIGH (official Apps Script docs + multiple independent community sources agree finally-block release is the standard, and its omission is the most commonly cited mistake).

---

### Pitfall 2: Locking the entire `onFormSubmit` body, including the email send, causes cascading trigger timeouts under quota/slowness

**What goes wrong:**
To be "safe," the whole `onFormSubmit()` function body (read responses, recalc, build buckets, send every alert email) gets wrapped inside the lock instead of just the shared-state read/write. If `MailApp` is slow, or several buckets cross threshold at once and each `enviarAvisoUmbral()` call takes a few hundred ms, the lock is held for the entire duration. Under a burst of near-simultaneous form submissions (the exact scenario this milestone is defending against), the second and third submitters' triggers queue up waiting on `waitLock()`, and if the queue backs up past the installable trigger's own execution budget, later submissions can fail with a lock-timeout exception that — per this codebase's own "no re-throw in triggers" convention — gets silently logged and swallowed, meaning that submission's panorama update/alert never happens and nobody notices.

**Why it happens:**
It feels safer to lock "everything" rather than reason precisely about what the critical section actually is (the read-modify-write of the Panorama sheet and `_Estado_Avisos`). Over-locking is the path of least cognitive effort but directly reintroduces a version of the "silent drop" bug class this milestone exists to fix.

**How to avoid:**
Scope the lock tightly to the read + write of shared mutable state: `leerRespuestas()` → `construirBuckets()` → `escribirHojaPanorama()` → the `_Estado_Avisos` read/write for dedup-check-and-mark. Keep the lock held only as long as needed to make that sequence atomic. If alert email sending must remain serialized too (to protect `_Estado_Avisos` correctly), keep it inside the lock but keep the per-bucket try/catch (see Pitfall 6 / Concerns doc) so one slow/failing send doesn't extend lock hold time for everyone — and choose a `waitLock` timeout (see Pitfall 3) that accounts for realistic email-count-per-run at this project's actual bucket count (small, per PROJECT.md's "tens to low hundreds of rows/semester").

**Warning signs:**
- Lock is acquired before `leerRespuestas()` and released after the last `MailApp.sendEmail()` call in the loop, rather than scoped around just the sheet mutations.
- Load-test/manual test: submit the form twice within ~1 second of each other during a state where 2+ buckets are about to cross threshold; watch execution log for `waitLock` timeout exceptions on the second run.

**Phase to address:**
Locking (LockService) hardening item.

**Confidence:** MEDIUM (synthesized best practice — locking scope minimization is a recurring theme across Apps Script community guidance — but no single authoritative source stated this exact failure chain for this codebase).

---

### Pitfall 3: `waitLock()` timeout picked arbitrarily, without validating against actual worst-case execution time of the locked section

**What goes wrong:**
A round number like `lock.waitLock(30000)` (30s) or `lock.waitLock(10000)` (10s, from a copy-pasted tutorial) gets used without checking whether it's longer than the locked section could plausibly take. If the locked section includes multiple `MailApp.sendEmail()` calls (one per bucket crossing threshold) plus a full-sheet read/rewrite (`getDataRange().getValues()` + per-row `setBackground()` per the Performance Bottleneck already documented in CONCERNS.md), a burst of 3-4 simultaneous submissions with several buckets crossing at once can genuinely take longer than a short timeout, causing legitimate (non-buggy) contention to be misdiagnosed as a hang, or conversely a timeout set too long (60s+) makes every legitimate submitter's form-submit trigger appear to "hang" from the requester's perspective if something upstream is slow.

**Why it happens:**
`waitLock()`'s argument is milliseconds, easy to under-think as "some safety margin" rather than derived from the actual critical section's measured or estimated runtime. Tutorials and Stack Overflow snippets almost universally use round numbers (10000, 30000) with no justification tied to the copier's own workload.

**How to avoid:**
Measure (via `Logger.log(new Date())` bracketing, or the existing execution transcript) the typical and worst-case duration of the locked section at current data volumes (documented as tens to low-hundreds of rows/semester per PROJECT.md), then set the timeout to comfortably exceed worst-case (e.g., 2-3x observed worst case), not a copy-pasted default. Re-validate this number if/when the "Archive historical rows" scaling concern in CONCERNS.md is eventually addressed, since row count directly affects `leerRespuestas()` duration.

**Warning signs:**
- Timeout value has no comment explaining why that number was chosen.
- No log line recording how long the critical section actually took, making it impossible to tell later if the timeout is well-calibrated.

**Phase to address:**
Locking (LockService) hardening item.

**Confidence:** MEDIUM (general engineering principle; specific numeric guidance is project-specific and would need to be validated by measurement during implementation, not asserted here).

---

### Pitfall 4: Adopting `clasp` overwrites production code that only exists in the Apps Script editor, or the reverse — pushing stale local code over live production edits

**What goes wrong:**
This project has never used `clasp`; all `.gs` files were "deployed by copy-pasting into the Apps Script editor" (per PROJECT.md/CONVENTIONS.md). If clasp is adopted mid-milestone, the two most common failure modes are: (a) running `clasp push` from a local clone that predates some small production-only fix or config tweak (e.g., an emergency `CONFIG.semestre` edit made directly in the editor to unblock a live issue) — `clasp push` silently overwrites the entire project, discarding that live edit with no diff or confirmation beyond a generic prompt; (b) running `clasp pull` first without realizing the local repo state and the live Apps Script project have diverged, so `git`'s view of "current" and the live script's view of "current" are silently reconciled by whichever direction was pushed last, losing whichever side wasn't chosen. Because this project's git history predates clasp (five prior commits, all manual), there is no baseline commit that is guaranteed to match what is *actually deployed and running* right now.

**Why it happens:**
`clasp push`/`clasp pull` are full-project overwrites, not merges — the underlying Apps Script API has no partial-file diff/merge capability (confirmed via clasp GitHub issues). Teams instinctively treat clasp like git (which supports merge) rather than a "last write wins" file-transfer tool, and don't establish a "the local clone is not authoritative until we've clasp-pulled and diffed against production first" discipline before their first push.

**How to avoid:**
Before ever running `clasp push` on this project: run `clasp clone <SCRIPT_ID>` (not `clasp create`) into a clean directory to capture the *actual current live state*, diff that against the git repo's `src/` directory file-by-file, and reconcile any drift (commit it, even if "found extra prod edit not in git") before the first `clasp push` ever happens. Establish and document the rule from PROJECT.md/AGENTS.md onward: after clasp adoption, all edits happen in the local clone + git, never again directly in the Apps Script web editor, specifically to avoid this class of divergence recurring.

**Warning signs:**
- `clasp clone` output shows any file content differing from what's currently committed in `src/`, especially `Config.gs` (which holds the semester label most likely to be hand-edited live in an emergency).
- No documented "editor lockdown" instruction exists yet for staff/collaborators post-clasp-adoption.

**Phase to address:**
clasp adoption (if chosen as the test-infrastructure path, per PROJECT.md's pending Key Decision).

**Confidence:** HIGH (confirmed via official clasp docs and multiple GitHub issues — clone-before-push and full-overwrite-not-merge behavior are well documented; the specific institutional risk framing (this project's emergency-edit history) is MEDIUM/inferred).

---

### Pitfall 5: `appsscript.json` manifest gets silently overwritten or its OAuth scopes drift from what's actually needed, breaking authorization after the next push

**What goes wrong:**
`clasp push` treats `appsscript.json` like any other project file — it will overwrite the live manifest with whatever is in the local `appsscript.json`, including `oauthScopes`, `timeZone`, and `runtimeVersion`. If the live project's manifest was ever edited directly in the editor (e.g., Google auto-added a scope when a new API was used, or an admin changed the timezone), and the local `appsscript.json` clasp starts from doesn't reflect that, the next `clasp push` silently reverts it. Conversely, adding `LockService` and any new API surface as part of this milestone might implicitly require scope changes that aren't reflected in a manually-maintained `appsscript.json`, and clasp does not auto-detect required scopes from code the way the web editor's implicit authorization flow does — leading to "Authorization is required to perform that action" errors post-push that trace back to a manifest that's now out of sync with what the code actually calls.
Note: `LockService` itself requires no special OAuth scope beyond what a container-bound script already has, so this specific milestone's locking work is *not* expected to need new scopes — but any accompanying change (e.g., a new Sheets/Mail API surface touched while hardening) could trigger this.

**Why it happens:**
Manifest handling is one of clasp's most-reported friction points (multiple open GitHub issues on "manifest overwritten unexpectedly" / "push warns about different manifest but still overwrites"). Developers don't treat `appsscript.json` as a file requiring the same review diligence as `.gs` source, since it's config-shaped rather than code-shaped.

**How to avoid:**
Treat `appsscript.json` changes with the same review rigor as source changes — diff it explicitly before every push during the clasp-adoption window, not just the `.gs` files. If any new advanced service or scope is required by hardening work, add it explicitly to `oauthScopes` in the manifest and re-authorize (`clasp login`) rather than relying on implicit web-editor authorization, which clasp workflows bypass.

**Warning signs:**
- `clasp push` output includes the "manifest has been updated, overwrite?" warning and it gets auto-confirmed without inspection.
- Post-push, any menu action throws a fresh authorization prompt/error that wasn't present before.

**Phase to address:**
clasp adoption (if chosen).

**Confidence:** HIGH for the mechanic (documented in clasp issues #424, #468, #756, #994 and official docs); MEDIUM for applicability to this specific milestone (LockService itself needs no new scope, so this pitfall is conditional on other scope-affecting changes happening alongside it).

---

### Pitfall 6: "Just extracting" a pure function for testing subtly changes its behavior because the original was never actually pure

**What goes wrong:**
The five target functions (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) look pure (no `SpreadsheetApp`/`MailApp` calls per CONCERNS.md), but "extraction" for a Node/Jest test harness often means copying the function body into a new file/module boundary, and in that copy step it's easy to introduce a behavior change: e.g., silently changing `CONFIG` from "read as a live global" to "passed as a parameter with a mock/default value" that doesn't perfectly mirror the real `CONFIG.horariosPorIdioma`/`CONFIG.formCols` shape, or subtly changing falsy-value handling (this codebase's convention is to return `''`/`[]`/`{}` rather than `null`/`undefined` — a test-friendly refactor might accidentally introduce a `null` return path that behaves differently than production for an edge case never previously exercised, e.g., a completely empty header row).

**Why it happens:**
Under time pressure, "extract for testing" and "add a test" get conflated with "quietly clean up the function while I'm in there" (rename a variable, add an early return, tighten a conditional) — classic scope creep during refactor. Without a pre-existing test capturing current behavior, there's no safety net catching the drift, and the risk is compounded here because there are zero existing tests today (per CONCERNS.md/PROJECT.md) — this milestone is establishing the first tests for these functions, meaning the "characterization test first, refactor second" order is not optional, it's the only way to know if extraction preserved behavior.

**How to avoid:**
For each of the five functions: (1) write characterization tests against the *current, unmodified* function first, using the ~10 real form responses referenced in CHANGELOG.md as fixture data (since that's the only validated real-world dataset that exists) plus the known edge cases already documented in CONCERNS.md (unmatched horario label, Francés falling to `_default`, empty header match) — capture current actual output, not hoped-for output; (2) only after those tests pass against the original code, perform the extraction/move; (3) re-run the exact same tests unchanged against the extracted version and confirm byte-identical pass/fail — any test that needs modification to pass post-extraction is a signal the extraction changed behavior, not just location.

**Warning signs:**
- A "test" is written and immediately passes against the newly-extracted function without ever having been run against the original in-place function first.
- Test fixtures were invented from scratch rather than derived from the ~10 real form responses or the specific bug cases in CHANGELOG.md/CONCERNS.md.
- Extraction PR/commit touches more lines than a pure copy-paste + module-boundary wrapper would require.

**Phase to address:**
Automated testing (test-extraction) hardening item.

**Confidence:** MEDIUM (this is a well-known refactoring risk pattern — "characterization tests before refactor" is standard practice per multiple refactoring sources — but the specific manifestation for these 5 functions is inferred from the codebase's documented conventions, not observed elsewhere).

---

### Pitfall 7: Fixing the pre-check quota case (`getRemainingDailyQuota() <= 0`) but not wrapping the actual `MailApp.sendEmail()` call in try/catch, leaving the mid-send exception path unfixed

**What goes wrong:**
CONCERNS.md's documented bug is precise: `enviarAvisoUmbral()` checks quota *before* sending and returns without sending (silently) when quota is exhausted — and the fix approach given is "make it return a boolean / throw a distinguishable error, only call `marcarComoAvisado()` on success." A team implementing this fix can satisfy that letter of the requirement by only handling the pre-check branch (`if (quota <= 0) return false;`) while leaving the actual `MailApp.sendEmail(...)` call unwrapped in try/catch. But quota isn't the only way `sendEmail` can fail mid-call — transient Gmail-side errors, malformed recipient addresses, or a race where quota is available at check-time but exhausted by a concurrent trigger's sends before this call executes (exactly the scenario LockService is meant to close, but only once implemented) can all throw *from inside* `sendEmail()` itself, not from the pre-check. If that throw isn't caught locally, it propagates up to whatever try/catch wraps the caller — which, per this codebase's per-bucket-isolation hardening goal, must not let one bucket's exception abort the rest of the loop (see CONCERNS.md's "Single exception aborts alert processing" bug). Fixing only the boolean-return pre-check path without also try/catching the actual send call means the exact bug class the milestone targets (silent-mark-as-sent, or one bucket poisoning the whole run) survives for the mid-send failure case even though it looks fixed for the pre-check case.

**Why it happens:**
The documented bug report anchors attention on the pre-check line (`if (MailApp.getRemainingDailyQuota() <= 0)`) because that's where the *known* production symptom was traced to. It's natural to patch exactly that line and consider the ticket closed, without asking "what if the exhaustion happens between my check and my send" or "what if `sendEmail` throws for a reason other than quota."

**How to avoid:**
Wrap the actual `MailApp.sendEmail(...)` call itself in try/catch inside `enviarAvisoUmbral()`, in addition to (not instead of) the pre-check optimization (the pre-check is still worth keeping as a fast-path to avoid a wasted API call, but must not be the *only* guard). Only call `marcarComoAvisado()` when the try block completes without exception — this makes both the pre-check-return-false path and the throws-mid-send path converge on the same "not marked as sent" outcome. Combine with the per-bucket try/catch already scoped for the loop-isolation fix so a mid-send exception for one bucket doesn't propagate past that bucket's iteration.

**Warning signs:**
- Code review finds `MailApp.sendEmail()` called with no surrounding try/catch anywhere in `enviarAvisoUmbral()`, even after the "fix."
- The only quota-related test is one that mocks `getRemainingDailyQuota()` returning `0` — no test exercises `MailApp.sendEmail` itself throwing.

**Phase to address:**
Quota/silent-failure fix hardening item (alert-sent-state correctness).

**Confidence:** MEDIUM-HIGH (the general "pre-check vs. actual-call" race/gap pattern is a well-established class of bug in quota-limited APIs generally; its specific applicability to `MailApp` mid-send exceptions is inferred from Apps Script's documented quota-exception behavior — "if you exceed a quota, your script throws an exception and execution stops" — combined with this codebase's exact current code shape from CONCERNS.md).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Lock the entire `onFormSubmit()` body instead of just the shared-state critical section | Simpler to reason about ("everything is safe") | Extends lock hold time, risks legitimate contention timeouts during bursts, reintroduces silent-drop risk if timeout exceptions get swallowed by the "never re-throw in triggers" convention | Never, for this project's stated goal of concurrency correctness without degrading UX during busy enrollment windows |
| Skip characterization tests and write tests directly against newly-extracted functions | Faster to "get to green" on first test run | Cannot distinguish "extraction preserved behavior" from "extraction changed behavior," defeating the whole purpose of testing the functions responsible for the v1.1.0 regressions | Never — this project's explicit reason for testing is to prevent recurrence of exactly this kind of silent drift |
| Patch only the pre-check quota branch, leave `sendEmail()` itself unwrapped | Closes the literal reported symptom fastest | Leaves the mid-send exception path (transient errors, race conditions) exhibiting the same silent-mark-as-sent bug class | Never, given LockService is being added in the same milestone specifically to reduce (not eliminate) the race window — the mid-send guard is still needed independently |
| Adopt clasp by just running `clasp create`/pushing local files without first `clasp clone`-diffing against live state | Fastest path to "we have clasp now" | Risks silently discarding any production-only edit made directly in the editor since the last commit (five prior commits are all manual copy-paste deploys, so there is no guaranteed-current git baseline) | Never for the first clasp push on this project; acceptable only after the clone-and-diff reconciliation step is done once |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|-----------------|-------------------|
| `LockService.getScriptLock()` | Treating it as a per-user lock; assuming it doesn't affect other users' concurrent executions | `getScriptLock()` is global across all users/executions of the script — scope critical sections tightly since every submitter blocks every other submitter, not just themselves |
| `LockService` + trigger error handling | Letting a `waitLock()` timeout exception be silently swallowed by the existing "never re-throw in `onFormSubmit`" convention with no staff-visible signal | Log a distinguishable message for lock-timeout specifically (not folded into the generic catch-all), so repeated timeouts are detectable in execution history even though the form response itself must still not be blocked |
| `clasp push`/`clasp pull` | Treating clasp sync like git merge (assuming divergent local/live changes get reconciled) | Full-file overwrite only, no merge — always `clasp clone`+diff before the first push on a project with editor-only history, and after adoption, forbid direct web-editor edits going forward |
| `MailApp` daily quota | Checking `getRemainingDailyQuota()` once before a loop of several sends, assuming quota can't change mid-loop | Quota can be exhausted mid-loop by the sends already made in *this same* loop (each send consumes quota) — re-check or catch per-send, don't rely on a single upfront check for a multi-bucket run |
| `MailApp.sendEmail` exceptions | Assuming all send failures are quota-related and handling only that message pattern | Malformed recipient, transient Gmail error, and quota exhaustion can all throw from inside `sendEmail()` — catch generically at the call site and treat any exception (not just quota-shaped messages) as "not sent" |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Lock scoped around the full read/rewrite of "Panorama de Cursos" (including the per-row `setBackground()` loop already flagged as a performance bottleneck in CONCERNS.md) | Lock hold time grows linearly with sheet size, since it now gate-keeps an O(n) operation | Batch background-color writes with `setBackgrounds()` (already recommended in CONCERNS.md) *before or alongside* introducing the lock, so the lock's hold time reflects the improved (batched) implementation, not the current per-row-call one | Becomes noticeable once the responses sheet grows across multiple semesters without archiving (already flagged as a scaling limit in CONCERNS.md) |
| `waitLock()` timeout tuned only against today's data volume (tens to low-hundreds of rows/semester) | Timeout that's fine today silently becomes too short as the sheet grows across semesters, since `leerRespuestas()` is a full O(n) re-read every run | Re-derive the timeout value if/when semester archiving is addressed; treat the timeout constant as something to revisit alongside any change to `leerRespuestas()`'s read strategy | Same scaling boundary as the existing "Google Apps Script installable-trigger execution time limit" concern already documented in CONCERNS.md |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding `LockService` or new advanced services without reviewing whether `appsscript.json`'s `oauthScopes` need updating | Post-clasp-push authorization errors (`Authorization is required to perform that action`) surface confusingly at runtime rather than at deploy time, potentially breaking the live trigger for staff mid-semester | Review and explicitly declare any new scope needs in the manifest as part of the same PR/commit that adds the code requiring it, and re-authorize deliberately rather than relying on implicit web-editor prompts that clasp workflows bypass |
| Treating clasp's local clone as automatically authoritative over the live project without diffing first | Silent loss of any manual emergency edit made directly in the Apps Script editor since the last commit (plausible here, since `CONFIG.semestre` is documented in CONCERNS.md as a manual, error-prone, hand-edited value) | `clasp clone` + diff against `src/` before the first push; document and enforce "no more direct editor edits" for all collaborators once clasp is adopted |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Lock-timeout exceptions during a busy enrollment window get logged only via `Logger.log()`, invisible to staff (same failure mode CONCERNS.md already documents for unmatched-horario and column-mismatch cases) | Staff have no way to know a submission was delayed/dropped due to contention, mirroring the exact "invisible until someone reads execution logs" problem this milestone exists to fix elsewhere | Surface lock-timeout occurrences the same way the "🔄 Recalcular Panorama" completion dialog surfaces discarded-row/unmatched-horario counts — e.g., a lightweight counter in `_Estado_Avisos` or a dedicated diagnostics area, consistent with the milestone's stated goal of staff-facing (not log-only) failure visibility |
| Testing infrastructure (clasp/Jest) introduced in a way that only the original developer can run tests, with no equivalent staff-facing verification | Non-technical maintainers (explicit constraint in PROJECT.md) lose confidence the system is "verified" since the improvement is invisible to them | Keep the existing manual verification tools (test-alert menu, "Detectar columnas") functioning and documented as the staff-facing verification layer; automated tests are a developer-facing safety net, not a replacement for the staff-visible menu-driven checks this project's non-technical-maintainer constraint requires |

## "Looks Done But Isn't" Checklist

- [ ] **LockService added:** Often missing a `finally`-scoped `releaseLock()` — verify by forcing an exception inside the locked section during manual testing and confirming the next execution isn't blocked.
- [ ] **LockService added:** Often locks too broad a scope (whole trigger body instead of just shared-state read/write) — verify by checking exactly which statements sit between `waitLock()` and the point release happens.
- [ ] **Quota/silent-failure fix:** Often fixes only the `getRemainingDailyQuota() <= 0` pre-check branch — verify by confirming `MailApp.sendEmail()` itself is wrapped in its own try/catch and that `marcarComoAvisado()` is called only inside that try's success path, not unconditionally after it.
- [ ] **Per-bucket isolation fix:** Often wraps the `forEach` in one big try/catch at the loop level rather than one try/catch per bucket inside the loop body — verify a thrown exception for bucket #2 doesn't prevent bucket #3 from being evaluated/sent in the same run.
- [ ] **Pure-function tests added:** Often written against the already-extracted/refactored version only — verify a "characterization" commit exists (or test output was manually diffed) showing the tests also passed against the original in-place function before extraction.
- [ ] **clasp adoption (if chosen):** Often skips reconciling live-editor state before the first push — verify `clasp clone` output was diffed against the git `src/` tree and any drift was resolved/committed before any `clasp push` occurred.
- [ ] **Staff-facing error surfacing:** Often adds new failure-detection logic (discarded-row counts, lock timeouts, unmatched-horario counts) but leaves it as `Logger.log()`-only — verify each new failure mode this milestone introduces is echoed in a `ui.alert()`/dialog, per this project's own established convention for menu-invoked functions.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Lock leaked (never released) after a bad deploy | LOW | Locks auto-expire after Apps Script's internal maximum hold time; alternatively, redeploying the script (any edit + save) resets lock state. No data loss risk since the lock only gates the critical section, not persisted data. |
| clasp push overwrote a live-editor-only emergency edit (e.g., `CONFIG.semestre`) | MEDIUM | Apps Script keeps a version history in the editor's "See version history" — check there for the pre-overwrite state of the affected file/manifest and manually restore the lost edit into the local clone before the next push. |
| Test extraction silently changed behavior for an edge case not covered by the ~10 real-response fixture set | MEDIUM | Re-run the extracted function against the full historical "Respuestas de formulario 1" sheet data (not just the 10-response sample) and diff its output against what the live `Core.gs` currently produces for the same input, using the panorama's current aggregate counts as the ground truth to match. |
| Mid-send `MailApp` exception fix introduces a bug where a bucket is never retried even on transient failure | LOW | Because `_Estado_Avisos` is only marked on confirmed success (per the fix), the next `onFormSubmit` trigger run will naturally re-attempt any unmarked bucket — no manual intervention needed, this is the same self-healing property CONCERNS.md already notes for the existing per-run try/catch. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Lock never released on exception (Pitfall 1) | Locking (LockService) | Force an exception inside the locked section in a test run; confirm next execution isn't blocked |
| Lock scoped too broadly (Pitfall 2) | Locking (LockService) | Code review confirms lock brackets only the shared-state read/write, not the full trigger body |
| Arbitrary/uncalibrated lock timeout (Pitfall 3) | Locking (LockService) | Timeout value has an inline comment citing measured worst-case duration at current data volume |
| clasp push/pull data loss (Pitfall 4) | clasp adoption (if chosen) | `clasp clone` + diff performed and reconciled before first `clasp push`; documented in commit message |
| Manifest/OAuth scope drift (Pitfall 5) | clasp adoption (if chosen) | `appsscript.json` diffed and reviewed on every push during adoption window; scopes explicitly declared, not implicit |
| Extraction changes behavior silently (Pitfall 6) | Automated testing (test extraction) | Characterization tests written and passing against original in-place function before any extraction/move occurs |
| Quota fix covers pre-check only, not mid-send (Pitfall 7) | Quota/silent-failure fix | `MailApp.sendEmail()` call itself wrapped in try/catch; test exercises `sendEmail` throwing directly, not just quota-check returning 0 |

## Sources

- [Class LockService | Apps Script | Google for Developers](https://developers.google.com/apps-script/reference/lock/lock-service) — HIGH confidence, official docs
- [Class Lock | Apps Script | Google for Developers](https://developers.google.com/apps-script/reference/lock/lock) — HIGH confidence, official docs
- [Manage Google Form onFormSubmit script executions with Script Lock – AppsScriptPulse](https://pulse.appsscript.info/p/2024/01/control-google-form-submissions-script-executions-with-script-lock/) — MEDIUM confidence, community tutorial confirming waitLock/finally pattern
- [Google Apps Script community: LockService confirmation I'm doing it right](https://groups.google.com/g/google-apps-script-community/c/Vy_gw6Z_0SY) — MEDIUM confidence
- [Use the command-line interface with clasp | Apps Script | Google for Developers](https://developers.google.com/apps-script/guides/clasp) — HIGH confidence, official docs
- [GitHub - google/clasp](https://github.com/google/clasp) — HIGH confidence, official repo/README
- [clasp push warns if you have a different manifest locally · Issue #424](https://github.com/google/clasp/issues/424) — MEDIUM confidence, GitHub issue
- [Suppress "Manifest file has been updated" message when pushing · Issue #468](https://github.com/google/clasp/issues/468) — MEDIUM confidence, GitHub issue
- [Unable to stop pushing manifest file appscript.json · Issue #994](https://github.com/google/clasp/issues/994) — MEDIUM confidence, GitHub issue
- [Clasp push drops oauthScopes · Issue #756](https://github.com/google/clasp/issues/756) — MEDIUM confidence, GitHub issue
- [Quotas for Google Services | Apps Script | Google for Developers](https://developers.google.com/apps-script/guides/services/quotas) — HIGH confidence, official docs
- [Troubleshooting | Apps Script | Google for Developers](https://developers.google.com/apps-script/guides/support/troubleshooting) — HIGH confidence, official docs
- [Testing & Testability In Apps Script | Art of the Smart](https://artofthesmart.com/blog/testing-apps-script) — MEDIUM confidence, community best-practice article on isolating global-service calls for testability
- [Unit Testing in Google Apps Script: Pain-Free and Simple! — Dmitry Kostyuk, Medium](https://medium.com/geekculture/taking-away-the-pain-from-unit-testing-in-google-apps-script-98f2feee281d) — MEDIUM confidence
- [Functional Test Refactoring: Extract Function](https://agileway.substack.com/p/functional-test-refactoring-extract) — MEDIUM confidence, general refactoring/characterization-testing principle applied to this project's context
- Internal: `.planning/codebase/CONCERNS.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/PROJECT.md` (this project's own documented bug history and conventions, 2026-07-25) — HIGH confidence, primary source for project-specific risk framing

---
*Pitfalls research for: Retrofitting reliability (LockService, error handling, testing) onto a live production Google Apps Script automation*
*Researched: 2026-07-25*
