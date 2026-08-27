/**
 * =============================================================================
 * Panorama.gs - Hoja "Panorama de Cursos" (reemplaza las tablas dinámicas)
 * =============================================================================
 */

const HEADERS_PANORAMA = [
  'IDIOMA', 'NIVEL', 'HORARIO', 'INTERESADOS (bloque)',
  'PERSONAS ÚNICAS (nivel)', 'MODALIDADES (informativo)', 'ESTADO', 'ACTUALIZADO'
];

// Columna 1-based de ESTADO dentro de HEADERS_PANORAMA, usada para colorear el semáforo.
const COL_ESTADO = HEADERS_PANORAMA.indexOf('ESTADO') + 1;

/**
 * Recalcula el panorama completo a partir de la hoja de respuestas y lo
 * escribe en la hoja "Panorama de Cursos". Devuelve los buckets calculados
 * para que Alertas.gs pueda detectar cruces de umbral sin releer todo.
 */
function recalcularPanorama() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRespuestas = ss.getSheetByName(CONFIG.hojas.respuestas);

  if (!sheetRespuestas) {
    throw new Error('No se encontró la hoja de respuestas "' + CONFIG.hojas.respuestas + '". Ajusta CONFIG.hojas.respuestas en Config.gs.');
  }

  const resultado = leerRespuestas(sheetRespuestas);
  const inscripciones = resultado.inscripciones;
  const buckets = construirBuckets(inscripciones);
  const personasUnicas = contarPersonasUnicasPorNivel(inscripciones);

  const filas = Object.values(buckets)
    .sort((a, b) =>
      a.idioma.localeCompare(b.idioma) ||
      a.nivel.localeCompare(b.nivel) ||
      a.horarioLabel.localeCompare(b.horarioLabel)
    );

  escribirHojaPanorama(ss, filas, personasUnicas);

  return buckets;
}

function escribirHojaPanorama(ss, filas, personasUnicas) {
  let sheet = ss.getSheetByName(CONFIG.hojas.panorama);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.hojas.panorama);
  } else {
    sheet.clear();
  }

  sheet.getRange(1, 1, 1, HEADERS_PANORAMA.length).setValues([HEADERS_PANORAMA]);
  const headerRange = sheet.getRange(1, 1, 1, HEADERS_PANORAMA.length);
  headerRange.setBackground(CONFIG.colores.primario);
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);

  if (filas.length === 0) {
    sheet.getRange(2, 1).setValue('Sin inscripciones registradas todavía.');
    return;
  }

  const ahora = Utilities.formatDate(new Date(), 'America/Santiago', 'dd/MM/yyyy HH:mm');

  const valores = filas.map(f => {
    const claveNivel = [f.idioma, f.nivel].join('||');
    const unicas = personasUnicas[claveNivel] || 0;
    return [
      f.idioma,
      f.nivel,
      f.horarioLabel,
      f.count,
      unicas,
      formatearModalidades(f.modalidades),
      estadoParaConteo(f.count),
      ahora
    ];
  });

  sheet.getRange(2, 1, valores.length, HEADERS_PANORAMA.length).setValues(valores);

  // Colorear la columna ESTADO según semáforo (la modalidad es solo informativa)
  for (let i = 0; i < filas.length; i++) {
    const fila = i + 2;
    const color = colorParaConteo(filas[i].count);
    sheet.getRange(fila, COL_ESTADO).setBackground(color);
  }

  sheet.autoResizeColumns(1, HEADERS_PANORAMA.length);
}

/**
 * Formatea la distribución de modalidades marcadas (presencial/virtual/
 * híbrido) como texto informativo. No influye en el semáforo ni el umbral.
 */
function formatearModalidades(modalidades) {
  const entradas = Object.entries(modalidades || {});
  if (entradas.length === 0) return '—';
  return entradas.map(([m, c]) => `${m}: ${c}`).join(', ');
}

function estadoParaConteo(count) {
  if (count >= CONFIG.umbralMinimo) return '🟢 ABRE';
  if (count > 0) return '🟡 BALANCE (evaluar)';
  return '⚪ SIN INTERÉS';
}

function colorParaConteo(count) {
  if (count >= CONFIG.umbralMinimo) return CONFIG.colores.verdeAbre;
  if (count > 0) return CONFIG.colores.amarilloBalance;
  return CONFIG.colores.grisSinInteres;
}

/**
 * Muestra un resumen rápido del panorama en un sidebar (estilo dashboard).
 */
function showPanoramaSidebar() {
  const buckets = recalcularPanorama();
  const html = HtmlService.createHtmlOutput(getPanoramaHtml(buckets))
    .setTitle('📊 Panorama de Cursos')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getPanoramaHtml(buckets) {
  const filas = Object.values(buckets).sort((a, b) => b.count - a.count);

  const filasHtml = filas.map(f => {
    const color = colorParaConteo(f.count);
    return `
      <div class="bucket-card" style="background-color:${color};">
        <div class="bucket-title">${f.idioma} · ${f.nivel}</div>
        <div class="bucket-horario">${f.horarioLabel}</div>
        <div class="bucket-count">${f.count} interesado(s)</div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 15px; background-color: #f5f5f5; }
    .header { background: linear-gradient(135deg, ${CONFIG.colores.primario} 0%, ${CONFIG.colores.secundario} 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center; }
    .header h2 { margin: 0 0 5px; font-size: 18px; }
    .header p { margin: 0; opacity: 0.8; font-size: 12px; }
    .bucket-card { padding: 12px; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .bucket-title { font-weight: bold; color: #333; font-size: 13px; }
    .bucket-horario { font-size: 12px; color: #555; margin-top: 2px; }
    .bucket-count { font-size: 12px; font-weight: bold; color: #333; margin-top: 6px; }
    .refresh-btn { display: block; width: 100%; padding: 12px; background: linear-gradient(135deg, ${CONFIG.colores.primario} 0%, ${CONFIG.colores.secundario} 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>📊 Panorama de Cursos</h2>
    <p>IDIOMAS PUCV - ${CONFIG.semestre}</p>
  </div>
  ${filasHtml || '<p style="color:#666;font-size:12px;">Sin inscripciones todavía.</p>'}
  <button class="refresh-btn" onclick="google.script.host.close(); google.script.run.showPanoramaSidebar();">🔄 Actualizar</button>
</body>
</html>
  `;
}
