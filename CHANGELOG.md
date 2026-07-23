# Changelog — Panorama de Inscripciones (IDIOMAS PUCV)

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).
El versionado sigue [Semantic Versioning](https://semver.org/lang/es/).

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
