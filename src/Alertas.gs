/**
 * =============================================================================
 * Alertas.gs - Aviso automático cuando un horario cruza el umbral mínimo
 * =============================================================================
 */

const HEADERS_ESTADO_AVISOS = ['SEMESTRE', 'CLAVE_BUCKET', 'IDIOMA', 'NIVEL', 'HORARIO', 'FECHA_AVISO'];

/**
 * Trigger instalable: se ejecuta en cada respuesta nueva del formulario.
 * Recalcula el panorama completo y avisa por correo únicamente los buckets
 * que ACABAN de cruzar el umbral mínimo (evita reenviar en cada submission).
 */
function onFormSubmit(e) {
  try {
    const buckets = recalcularPanorama();
    const yaAvisados = leerEstadoAvisos();

    Object.values(buckets).forEach(bucket => {
      if (bucket.count < CONFIG.umbralMinimo) return;

      const clave = claveBucket(bucket);
      if (yaAvisados.has(clave)) return;

      enviarAvisoUmbral(bucket);
      marcarComoAvisado(bucket);
    });
  } catch (error) {
    Logger.log('Error en onFormSubmit: ' + error.message);
    // No relanzar: un error aquí no debe bloquear el registro de la respuesta.
  }
}

function claveBucket(bucket) {
  return [CONFIG.semestre, bucket.idioma, bucket.nivel, bucket.horarioId].join('||');
}

/**
 * Lee la hoja de control _Estado_Avisos y devuelve el set de claves
 * ya avisadas para el semestre vigente.
 */
function leerEstadoAvisos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = obtenerOCrearHojaEstadoAvisos(ss);
  const data = sheet.getDataRange().getValues();
  const claves = new Set();

  for (let i = 1; i < data.length; i++) {
    const [semestre, claveBucket] = data[i];
    if (semestre === CONFIG.semestre && claveBucket) {
      claves.add(claveBucket.toString());
    }
  }

  return claves;
}

function marcarComoAvisado(bucket) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = obtenerOCrearHojaEstadoAvisos(ss);
  const ahora = Utilities.formatDate(new Date(), 'America/Santiago', 'dd/MM/yyyy HH:mm');

  sheet.appendRow([
    CONFIG.semestre,
    claveBucket(bucket),
    bucket.idioma,
    bucket.nivel,
    bucket.horarioLabel,
    ahora
  ]);
}

function obtenerOCrearHojaEstadoAvisos(ss) {
  let sheet = ss.getSheetByName(CONFIG.hojas.estadoAvisos);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.hojas.estadoAvisos);
    sheet.getRange(1, 1, 1, HEADERS_ESTADO_AVISOS.length).setValues([HEADERS_ESTADO_AVISOS]);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS_ESTADO_AVISOS.length);
    headerRange.setBackground('#6c757d');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    sheet.hideSheet();
  }
  return sheet;
}

/**
 * Limpia el estado de avisos. Usar al iniciar un nuevo semestre para que
 * los umbrales se vuelvan a evaluar desde cero.
 */
function limpiarEstadoAvisos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.hojas.estadoAvisos);
  if (sheet) {
    ss.deleteSheet(sheet);
  }
  obtenerOCrearHojaEstadoAvisos(ss);
}

/**
 * Envía el correo de aviso al equipo cuando un bucket cruza el umbral.
 */
function enviarAvisoUmbral(bucket) {
  if (MailApp.getRemainingDailyQuota() <= 0) {
    Logger.log('Cuota de correo agotada, no se pudo avisar sobre ' + claveBucket(bucket));
    return;
  }

  const asunto = `🟢 Curso listo para abrir: ${bucket.idioma} ${bucket.nivel} - ${bucket.horarioLabel}`;
  const htmlBody = getAvisoHtml(bucket);

  CONFIG.emailAvisos.forEach(destinatario => {
    MailApp.sendEmail({
      to: destinatario,
      subject: asunto,
      htmlBody: htmlBody,
      name: 'Panorama de Inscripciones - IDIOMAS PUCV'
    });
  });
}

function getAvisoHtml(bucket) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', sans-serif; background-color: ${CONFIG.colores.fondo}; padding: 20px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="500" style="background: #ffffff; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="background: ${CONFIG.colores.primario}; padding: 20px; text-align: center;">
            <h2 style="color: #fff; margin: 0;">🎓 Curso listo para abrir</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 25px;">
            <p style="font-size: 16px; color: ${CONFIG.colores.texto};">
              El siguiente horario alcanzó el mínimo de <strong>${CONFIG.umbralMinimo}</strong> interesados (${CONFIG.semestre}):
            </p>
            <table width="100%" cellpadding="8" style="background: #f8f9fa; border-radius: 6px; margin: 15px 0;">
              <tr><td><strong>Idioma:</strong></td><td>${bucket.idioma}</td></tr>
              <tr><td><strong>Nivel:</strong></td><td>${bucket.nivel}</td></tr>
              <tr><td><strong>Horario:</strong></td><td>${bucket.horarioLabel}</td></tr>
              <tr><td><strong>Interesados:</strong></td><td>${bucket.count}</td></tr>
            </table>
            <p style="font-size: 13px; color: #666;">
              Revisa la hoja "Panorama de Cursos" para ver el panorama completo antes de confirmar la apertura
              (algunos interesados pueden aparecer en más de un horario).
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;
}
