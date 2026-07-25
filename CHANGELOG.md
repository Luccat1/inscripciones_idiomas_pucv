# Changelog — Panorama de Inscripciones (IDIOMAS PUCV)

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).
El versionado sigue [Semantic Versioning](https://semver.org/lang/es/).

## [2.0.0] - 2026-07-25

### Añadido

- **Harness de tests Node.js** — Se agrega `package.json` raíz sin dependencias en tiempo de ejecución (`npm test` corre `node --test`), habilitando pruebas fuera del entorno Apps Script.
- **Shim `module.exports` en `Config.gs`** — Bloque de exportación guardado con `typeof module !== 'undefined'` al final del archivo, sin tocar las líneas existentes. Permite `require('./src/Config.gs').CONFIG` desde Node.
- **Shim `module.exports` en `Core.gs`** — Exporta las 5 funciones objetivo (`mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre`, `construirBuckets`) más sus 5 helpers internos, también guardado para ser no-op bajo Apps Script V8.
- **Suite de tests de caracterización (`test/Core.test.js`)** — 17 casos organizados en 5 `describe()` que cubren:
  - `mapearColumnas`: cabecera faltante (retorna `-1` / `[]`), sanity check de cabecera real.
  - `parsearHorarios`: match case-insensitive, celda vacía, múltiples horarios, catálogo `_default`.
  - `determinarNivel`: nivel con certificado exacto, principiante absoluto, ha tomado clases, vacío, fallthrough sin match.
  - `normalizarNombre`: preservación de partículas en minúscula, colapso de espacios, cadena vacía.
  - `construirBuckets`: conteo/Set de emails/modalidades en bucket compartido, entrada vacía → `{}`.
- **Sección "Tests" en `README.md`** — Documenta cómo correr la suite con `npm test`.

### Cambiado

- `Config.gs` y `Core.gs` se vuelven **importables desde Node** sin modificar su comportamiento en Apps Script (adición puramente aditiva: no se alteró ninguna línea existente).

---

## [1.1.0] - 2026-07-23

### Corregido

Al comparar el sistema contra 10 respuestas reales del formulario, se detectó que el panorama descartaba casi todas las inscripciones. Correcciones:

- **Catálogo de horarios desactualizado**: horas incorrectas para Alemán (`20:00` → `19:30` real), faltaba por completo la entrada de Italiano, e Inglés dependía del catálogo `_default` con mayúsculas distintas a las opciones reales del Form. El match ahora es case-insensitive (`normalizarTexto()` en `Core.gs`).
- **Ramas condicionales del Form no se leían bien**: el Form repite "¿Cuál horario prefieres?" y "¿Qué modalidad te acomoda más?" en una sección distinta por idioma (columnas duplicadas en la hoja de respuestas). `mapearColumnas()` solo leía un índice fijo, por lo que para cualquier idioma que no cayera en ese bloque la celda leída quedaba vacía. Ahora detecta todas las columnas que calzan con el texto exacto de la pregunta y toma la primera celda no vacía por fila.
- **Apellido perdido**: el Form separa "Nombres" y "Apellidos" en columnas distintas; el código buscaba una columna "NOMBRE COMPLETO" inexistente y solo capturaba el nombre de pila.

### Añadido

- **Resolución de nivel sin certificado**: el Form solo pide el nivel exacto si la persona declara conocerlo con certificado/curso oficial. Nueva `determinarNivel()` en `Core.gs` resuelve el resto: "Soy principiante absoluto" → `CONFIG.nivelPrincipiante` (A1.1); "No, pero he tomado clases" → bucket `CONFIG.nivelPorEvaluar` ("Por evaluar (prueba de nivel)"), en vez de descartar la fila como antes.
- **Columna "Modalidades (informativo)"** en la hoja de panorama: muestra la distribución de preferencia presencial/virtual/híbrido por bucket, sin afectar el semáforo ni el umbral de apertura.

### Cambiado

- **Correo canónico**: `CONFIG.formCols.email` ahora apunta a "Dirección de correo electrónico" (la cuenta Google que envió el Form) en vez del campo de correo tipeado a mano, para evitar duplicados por typos.

## [1.0.0] - 2026-07-23

### Añadido

- **`Config.gs`** — Configuración centralizada: umbral mínimo de apertura, catálogo de idiomas/niveles/horarios, mapeo de columnas del formulario, colores institucionales.
- **`Core.gs`** — Lectura y normalización de respuestas (`leerRespuestas()`), detección de columnas (`mapearColumnas()`), parsing de horarios tipo checkbox (`parsearHorarios()`), agregación en buckets (`construirBuckets()`) y conteo de personas únicas por nivel.
- **`Panorama.gs`** — Hoja "Panorama de Cursos" con semáforo automático (🟢 Abre / 🟡 Evaluar / ⚪ Sin interés) reemplazando la revisión manual con tablas dinámicas, más sidebar de resumen rápido.
- **`Alertas.gs`** — Trigger `onFormSubmit` con aviso automático por correo cuando un horario cruza el umbral mínimo, con control de duplicados vía hoja oculta `_Estado_Avisos`.
- **`Main.gs`** — Menú `🎓 Inscripciones` con recálculo de panorama, instalación/reinstalación de automatización, reinicio semestral, aviso de prueba y detección de columnas del formulario.
- **`AGENTS.md`** — Guía de colaboración para agentes IA (modelo de datos, patrones de código, tareas comunes, gotchas).
