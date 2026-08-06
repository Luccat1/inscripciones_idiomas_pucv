---
phase: quick
plan: 260806-i7t
subsystem: core
tags: [sync, test-harness, nivel-sequence, siguienteNivel]
dependency_graph:
  requires: []
  provides: [CONFIG.nivelesPorIdioma, siguienteNivel, encontrarHorarioNoReconocido]
  affects: [src/Config.gs, src/Core.gs, test/Core.test.js]
tech_stack:
  added: []
  patterns: [per-idioma-catalog-with-default-fallback]
key_files:
  created: []
  modified:
    - src/Config.gs
    - src/Core.gs
    - test/Core.test.js
decisions:
  - normalizarNivel now takes idioma arg and looks up against nivelesPorIdioma sequence instead of flat CONFIG.niveles array
  - siguienteNivel returns nivelPorEvaluar for both unrecognized and top-of-scale levels (same safe fallback)
metrics:
  duration_min: 15
  completed_date: "2026-08-06"
  tasks_completed: 3
  files_modified: 3
---

# Quick Task 260806-i7t: Sincronizar repo local con version de Apps Script Summary

**One-liner:** Synced local repo with deployed Apps Script by adding per-idioma level sequences (nivelesPorIdioma), siguienteNivel() advancement logic, and unrecognized-schedule tracking; 21 tests green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add CONFIG.nivelesPorIdioma to Config.gs | acd94e6 | src/Config.gs |
| 2 | Replace src/Core.gs with Apps Script version | 69d6df4 | src/Core.gs |
| 3 | Update test/Core.test.js for new signatures | f7c655d | test/Core.test.js |

## What Was Done

**Task 1 — Config.gs:** Added `nivelesPorIdioma` property to `CONFIG` with two entries: `'Japonés': ['A1.1']` (single level this semester) and `'_default': ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B1+', 'B2.1', 'B2.2', 'C1.1', 'C1.2']` (11 levels including B1+). Same catalog-with-default-fallback pattern as `horariosPorIdioma`.

**Task 2 — Core.gs:** Replaced with the Apps Script version:
- `leerRespuestas()` now returns `{ inscripciones, horarioNoReconocido: { count, ejemplos } }` instead of a bare array
- `determinarNivel(conoceNivelResp, nivelDeclaradoResp, idioma)` — 3rd arg added; 'con exactitud' branch now calls `siguienteNivel()` instead of `normalizarNivel()`
- New `siguienteNivel(nivel, idioma)` — looks up sequence from `nivelesPorIdioma`, returns next level or `nivelPorEvaluar` if at top/unrecognized
- New `encontrarHorarioNoReconocido(celda, idioma)` — returns unmatched schedule label strings for diagnostic tracking
- `normalizarNivel(valor, idioma)` — 2nd arg added; matches against `nivelesPorIdioma[idioma]` sequence instead of flat `CONFIG.niveles`
- `module.exports` extended with `siguienteNivel`, `encontrarHorarioNoReconocido`, `leerRespuestas`

**Task 3 — Core.test.js:** Updated to match new signatures:
- Added `siguienteNivel` and `encontrarHorarioNoReconocido` to imports
- All `determinarNivel` calls updated with 3rd `idioma` arg ('Inglés')
- 'con exactitud' test updated: now expects next-level behavior (A1.1 -> A1.2)
- Francés test description updated (Francés now has its own catalog entry)
- Added 4 new `siguienteNivel` tests: next level, top-of-scale, unrecognized level, Japonés single-level edge case

## Test Results

```
# tests 21
# suites 6
# pass 21
# fail 0
```

All 21 tests passing (12 pre-existing + 4 new siguienteNivel + 5 updated determinarNivel).

## Deviations from Plan

None — plan executed exactly as written. The plan described the changes needed; the implementation matched the described behavior precisely.

## Known Stubs

None. All wired to real CONFIG data.

## Self-Check: PASSED

- src/Config.gs exists and exports CONFIG.nivelesPorIdioma with '_default' (11 levels) and 'Japonés' (['A1.1']) ✓
- src/Core.gs exports siguienteNivel, encontrarHorarioNoReconocido, leerRespuestas ✓
- test/Core.test.js: 21 tests, 0 failures ✓
- Commits acd94e6, 69d6df4, f7c655d present in git log ✓
