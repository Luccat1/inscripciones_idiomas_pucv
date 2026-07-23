# AGENTS.md — AI Collaboration Guidelines

## Project Context

**Google Apps Script** container-bound project. Procesa las respuestas del formulario de matrícula inicial (interés en cursos) y mantiene actualizada la hoja "Panorama de Cursos", reemplazando la revisión manual con tablas dinámicas por un semáforo automático (🟢 Abre / 🟡 Evaluar / ⚪ Sin interés) y un aviso por correo cuando un horario cruza el mínimo de interesados.

**Versión actual**: v1.0

## Institutional Information

| Field | Value |
|-------|-------|
| **Center** | IDIOMAS PUCV (Pontificia Universidad Católica de Valparaíso) |
| **Email** | <idiomas@pucv.cl> |
| **Timezone** | America/Santiago |

## Key Information for AI Agents

### Technology Stack

- Google Apps Script (V8 runtime), sin build system — los `.gs` se copian directo al editor
- Google Sheets como fuente de datos (respuestas de Google Form)
- `MailApp` para el correo de aviso
- Trigger instalable `onFormSubmit` (no se copia al duplicar la hoja/formulario — hay que reinstalarlo cada semestre)

### File Purposes

| File | Purpose |
|------|---------|
| `Config.gs` | Única fuente de configuración: umbral, catálogo de idiomas/niveles/horarios (`horariosPorIdioma`), nombres de hojas, mapeo de columnas del formulario (`formCols`), colores |
| `Core.gs` | `leerRespuestas()`, `mapearColumnas()`, `parsearHorarios()`, `construirBuckets()`, `contarPersonasUnicasPorNivel()` y normalizadores (email/idioma/nivel/nombre) |
| `Panorama.gs` | `recalcularPanorama()` (recorre respuestas → buckets → escribe hoja) + `showPanoramaSidebar()` |
| `Alertas.gs` | `onFormSubmit()` (handler del trigger), control de duplicados vía hoja oculta `_Estado_Avisos`, envío del correo HTML |
| `Main.gs` | Menú `onOpen()` y todos los entry points invocados desde él |

### Data Model

- **Inscripción** (una fila válida de respuestas): `{ rowIndex, nombre, email, idioma, nivel, horarios: [horarioId], modalidades: [string] }`. Se descarta si falta email válido, idioma, nivel u horarios reconocidos.
- **Bucket** (unidad de agregación, clave `idioma||nivel||horarioId`): `{ idioma, nivel, horarioId, horarioLabel, count, emails: Set, modalidades: {texto: count} }`. `count` puede sobreestimar si una persona marcó varios horarios — por eso existe el conteo paralelo de **personas únicas por (idioma, nivel)**. `modalidades` es puramente informativo (columna del panorama), no afecta el semáforo.
- El catálogo de horarios en `CONFIG.horariosPorIdioma` se compara case-insensitive y con espacios colapsados (`normalizarTexto()` en `Core.gs`), pero el **contenido** (horas, días, sufijos como "- Único horario disponible") debe seguir calzando con las opciones reales del Form — si no calza, `parsearHorarios()` descarta la opción silenciosamente y solo queda registro en `Logger.log()`.
- **Nivel sin certificado**: el Form solo pide el nivel exacto si la persona declara conocerlo con certificado/curso (pregunta "¿Conoces tu nivel actual...?"). `determinarNivel()` en `Core.gs` resuelve el resto: "Soy principiante absoluto" → `CONFIG.nivelPrincipiante` (A1.1); "No, pero he tomado clases" → `CONFIG.nivelPorEvaluar` (bucket aparte, requiere prueba de nivel — **nunca** asumir un nivel formal para este caso).
- **Ramas condicionales por idioma**: el Form repite "¿Cuál horario prefieres?" / "¿Qué modalidad te acomoda más?" en una sección por idioma (mismo texto de pregunta, columnas duplicadas en la hoja). `mapearColumnas()` devuelve TODOS los índices que calzan ese texto exacto para `horarios`/`modalidad` (arrays, no índice único); `primeraCeldaNoVacia()` toma la que tenga datos en cada fila.
- **Correo canónico**: `formCols.email` apunta a "Dirección de correo electrónico" (la cuenta Google que envió el Form), no al campo de correo tipeado a mano — evita duplicados por typos.

