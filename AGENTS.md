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

- **Inscripción** (una fila válida de respuestas): `{ rowIndex, nombre, email, idioma, nivel, horarios: [horarioId] }`. Se descarta si falta email válido, idioma, nivel u horarios reconocidos.
- **Bucket** (unidad de agregación, clave `idioma||nivel||horarioId`): `{ idioma, nivel, horarioId, horarioLabel, count, emails: Set }`. `count` puede sobreestimar si una persona marcó varios horarios — por eso existe el conteo paralelo de **personas únicas por (idioma, nivel)**.
- El catálogo de horarios en `CONFIG.horariosPorIdioma` debe tener el `label` **idéntico carácter a carácter** a las opciones del checkbox del Form — si no calza, `parsearHorarios()` descarta la opción silenciosamente y solo queda registro en `Logger.log()`.

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
- `horarioLabel` debe calzar EXACTO (espacios, tildes, mayúsculas) con la opción real del checkbox del Form; un desfase silencioso deja fuera ese horario del conteo.
- `_Estado_Avisos` está oculta (`sheet.hideSheet()`) — no es basura, es el registro de qué buckets ya avisaron para el semestre vigente.
- `count` por bucket ≠ personas reales interesadas en ese (idioma, nivel): usar la columna "Personas únicas (nivel)" del panorama como contraste.
- Column/row indices de Sheets API son 1-based; `rowIndex` en las inscripciones ya viene ajustado (`i + 1`).
