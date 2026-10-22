// ===== CONFIGURACIÓN =====
const SHEET_ID_PRUEBA = '1bxyJSRDdmd4vzyBD17avAAkA4ZfGNn6WIjYAIUHWhe8'; // Sheet del 21 oct
const SEPARADOR = '---';
const ETIQUETAS = ['Bloque', 'Título', 'Autor', 'Fecha', 'Tipo', 'Resumen', 'Link'];
const MAX_POR_BLOQUE = 8;

// ===== LECTURA =====
function leerContenido(sheetId) {
  const hoja = SpreadsheetApp.openById(sheetId).getSheets()[0];
  const datos = hoja.getDataRange().getValues();
  return datos
    .slice(1)
    .map(function (fila) { return String(fila[1] || '').trim(); })
    .filter(function (txt) { return txt.length > 0; })
    .join('\n' + SEPARADOR + '\n');
}

// ===== PARSEO =====
function extraerCampo(bloque, etiqueta) {
  const otras = ETIQUETAS.filter(function (e) { return e !== etiqueta; });
  const lookahead = otras.map(function (e) { return e + '\\.?:'; }).join('|');
  const patron = new RegExp(etiqueta + '\\.?:\\s*(.+?)\\s*(?:-?\\s*(?:' + lookahead + ')|$)', 'si');
  const m = bloque.match(patron);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function parsearFecha(cruda) {
  const m = String(cruda).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return { texto: cruda, orden: 0 };
  const dd = ('0' + m[3]).slice(-2);
  const mm = ('0' + m[2]).slice(-2);
  return { texto: dd + '-' + mm + '-' + m[1], orden: Number(m[1] + mm + dd) };
}

function parsearNotas(texto) {
  const pedazos = texto.replace(/\r\n/g, '\n').split(SEPARADOR)
    .map(function (b) { return b.trim(); })
    .filter(function (b) { return b.length > 0; });

  const resultado = { marca: [], afores: [], competencia: [], sinBloque: [], duplicadas: 0 };
  const vistos = {};

  pedazos.forEach(function (pedazo) {
    // Si se repite el link o el título, la saltamos (se queda la primera)
    const link = extraerCampo(pedazo, 'Link').toLowerCase();
    const titulo = extraerCampo(pedazo, 'Título').toLowerCase();
    if ((link && vistos['L:' + link]) || (titulo && vistos['T:' + titulo])) {
      resultado.duplicadas++;
      return;
    }
    if (link) vistos['L:' + link] = true;
    if (titulo) vistos['T:' + titulo] = true;

    const bloque = extraerCampo(pedazo, 'Bloque').toLowerCase();
    const fecha = parsearFecha(extraerCampo(pedazo, 'Fecha'));
    const nota = {
      titulo: extraerCampo(pedazo, 'Título'),
      autor: extraerCampo(pedazo, 'Autor'),
      fecha: fecha.texto,
      orden: fecha.orden,
      tipo: extraerCampo(pedazo, 'Tipo'),
      resumen: extraerCampo(pedazo, 'Resumen'),
      link: extraerCampo(pedazo, 'Link')
    };

    if (bloque.indexOf('marca') !== -1) resultado.marca.push(nota);
    else if (bloque.indexOf('afores') !== -1) resultado.afores.push(nota);
    else if (bloque.indexOf('competencia') !== -1) resultado.competencia.push(nota);
    else resultado.sinBloque.push(nota);
  });

  ['marca', 'afores', 'competencia'].forEach(function (k) {
    resultado[k] = resultado[k]
      .sort(function (a, b) { return b.orden - a.orden; })
      .slice(0, MAX_POR_BLOQUE);
  });

  return resultado;
}

// ===== PRUEBA =====
function probarParseo() {
  const texto = leerContenido(SHEET_ID_PRUEBA);
  const r = parsearNotas(texto);

  Logger.log('Marca: ' + r.marca.length + ' | Afores: ' + r.afores.length +
             ' | Competencia: ' + r.competencia.length + ' | Sin bloque: ' + r.sinBloque.length +
             ' | Duplicadas: ' + r.duplicadas);

  ['marca', 'afores', 'competencia', 'sinBloque'].forEach(function (k) {
    r[k].forEach(function (n, i) {
      const faltan = ['titulo', 'fecha', 'tipo', 'resumen', 'link']
        .filter(function (c) { return !n[c]; });
      Logger.log('[' + k + ' ' + (i + 1) + '] ' + n.fecha + ' | ' + n.titulo +
                 (faltan.length ? '  ⚠️ falta: ' + faltan.join(', ') : ''));
    });
  });
}

// ===== HTML =====
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ZONA = 'America/Mexico_City';

function escaparHtml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Apps Script no tiene URL(), así que sacamos el dominio con una expresión regular
function dominioDe(url) {
  const m = String(url).match(/^https?:\/\/([^\/?#]+)/i);
  return m ? m[1].replace(/^www\./i, '') : url;
}

function generarEntradaHtml(nota, bloqueSlug, indice) {
  const esSocial = (nota.tipo || '').toLowerCase().indexOf('social') !== -1;
  const badgeClass = esSocial ? 'badge-nota badge-social' : 'badge-nota badge-medio badge-' + bloqueSlug;
  return '<div class="entrada" id="' + bloqueSlug + '-' + indice + '">' +
    '<div class="bar bar-' + bloqueSlug + '"></div><div class="body">' +
    '<div class="top-row"><span class="titulo-nota">' + escaparHtml(nota.titulo) + '</span>' +
    '<span class="' + badgeClass + '">' + escaparHtml(nota.tipo) + '</span>' +
    '<span class="fecha-nota">' + escaparHtml(nota.fecha) + '</span></div>' +
    '<div class="resumen-nota">' + escaparHtml(nota.resumen) + '</div>' +
    '<div class="fuente-row"><span class="fuente-nota">' + escaparHtml(nota.autor) + '</span>' +
    '<span class="fuente-link"><a href="' + escaparHtml(encodeURI(nota.link)) + '">Ver en ' +
    escaparHtml(dominioDe(nota.link)) + ' →</a></span></div></div></div>';
}

function fechaEnEspanol(fecha) {
  const d = Number(Utilities.formatDate(fecha, ZONA, 'd'));
  const m = Number(Utilities.formatDate(fecha, ZONA, 'M'));
  const a = Utilities.formatDate(fecha, ZONA, 'yyyy');
  return d + ' de ' + MESES[m - 1] + ' de ' + a;
}

function generarHtml(r, fecha) {
  const bloque = function (k) {
    return r[k].map(function (n, i) { return generarEntradaHtml(n, k, i + 1); }).join('');
  };
  return HtmlService.createHtmlOutputFromFile('plantilla').getContent()
    .replace('{{FECHA}}', fechaEnEspanol(fecha))
    .replace('{{N_MARCA}}', r.marca.length)
    .replace('{{N_AFORES}}', r.afores.length)
    .replace('{{N_COMPETENCIA}}', r.competencia.length)
    .replace('{{BLOQUE_MARCA}}', bloque('marca'))
    .replace('{{BLOQUE_AFORES}}', bloque('afores'))
    .replace('{{BLOQUE_COMPETENCIA}}', bloque('competencia'));
}

// ===== PRUEBA HTML =====
function probarHtml() {
  const hoy = new Date();
  const r = parsearNotas(leerContenido(SHEET_ID_PRUEBA));
  const html = generarHtml(r, hoy);

  const nombre = 'sintesis_' + fechaEnEspanol(hoy).replace(/ /g, '_') + '.html';
  const archivo = DriveApp.createFile(nombre, html, MimeType.HTML);

  Logger.log('Archivo creado: ' + archivo.getName());
  Logger.log('Link: ' + archivo.getUrl());
}

// ===== TELEGRAM =====
function obtenerConfig() {
  const p = PropertiesService.getScriptProperties();
  return {
    token: p.getProperty('TELEGRAM_TOKEN'),
    chatId: p.getProperty('TELEGRAM_CHAT_ID')
  };
}

// Manda el HTML como archivo adjunto, con el link de Drive en el texto
function enviarTelegram(nombre, html, linkDrive, fecha) {
  const cfg = obtenerConfig();
  const archivo = Utilities.newBlob(html, 'text/html', nombre);
  const texto = 'Síntesis informativa - ' + fechaEnEspanol(fecha) + '\n' + linkDrive;

  const resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/sendDocument', {
    method: 'post',
    payload: { chat_id: cfg.chatId, caption: texto, document: archivo },
    muteHttpExceptions: true
  });

  const data = JSON.parse(resp.getContentText());
  if (!data.ok) throw new Error('Telegram respondió con error: ' + resp.getContentText());
  return data;
}

// ===== PRUEBA ENVÍO =====
function probarEnvio() {
  const hoy = new Date();
  const r = parsearNotas(leerContenido(SHEET_ID_PRUEBA));
  const html = generarHtml(r, hoy);
  const nombre = 'sintesis_' + fechaEnEspanol(hoy).replace(/ /g, '_') + '.html';

  // Guarda copia en Drive y la comparte con link (como hoy en Make)
  const archivo = DriveApp.createFile(nombre, html, MimeType.HTML);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const linkDescarga = 'https://drive.google.com/uc?export=download&id=' + archivo.getId();

  enviarTelegram(nombre, html, linkDescarga, hoy);
  Logger.log('Enviado. Copia en Drive: ' + archivo.getUrl());
}

// ===== PDF =====
// Estilos extra solo para el PDF: colores fijos en vez de variables y sin degradados
const CSS_PDF = `
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .topbar { background: #1E463C !important; }
  .thin-gold { background: #B08D42 !important; }
  .chip-marca { background: #EDF3F1 !important; }
  .chip-afores { background: #F8F3E8 !important; }
  .chip-competencia { background: #FBEEEE !important; }
  .sec-marca .sq, .bar-marca, .badge-medio.badge-marca { background: #2E5E52 !important; }
  .sec-afores .sq, .bar-afores, .badge-medio.badge-afores { background: #B08D42 !important; }
  .sec-competencia .sq, .bar-competencia, .badge-medio.badge-competencia { background: #C4373C !important; }
  .badge-social { background: #F1EFE8 !important; }
`;

function generarPdf(html, nombre) {
  const htmlPdf = html.replace('</style>', CSS_PDF + '</style>');
  return Utilities.newBlob(htmlPdf, 'text/html', 'temp.html')
    .getAs('application/pdf')
    .setName(nombre);
}

// ===== PRUEBA PDF =====
function probarPdf() {
  const hoy = new Date();
  const r = parsearNotas(leerContenido(SHEET_ID_PRUEBA));
  const html = generarHtml(r, hoy);
  const nombre = 'sintesis_' + fechaEnEspanol(hoy).replace(/ /g, '_') + '.pdf';

  const archivo = DriveApp.createFile(generarPdf(html, nombre));
  Logger.log('PDF creado: ' + archivo.getUrl());
}

// ===== ENVÍO DE DOCUMENTOS =====
function enviarDocumento(blob, texto) {
  const cfg = obtenerConfig();
  const payload = { chat_id: cfg.chatId, document: blob };
  if (texto) payload.caption = texto;

  const resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/sendDocument', {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true
  });

  const data = JSON.parse(resp.getContentText());
  if (!data.ok) throw new Error('Telegram respondió con error: ' + resp.getContentText());
  return data;
}

// ===== PRUEBA ENVÍO COMPLETO (PDF + HTML) =====
function probarEnvioCompleto() {
  const hoy = new Date();
  const r = parsearNotas(leerContenido(SHEET_ID_PRUEBA));
  const html = generarHtml(r, hoy);
  const base = 'sintesis_' + fechaEnEspanol(hoy).replace(/ /g, '_');

  // PDF: se guarda en Drive y se comparte con link
  const pdfBlob = generarPdf(html, base + '.pdf');
  const pdfDrive = DriveApp.createFile(pdfBlob);
  pdfDrive.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // HTML: también se guarda en Drive como respaldo
  const htmlBlob = Utilities.newBlob(html, 'text/html', base + '.html');
  DriveApp.createFile(htmlBlob);

  const texto = 'Síntesis informativa - ' + fechaEnEspanol(hoy) + '\n' + pdfDrive.getUrl();

  enviarDocumento(pdfBlob, texto);   // 1) PDF con texto y link
  enviarDocumento(htmlBlob, null);   // 2) HTML solo

  Logger.log('Enviado PDF + HTML. PDF en Drive: ' + pdfDrive.getUrl());
}