### Code Patterns

1. **Config centralizada**: cualquier valor institucional (umbral, catálogo, colores, hojas) va en `CONFIG` (`Config.gs`), nunca hardcodeado en otro archivo.
2. **No relanzar errores en el trigger**: `onFormSubmit()` atrapa todo con try/catch y solo loguea — un error ahí no debe bloquear el registro de la respuesta del Form.
3. **Idempotencia de avisos**: antes de mandar un correo de umbral, se chequea `_Estado_Avisos` por `claveBucket()` (incluye `CONFIG.semestre`) para no reavisar en cada submission subsiguiente.
4. **Cuota de Gmail**: `enviarAvisoUmbral()` chequea `MailApp.getRemainingDailyQuota()` antes de enviar.
5. **UI feedback**: toda acción de menú da un `ui.alert(...)` de resultado o error — no debe fallar en silencio.

### Common Tasks

**Cambiar el umbral mínimo o el equipo que recibe avisos:**

1. Editar `umbralMinimo` / `emailAvisos` en `Config.gs`.

**El formulario cambió preguntas u opciones de horario:**

1. Menú → 🔍 Detectar columnas del formulario → ajustar `CONFIG.formCols` si algo no calza.
2. Actualizar `CONFIG.horariosPorIdioma` para que los `label` calcen exacto con las opciones del Form.

**Agregar un idioma o nivel nuevo:**

1. Agregarlo a `CONFIG.idiomas` / `CONFIG.niveles`.
2. Agregar su entrada en `CONFIG.horariosPorIdioma` (o dejar que caiga en `_default`).

**Agregar un ítem de menú:**

1. Agregar `addItem(...)` en `onOpen()` (`Main.gs`).
2. Definir la función handler en `Main.gs`.

**Semestre nuevo:**

1. Actualizar `CONFIG.semestre` en `Config.gs`.
2. Menú → 🆕 Iniciar nuevo semestre (limpia `_Estado_Avisos` y reinstala el trigger — ver `iniciarNuevoSemestre()` en `Main.gs`).

### Gotchas

- Los triggers instalables **no** se copian al duplicar la hoja/formulario — sin reinstalar, `onFormSubmit` simplemente no corre y nada avisa.
- El match de horarios es case-insensitive, pero el **contenido** (horas, días) sigue teniendo que calzar con la opción real del Form; un desfase silencioso deja fuera ese horario del conteo. `Francés` no tiene entrada propia en `horariosPorIdioma` (sin datos reales aún) y cae en `_default` — revisar cuando lleguen sus primeras respuestas.
- `_Estado_Avisos` está oculta (`sheet.hideSheet()`) — no es basura, es el registro de qué buckets ya avisaron para el semestre vigente.
- `count` por bucket ≠ personas reales interesadas en ese (idioma, nivel): usar la columna "Personas únicas (nivel)" del panorama como contraste.
- Column/row indices de Sheets API son 1-based; `rowIndex` en las inscripciones ya viene ajustado (`i + 1`).
- No asumir que "¿Cuál horario prefieres?"/"¿Qué modalidad te acomoda más?" son columnas únicas — son arrays de índices (una por rama de idioma). Si se agrega un campo nuevo con el mismo patrón de branching, usar `buscarTodos()` + `primeraCeldaNoVacia()`, no `buscarUno()`.
- `CONFIG.nivelPorEvaluar` no es un nivel real del currículo (no está en `CONFIG.niveles`) — es un bucket administrativo para gente pendiente de prueba de nivel; no debe tratarse como si fuera A1.1 ni ningún nivel formal.
