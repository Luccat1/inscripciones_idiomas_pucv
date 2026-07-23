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
└── AGENTS.md
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
horariosPorIdioma: { ... },    // catálogo canónico — debe calzar EXACTO con las opciones del Form
formCols: { ... }              // mapeo de encabezados del formulario
```

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

## 📞 Contacto

- 📧 idiomas@pucv.cl

## 📄 Licencia

MIT - Pontificia Universidad Católica de Valparaíso
