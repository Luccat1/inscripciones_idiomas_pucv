# Graph Report - .  (2026-07-23)

## Corpus Check
- 10 files · ~5,878 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 79 nodes · 161 edges · 7 communities
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.81)
- Token cost: 72,208 input · 0 output

## Community Hubs (Navigation)
- Reliability Patterns & Data Model
- Core Parsing Logic
- Config & Project Docs
- Alert & Notification Flow
- Apps Script Manifest
- Panorama Sheet & Semáforo
- Menu & Orchestration

## God Nodes (most connected - your core abstractions)
1. `AGENTS.md — AI Collaboration Guidelines` - 36 edges
2. `Core.js` - 17 edges
3. `README.md — Panorama de Inscripciones - IDIOMAS PUCV` - 16 edges
4. `Alertas.js` - 12 edges
5. `leerRespuestas()` - 11 edges
6. `Panorama.js` - 11 edges
7. `Main.js` - 10 edges
8. `onFormSubmit()` - 9 edges
9. `recalcularPanorama()` - 9 edges
10. `v1.0.0 (2026-07-23) — lanzamiento inicial` - 9 edges

## Surprising Connections (you probably didn't know these)
- `mapearColumnas()` --calls--> `buscarTodos()`  [INFERRED]
  src/Core.gs → AGENTS.md
- `onOpen()` --references--> `AGENTS.md — AI Collaboration Guidelines`  [EXTRACTED]
  src/Main.gs → AGENTS.md
- `README.md — Panorama de Inscripciones - IDIOMAS PUCV` --references--> `Google Sheets (fuente de datos)`  [EXTRACTED]
  README.md → AGENTS.md
- `Alertas.js` --references--> `AGENTS.md — AI Collaboration Guidelines`  [EXTRACTED]
  src/Alertas.gs → AGENTS.md
- `Alertas.js` --references--> `v1.0.0 (2026-07-23) — lanzamiento inicial`  [EXTRACTED]
  src/Alertas.gs → CHANGELOG.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Panorama de Inscripciones GAS pipeline (Config→Core→Panorama→Alertas→Main)** — src_config, src_core, src_panorama, src_alertas, src_main [INFERRED 0.85]
- **Code patterns for GAS reliability (config centralizada, no relanzar errores, idempotencia, cuota Gmail, UI feedback)** — concept_config_centralizada, concept_no_relanzar_errores, concept_idempotencia_avisos, concept_cuota_gmail, concept_ui_feedback [INFERRED 0.80]
- **Alert notification flow on threshold crossing** — src_alertas_onformsubmit, src_alertas_enviaravisoumbral, concept_estado_avisos, tech_mailapp [INFERRED 0.80]

## Communities (7 total, 0 thin omitted)

### Community 0 - "Reliability Patterns & Data Model"
Cohesion: 0.16
Nodes (14): AGENTS.md — AI Collaboration Guidelines, Bucket (agregación por idioma||nivel||horarioId), Config centralizada (todo valor institucional vive en CONFIG, nunca hardcodeado), Chequeo de cuota de Gmail antes de enviar avisos, _Estado_Avisos (hoja oculta de control de duplicados), Idempotencia de avisos (chequeo previo en _Estado_Avisos por claveBucket + semestre), Inscripción (data model: rowIndex, nombre, email, idioma, nivel, horarios, modalidades), No relanzar errores en el trigger (try/catch silencioso en onFormSubmit) (+6 more)

### Community 1 - "Core Parsing Logic"
Cohesion: 0.27
Nodes (15): Core.js, construirBuckets(), contarPersonasUnicasPorNivel(), determinarNivel(), leerRespuestas(), mapearColumnas(), normalizarEmail(), normalizarIdioma() (+7 more)

### Community 2 - "Config & Project Docs"
Cohesion: 0.22
Nodes (13): CHANGELOG.md — Panorama de Inscripciones, v1.0.0 (2026-07-23) — lanzamiento inicial, v1.1.0 (2026-07-23) — corrección de descarte de inscripciones, Correo canónico (usar cuenta Google, no campo tipeado), nivelPorEvaluar (bucket administrativo, no es nivel formal del currículo), Hoja 'Panorama de Cursos', Ramas condicionales por idioma en el Form (columnas duplicadas, arrays de índices), Semáforo automático (🟢/🟡/⚪) reemplazando revisión manual con tablas dinámicas (+5 more)

### Community 3 - "Alert & Notification Flow"
Cohesion: 0.42
Nodes (10): Alertas.js, claveBucket(), enviarAvisoUmbral(), getAvisoHtml(), HEADERS_ESTADO_AVISOS, leerEstadoAvisos(), limpiarEstadoAvisos(), marcarComoAvisado() (+2 more)

### Community 4 - "Apps Script Manifest"
Cohesion: 0.22
Nodes (8): dependencies, exceptionLogging, oauthScopes, runtimeVersion, timeZone, https://www.googleapis.com/auth/gmail.send, https://www.googleapis.com/auth/script.scriptapp, https://www.googleapis.com/auth/spreadsheets.currentonly

### Community 5 - "Panorama Sheet & Semáforo"
Cohesion: 0.42
Nodes (9): Panorama.js, colorParaConteo(), escribirHojaPanorama(), estadoParaConteo(), formatearModalidades(), getPanoramaHtml(), HEADERS_PANORAMA, recalcularPanorama() (+1 more)

### Community 6 - "Menu & Orchestration"
Cohesion: 0.29
Nodes (5): Main.js, iniciarNuevoSemestre(), instalarAutomatizacion(), onOpen(), recalcularPanoramaConAlerta()

## Knowledge Gaps
- **11 isolated node(s):** `timeZone`, `dependencies`, `exceptionLogging`, `runtimeVersion`, `https://www.googleapis.com/auth/spreadsheets.currentonly` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AGENTS.md — AI Collaboration Guidelines` connect `Reliability Patterns & Data Model` to `Core Parsing Logic`, `Config & Project Docs`, `Alert & Notification Flow`, `Panorama Sheet & Semáforo`, `Menu & Orchestration`?**
  _High betweenness centrality (0.442) - this node is a cross-community bridge._
- **Why does `README.md — Panorama de Inscripciones - IDIOMAS PUCV` connect `Config & Project Docs` to `Reliability Patterns & Data Model`, `Core Parsing Logic`, `Alert & Notification Flow`, `Panorama Sheet & Semáforo`, `Menu & Orchestration`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `Panorama.js` connect `Panorama Sheet & Semáforo` to `Reliability Patterns & Data Model`, `Config & Project Docs`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `leerRespuestas()` (e.g. with `determinarNivel()` and `recalcularPanorama()`) actually correct?**
  _`leerRespuestas()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `timeZone`, `dependencies`, `exceptionLogging` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._