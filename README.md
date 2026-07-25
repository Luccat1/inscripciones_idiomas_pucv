# 🎓 Panorama de Inscripciones - IDIOMAS PUCV

[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?logo=google&logoColor=white)](https://script.google.com/)
[![Google Sheets](https://img.shields.io/badge/Google%20Sheets-34A853?logo=googlesheets&logoColor=white)](https://sheets.google.com/)

Procesa automáticamente las respuestas del formulario de matrícula inicial (interés en cursos) y mantiene un **panorama siempre actualizado** de qué combinaciones de idioma + nivel + horario cumplen el mínimo para abrir — reemplazando la revisión manual con tablas dinámicas.

## ✨ Características

| Característica | Descripción |
|---|---|
| 🔔 **Aviso automático** | Correo al equipo apenas un horario cruza el mínimo de interesados |
| 📊 **Panorama semáforo** | Hoja "Panorama de Cursos" con estado 🟢 Abre / 🟡 Evaluar / ⚪ Sin interés |
| 👥 **Personas únicas** | Contraste ante el sobreconteo cuando alguien marca varios horarios posibles |
| ♻️ **Reinicio semestral** | Menú dedicado para limpiar estado y reinstalar la automatización cada semestre |

## 📁 Estructura

```
inscripciones_idiomas_pucv/
├── appsscript.json
├── src/
│   ├── Config.gs      # Umbral, catálogo de idiomas/niveles/horarios, mapeo de columnas
│   ├── Core.gs        # Lectura, normalización y agregación de inscripciones
│   ├── Panorama.gs     # Hoja "Panorama de Cursos" + sidebar
│   ├── Alertas.gs      # Detección de cruces de umbral + envío de correo (sin duplicados)
│   └── Main.gs         # Menú, instalación de trigger, setup de nuevo semestre
├── README.md
├── AGENTS.md
└── CHANGELOG.md
```

## 🚀 Instalación

1. Abre el [Google Apps Script](https://script.google.com/) vinculado a la hoja donde caen las respuestas del formulario (o crea uno nuevo: **Extensiones > Apps Script** desde la Sheet).
2. Copia los archivos de `src/` al proyecto (y el contenido de `appsscript.json` en el archivo de manifiesto del editor).
3. Recarga la hoja de cálculo y ejecuta `onOpen()` (o simplemente recarga) para ver el menú **🎓 Inscripciones**.
4. Menú → **🔍 Detectar columnas del formulario** — ajusta `CONFIG.formCols` en `Config.gs` si algo no calza.
5. Menú → **🔔 Instalar/Reinstalar automatización** y autoriza los permisos solicitados.
6. Menú → **🔄 Recalcular Panorama** para la primera corrida con los datos existentes.

## ⚙️ Configuración clave (`Config.gs`)

```javascript
umbralMinimo: 6,               // mínimo de interesados por (idioma, nivel, horario)
emailAvisos: ['idiomas@pucv.cl'],
horariosPorIdioma: { ... },    // catálogo canónico — el match es case-insensitive, pero el texto (horas/días) debe calzar con las opciones del Form
formCols: { ... },             // mapeo de encabezados del formulario (identificador = cuenta Google, no el correo tipeado a mano)
nivelPrincipiante: 'A1.1',                       // "Soy principiante absoluto"
nivelPorEvaluar: 'Por evaluar (prueba de nivel)' // "No, pero he tomado clases" -- sin certificado, requiere evaluación
```

### 🎯 Resolución de nivel

El Form solo pide nivel exacto si la persona dice conocerlo con certificado/curso. Para el resto:

| Respuesta a "¿Conoces tu nivel actual...?" | Nivel asignado |
|---|---|
| Sí, con exactitud y prueba/curso oficial | El nivel declarado tal cual |
| Soy principiante absoluto | `CONFIG.nivelPrincipiante` (A1.1) |
| No, pero he tomado clases | `CONFIG.nivelPorEvaluar` — bucket aparte, no se asume nivel sin evaluar |

### 🎓 Modalidad (presencial / virtual / híbrido)

Es solo informativa: se muestra en el panorama (columna "Modalidades") pero **no** afecta el semáforo ni el umbral de apertura.

### 🔀 Horarios y modalidad por idioma (ramas del Form)

El Form repite las preguntas "¿Cuál horario prefieres?" y "¿Qué modalidad te acomoda más?" en una sección distinta por cada idioma (salto condicional) — llegan como columnas duplicadas en la hoja de respuestas, y solo la sección del idioma elegido queda con datos. `mapearColumnas()` detecta **todas** las columnas con ese texto exacto y toma la primera celda no vacía de cada fila.

## 📅 Cada semestre nuevo

Los triggers instalables **no** se copian al duplicar la hoja/formulario. Antes de abrir inscripciones:

1. Actualiza `CONFIG.semestre` en `Config.gs`.
2. Revisa `CONFIG.hojas.respuestas` y `CONFIG.formCols` si cambió el formulario.
3. Menú → **🆕 Iniciar nuevo semestre** (limpia el historial de avisos y reinstala el trigger).

## 🔧 Menú

- **🔄 Recalcular Panorama**: recorre todas las respuestas y reescribe la hoja de panorama.
- **📊 Ver Panorama**: vista rápida en sidebar.
- **🔔 Instalar/Reinstalar automatización**: crea el trigger `onFormSubmit`.
- **🆕 Iniciar nuevo semestre**: limpia estado de avisos + reinstala trigger + recalcula.
- **🧪 Enviar aviso de prueba**: prueba el formato del correo sin afectar el estado real.
- **🔍 Detectar columnas del formulario**: ayuda a mapear `CONFIG.formCols`.

## 🧪 Tests

Este proyecto cuenta con tests de caracterización (`test/Core.test.js`) para las 5 funciones puras de `Core.gs` que procesan cada inscripción: `mapearColumnas`, `parsearHorarios`, `determinarNivel`, `normalizarNombre` y `construirBuckets` — las mismas funciones responsables de los bugs reales corregidos en v1.1.0. Sirven como red de regresión estándar para cualquier cambio futuro a esas 5 funciones.

```bash
npm test
```

No requiere `npm install` (cero dependencias externas) — solo Node.js `>=20` (ver `engines` en `package.json`), ya que `node:test` es estable desde esa versión.

El bloque `module.exports` agregado al final de `Core.gs` y `Config.gs` es inerte dentro del editor de Google Apps Script (no existe un global `module` ahí), por lo que no afecta el flujo de despliegue por copiar y pegar descrito en "🚀 Instalación".

## 📞 Contacto

- 📧 idiomas@pucv.cl

## 📄 Licencia

MIT - Pontificia Universidad Católica de Valparaíso
