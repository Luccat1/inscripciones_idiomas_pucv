/**
 * =============================================================================
 * Main.gs - Menú y orquestación
 * =============================================================================
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎓 Inscripciones')
    .addItem('🔄 Recalcular Panorama', 'recalcularPanoramaConAlerta')
    .addItem('📊 Ver Panorama', 'showPanoramaSidebar')
    .addSeparator()
    .addItem('🔔 Instalar/Reinstalar automatización', 'instalarAutomatizacion')
    .addItem('🆕 Iniciar nuevo semestre', 'iniciarNuevoSemestre')
    .addSeparator()
    .addItem('🧪 Enviar aviso de prueba', 'probarAviso')
    .addItem('🔍 Detectar columnas del formulario', 'detectarColumnas')
    .addItem('❓ Ayuda', 'showHelp')
    .addToUi();
}

/**
 * Recalcula el panorama desde el menú y muestra un resumen al usuario.
 */
function recalcularPanoramaConAlerta() {
  const ui = SpreadsheetApp.getUi();
  try {
    const buckets = recalcularPanorama();
    const total = Object.keys(buckets).length;
    const listos = Object.values(buckets).filter(b => b.count >= CONFIG.umbralMinimo).length;

    ui.alert(
      '✅ Panorama actualizado',
      `Bloques (idioma+nivel+horario) con al menos 1 interesado: ${total}\n` +
      `🟢 Listos para abrir (≥ ${CONFIG.umbralMinimo}): ${listos}\n\n` +
      'Revisa la hoja "Panorama de Cursos" para el detalle completo.',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Instala (o reinstala) el trigger onFormSubmit. Necesario cada vez que se
 * duplica la hoja/formulario para un semestre nuevo, porque los triggers
 * instalables NO se copian junto con la hoja.
 */
function instalarAutomatizacion() {
  const ui = SpreadsheetApp.getUi();

  // Eliminar triggers onFormSubmit existentes para no duplicar
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  ui.alert(
    '🔔 Automatización instalada',
    'A partir de ahora, cada respuesta nueva del formulario recalculará el panorama ' +
    'y avisará por correo cuando un horario cruce el mínimo de ' + CONFIG.umbralMinimo + '.',
    ui.ButtonSet.OK
  );
}

/**
 * Prepara el sistema para un semestre nuevo: limpia el estado de avisos
 * (para que los umbrales se reevalúen desde cero) y reinstala el trigger.
 * Recordar también actualizar CONFIG.semestre en Config.gs antes de correr esto.
 */
function iniciarNuevoSemestre() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '🆕 Iniciar nuevo semestre',
    'Esto limpiará el historial de avisos ya enviados (para que los umbrales se ' +
    'evalúen desde cero) y reinstalará la automatización.\n\n' +
    '⚠️ Antes de continuar, confirma que ya actualizaste CONFIG.semestre en Config.gs.\n\n' +
    `Semestre configurado actualmente: "${CONFIG.semestre}"\n\n¿Continuar?`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  limpiarEstadoAvisos();
  instalarAutomatizacion();
  recalcularPanorama();

  ui.alert('✅ Listo', `Sistema reiniciado para "${CONFIG.semestre}".`, ui.ButtonSet.OK);
}

/**
 * Envía un correo de aviso de prueba con datos ficticios, sin tocar el
 * estado de avisos real.
 */
function probarAviso() {
  const ui = SpreadsheetApp.getUi();
  const emailResponse = ui.prompt(
    '🧪 Aviso de prueba',
    `Ingresa el email de destino:\n\n(Por defecto: ${CONFIG.emailAvisos[0]})`,
    ui.ButtonSet.OK_CANCEL
  );

  if (emailResponse.getSelectedButton() !== ui.Button.OK) return;
  const destino = emailResponse.getResponseText().trim() || CONFIG.emailAvisos[0];

  const bucketPrueba = {
    idioma: 'Inglés',
    nivel: 'A1.1',
    horarioId: 'PRUEBA',
    horarioLabel: 'Lunes y miércoles (17:30 - 19:30) [PRUEBA]',
    count: CONFIG.umbralMinimo
  };

  try {
    MailApp.sendEmail({
      to: destino,
      subject: '[PRUEBA] ' + `🟢 Curso listo para abrir: ${bucketPrueba.idioma} ${bucketPrueba.nivel}`,
      htmlBody: getAvisoHtml(bucketPrueba),
      name: 'Panorama de Inscripciones - IDIOMAS PUCV'
    });
    ui.alert('✅ Enviado', 'Correo de prueba enviado a ' + destino, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ Error', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Ayuda a mapear CONFIG.formCols mostrando los encabezados reales de la
 * hoja de respuestas junto al mapeo detectado automáticamente.
 */
function detectarColumnas() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.hojas.respuestas);

  if (!sheet) {
    ui.alert('❌ Error', `No se encontró la hoja "${CONFIG.hojas.respuestas}". Ajusta CONFIG.hojas.respuestas en Config.gs.`, ui.ButtonSet.OK);
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => h.toString().toUpperCase().trim());
  const cols = mapearColumnas(headers);

  const lineas = Object.entries(cols).map(([campo, idx]) => {
    const encontrado = idx !== -1 ? `"${headers[idx]}" (columna ${idx + 1})` : 'NO ENCONTRADA';
    return `• ${campo}: ${encontrado}`;
  });

  ui.alert(
    '🔍 Mapeo de columnas detectado',
    lineas.join('\n') +
    '\n\nSi algo dice "NO ENCONTRADA" o está mal mapeado, ajusta CONFIG.formCols en Config.gs.',
    ui.ButtonSet.OK
  );
}

function showHelp() {
  const ui = SpreadsheetApp.getUi();
  const helpText = `
🎓 PANORAMA DE INSCRIPCIONES - IDIOMAS PUCV

📌 FLUJO:
1. Cada respuesta del formulario dispara onFormSubmit automáticamente
   (una vez instalada la automatización).
2. Se recalcula la hoja "Panorama de Cursos": Idioma → Nivel → Horario,
   con conteo de interesados y semáforo (🟢 abre / 🟡 evaluar / ⚪ sin interés).
3. Si un horario cruza el mínimo de ${CONFIG.umbralMinimo}, se envía UN aviso
   por correo al equipo (no se repite en respuestas posteriores).

⚠️ CADA SEMESTRE NUEVO:
1. Actualiza CONFIG.semestre en Config.gs.
2. Verifica CONFIG.hojas.respuestas y CONFIG.formCols si cambió el formulario.
3. Ejecuta el menú "🆕 Iniciar nuevo semestre".
   (Los triggers no se copian solos al duplicar la hoja/formulario.)

📊 PERSONAS ÚNICAS:
Una misma persona puede marcar varios horarios posibles, así que el conteo
por bloque puede sobreestimar. La columna "Personas únicas (nivel)" del
panorama sirve de contraste para la evaluación de balance.

📧 Soporte: ${CONFIG.emailAvisos[0]}
  `;
  ui.alert('❓ Ayuda', helpText, ui.ButtonSet.OK);
}
