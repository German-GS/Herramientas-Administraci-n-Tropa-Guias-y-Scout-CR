import mapa from './cicloPdfMapa.json' with { type: 'json' };
import { AREAS, edad, ETAPAS } from './etapas.js';

// Formulario oficial «Herramienta Ciclo de Programa» (AGSCR): llenarlo desde el sistema y leerlo ya llenado.
const AREAS_PDF = AREAS.filter((a) => a.key !== 'servicio').map((a) => a.key);
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// El PDF usa fuentes estándar: se quitan emojis y símbolos fuera de su alfabeto
const seguro = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[^\n\r\t\x20-\x7E\xA0-\xFF–—•…€]/g, '');

const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const mesAnio = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(iso || ''); return m ? `${m[2]}/${m[1]}` : ''; };

export function fechaIso(txt, anioPorDefecto) {
  const s = String(txt || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /(\d{1,2})\s*[/\-–.]\s*(\d{1,2})(?:\s*[/\-–.]\s*(\d{2,4}))?/.exec(s);
  if (!m) return '';
  let y = m[3] ? Number(m[3]) : Number(anioPorDefecto);
  if (!y) return '';
  if (y < 100) y += 2000;
  const d = Number(m[1]); const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ───────────────────────── Generar PDF desde el sistema ─────────────────────────
const MARCA = 'tropa307:';
const NAVY = [0.172, 0.071, 0.38];
const VERDE = [0.016, 0.737, 0.6];

const aBase64 = (bytes) => { let b = ''; for (let k = 0; k < bytes.length; k += 8192) b += String.fromCharCode(...bytes.subarray(k, k + 8192)); return btoa(b); };
const deBase64 = (txt) => Uint8Array.from(atob(txt), (c) => c.charCodeAt(0));
const empaquetar = (obj) => MARCA + aBase64(new TextEncoder().encode(JSON.stringify(obj)));
const desempaquetar = (txt) => { try { return txt?.startsWith(MARCA) ? JSON.parse(new TextDecoder().decode(deBase64(txt.slice(MARCA.length)))) : null; } catch { return null; } };

function ajustarLineas(font, texto, size, ancho) {
  const lineas = [];
  for (const parr of String(texto).split('\n')) {
    let actual = '';
    for (const pal of parr.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${pal}` : pal;
      if (font.widthOfTextAtSize(prueba, size) <= ancho) { actual = prueba; continue; }
      if (actual) lineas.push(actual);
      let resto = pal;
      while (font.widthOfTextAtSize(resto, size) > ancho) {
        let k = resto.length;
        while (k > 1 && font.widthOfTextAtSize(resto.slice(0, k), size) > ancho) k -= 1;
        lineas.push(resto.slice(0, k)); resto = resto.slice(k);
      }
      actual = resto;
    }
    lineas.push(actual);
  }
  return lineas;
}

// Busca la letra más grande (hasta «pref») con la que el texto cabe; si ni con la mínima cabe, lo recorta con «…»
function ajustarTexto(font, texto, { ancho, alto, multi, pref, min }) {
  const W = ancho - 6; const H = alto - 4;
  const entra = (t, s) => (multi ? ajustarLineas(font, t, s, W).length * s * 1.2 <= H : font.widthOfTextAtSize(t, s) <= W);
  for (let s = pref; s >= min; s -= 0.5) if (entra(texto, s)) return { size: s, texto, recortado: false };
  let lo = 0; let hi = texto.length;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (entra(`${texto.slice(0, mid).trimEnd()}…`, min)) lo = mid; else hi = mid - 1; }
  return { size: min, texto: `${texto.slice(0, lo).trimEnd()}…`, recortado: true };
}

// Hojas de continuación con el estilo del formulario
function paginasExtra(pdf, fuentes, titulos, secciones) {
  const { normal, negrita } = fuentes;
  const ANCHO = 792; const ALTO = 612; const MG = 30; const TAB = ANCHO - MG * 2;
  const paginas = [];
  const nuevaPagina = (subtitulo) => {
    const p = pdf.addPage([ANCHO, ALTO]);
    p.drawRectangle({ x: 0, y: ALTO - 64, width: ANCHO, height: 64, color: pdf.__navy });
    p.drawRectangle({ x: 0, y: ALTO - 68, width: ANCHO, height: 4, color: pdf.__verde });
    p.drawText('CICLO DE PROGRAMA', { x: MG, y: ALTO - 42, size: 22, font: negrita, color: pdf.__blanco });
    p.drawText(titulos.derecha, { x: ANCHO - MG - normal.widthOfTextAtSize(titulos.derecha, 10), y: ALTO - 40, size: 10, font: normal, color: pdf.__blanco });
    p.drawText(subtitulo, { x: MG, y: ALTO - 94, size: 14, font: negrita, color: pdf.__navy });
    paginas.push(p);
    return { p, y: ALTO - 108 };
  };
  for (const sec of secciones) {
    const tam = 9; const pad = 4; const lh = 11;
    const total = sec.columnas.reduce((a, c) => a + c.w, 0);
    const cols = sec.columnas.map((c) => ({ ...c, w: (c.w / total) * TAB }));
    let { p, y } = nuevaPagina(sec.titulo);
    const cabecera = () => {
      p.drawRectangle({ x: MG, y: y - 20, width: TAB, height: 20, color: pdf.__navy });
      let x = MG;
      for (const c of cols) { p.drawText(c.t, { x: x + pad, y: y - 14, size: 9, font: negrita, color: pdf.__blanco }); x += c.w; }
      y -= 20;
    };
    cabecera();
    const maxLineas = Math.floor((ALTO - 108 - 44 - 40 - pad * 2) / lh);
    const filasPartidas = sec.filas.flatMap((fila) => {
      const lin = cols.map((c, k) => ajustarLineas(normal, seguro(fila[k] ?? ''), tam, c.w - pad * 2));
      const n = Math.ceil(Math.max(...lin.map((l) => l.length), 1) / maxLineas);
      return Array.from({ length: n }, (_, i) => lin.map((l) => l.slice(i * maxLineas, (i + 1) * maxLineas).join('\n')));
    });
    for (const fila of filasPartidas) {
      const celdas = cols.map((c, k) => ajustarLineas(normal, seguro(fila[k] ?? ''), tam, c.w - pad * 2));
      const alto = Math.max(...celdas.map((l) => l.length), 1) * lh + pad * 2;
      if (y - alto < 44) { ({ p, y } = nuevaPagina(`${sec.titulo} (continuación)`)); cabecera(); }
      let x = MG;
      cols.forEach((c, k) => {
        p.drawRectangle({ x, y: y - alto, width: c.w, height: alto, borderColor: pdf.__navy, borderWidth: 0.6 });
        celdas[k].forEach((l, n) => p.drawText(l, { x: x + pad, y: y - pad - lh * (n + 1) + 3, size: tam, font: c.centro ? negrita : normal, color: pdf.__negro }));
        x += c.w;
      });
      y -= alto;
    }
  }
  paginas.forEach((p, n) => p.drawText(`Hoja adicional ${n + 1} de ${paginas.length} · ${titulos.pie}`, { x: MG, y: 24, size: 8, font: normal, color: pdf.__gris }));
  return paginas.length;
}

export async function generarPdfCiclo({ plantilla, ciclo, protagonistas, patrullas = [], grupo, filas }) {
  const { PDFDocument, PDFTextField, TextAlignment, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.load(plantilla);
  pdf.__navy = rgb(...NAVY); pdf.__verde = rgb(...VERDE); pdf.__blanco = rgb(1, 1, 1); pdf.__negro = rgb(0, 0, 0); pdf.__gris = rgb(0.4, 0.4, 0.45);
  const form = pdf.getForm();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const S = mapa.simples;
  const extras = { eval: [], traspasos: [], cronograma: [], progresion: [], equipos: [], textos: {} };
  const secciones = []; const recortes = [];
  const ya = new Set();

  const tamPref = (campo, multi) => {
    const da = campo.acroField.getDefaultAppearance() || '';
    const t = Number((/(\d+(?:\.\d+)?)\s+Tf/.exec(da) || [])[1] || 0);
    if (t > 0) return Math.min(t, 12);
    const alto = campo.acroField.getWidgets()[0]?.getRectangle().height || 20;
    return multi ? 11 : alto < 17 ? 10 : 12;
  };
  // Escribe un texto en su campo: ajusta la letra y, si no cabe, lo recorta (el texto completo va a una hoja adicional)
  const texto = (name, v, etiqueta) => {
    let campo; try { campo = form.getTextField(name); } catch { return; }
    let t = seguro(v);
    const multi = campo.isMultiline();
    if (!multi) t = t.replace(/\s*\n\s*/g, ' ');
    const r = campo.acroField.getWidgets()[0].getRectangle();
    const fit = ajustarTexto(normal, t, { ancho: r.width, alto: r.height, multi, pref: tamPref(campo, multi), min: multi ? 7 : 6.5 });
    campo.setText(fit.texto);
    campo.setFontSize(fit.size);
    ya.add(name);
    if (fit.recortado) { recortes.push([etiqueta || name, t]); extras.textos[name] = String(v); }
  };
  const marca = (name, on) => { try { const c = form.getCheckBox(name); if (on) c.check(); else c.uncheck(); } catch { /* campo ausente */ } };

  const ev = ciclo.evaluacion || {};
  const mem = ciclo.membresia || {};

  // Encabezado
  texto(S.nombreSeccion, ciclo.nombreSeccion, 'Nombre de la sección');
  texto(S.grupo, grupo?.numero, 'Número de grupo');
  texto(S.fecha, dmy(ciclo.fecha), 'Fecha');
  texto(S.numero, ciclo.numero, 'Ciclo número');
  texto(S.desde, dmy(ciclo.inicio), 'Rige desde');
  texto(S.hasta, dmy(ciclo.fin), 'Rige hasta');

  // «Group1» es un solo grupo de opciones que el formulario usa en la página 1 (sección) y en la 3 (logro del objetivo):
  // elegir una desmarca la otra. Se deja el logro seleccionado y «Tropa» se marca con una X en un campo de solo lectura encima.
  const sec = form.getRadioGroup('Group1');
  const widgetTropa = sec.acroField.getWidgets().find((w) => w.getOnValue()?.decodeText() === 'Tropa');
  if (widgetTropa) {
    const r = widgetTropa.getRectangle();
    const x = form.createTextField('marca_tropa');
    x.addToPage(pdf.getPage(0), { x: r.x, y: r.y, width: r.width, height: r.height, borderWidth: 0 });
    x.setAlignment(TextAlignment.Center); x.setFontSize(15); x.setText('X'); x.enableReadOnly();
    ya.add('marca_tropa');
  }
  const LOGRO = { si: 'Si', no: 'No', parcial: 'Parcial' };
  if (LOGRO[ev.logro]) sec.select(LOGRO[ev.logro]);
  const g2 = form.getRadioGroup('Group2');
  const orden2 = g2.acroField.getWidgets().map((w) => ({ x: w.getRectangle().x, v: w.getOnValue().decodeText() })).sort((a, b) => a.x - b.x);
  const idx2 = ['si', 'no', 'parcial'].indexOf(ev.logroEspecificosEstado);
  if (idx2 >= 0 && orden2[idx2]) g2.select(orden2[idx2].v);

  // Evaluación de actividades del ciclo anterior (9 filas en el formulario)
  const listaEv = ev.actividades || [];
  mapa.eval.forEach((f, i) => {
    const a = listaEv[i]; if (!a) return;
    const e = `Evaluación · fila ${i + 1}`;
    texto(f.fecha, dmy(a.fecha), `${e} · fecha`); texto(f.actividad, a.actividad, `${e} · actividad`); texto(f.objetivo, a.objetivo, `${e} · objetivo`);
    texto(f.responsable, a.responsable, `${e} · responsable`); texto(f.eval, a.eval, `${e} · evaluación`); texto(f.obs, a.obs, `${e} · observaciones`);
  });
  extras.eval = listaEv.slice(mapa.eval.length);
  if (extras.eval.length) secciones.push({ titulo: 'Evaluación de actividades (continuación)', columnas: [{ t: 'Fecha', w: 62 }, { t: 'Actividad', w: 150 }, { t: 'Objetivo', w: 170 }, { t: 'Responsable', w: 100 }, { t: '(*)', w: 30 }, { t: 'Observaciones', w: 180 }], filas: extras.eval.map((a) => [dmy(a.fecha), a.actividad, a.objetivo, a.responsable, a.eval, a.obs]) });
  texto(S.logroDetalle, ev.logroDetalle, 'Diagnóstico · detalle del logro del objetivo');
  texto(S.logroEspecificos, ev.logroEspecificos, 'Diagnóstico · detalle de los objetivos específicos');
  texto(S.gusto, ev.gusto, 'Diagnóstico · actividad que LES GUSTÓ');
  texto(S.noGusto, ev.noGusto, 'Diagnóstico · actividad que NO LES GUSTÓ');

  // Progresión personal: cuadro de seguimiento (22 filas) y proyección detallada (23 filas)
  const lista = filas || protagonistas.filter((p) => p.activo !== false);
  const pr = (p) => ciclo.progresion?.[p.id] || {};
  const nombre = (p) => `${p.nombre || ''} ${p.apellidos || ''}`.trim();
  const sumas = Object.fromEntries(AREAS_PDF.map((k) => [k, lista.filter((p) => pr(p).areas?.[k]).length]));
  const simple = (f, p) => {
    texto(f.nombre, nombre(p), 'Seguimiento · nombre'); texto(f.etapa, pr(p).etapaCiclo || p.etapa, 'Seguimiento · etapa'); texto(f.actividades, pr(p).actividades, `Seguimiento · actividades de ${nombre(p)}`);
    AREAS_PDF.forEach((k) => marca(f[k], !!pr(p).areas?.[k]));
  };
  const detallada = (f, p) => {
    texto(f.nombre, nombre(p), 'Proyección · nombre'); texto(f.ingreso, mesAnio(p.fechaIngreso), 'Proyección · ingreso'); texto(f.edad, edad(p.fechaNacimiento) ?? '', 'Proyección · edad');
    texto(f.etapaActual, p.etapa, 'Proyección · etapa actual'); texto(f.etapaCiclo, pr(p).etapaCiclo || p.etapa, 'Proyección · etapa en el ciclo');
    AREAS_PDF.forEach((k) => marca(f[k], !!pr(p).areas?.[k]));
    texto(f.servicio, pr(p).areas?.servicio ? 'X' : '', 'Proyección · servicio');
    texto(f.actividades, pr(p).actividades, `Proyección · actividades de ${nombre(p)}`); texto(f.otras, pr(p).otras, `Proyección · otras de ${nombre(p)}`);
  };
  const n1 = mapa.prog1.length; const n3 = mapa.proy1.length;
  mapa.prog1.forEach((f, i) => lista[i] && simple(f, lista[i]));
  mapa.prog2.forEach((f, i) => lista[n1 + i] && simple(f, lista[n1 + i]));
  mapa.proy1.forEach((f, i) => lista[i] && detallada(f, lista[i]));
  mapa.proy2.forEach((f, i) => lista[n3 + i] && detallada(f, lista[n3 + i]));
  AREAS_PDF.forEach((k) => { texto(mapa.totales_prog2[k], sumas[k], 'Total'); texto(mapa.totales_proy2[k], sumas[k], 'Total'); });
  const capSimple = n1 + mapa.prog2.length; const capDet = n3 + mapa.proy2.length;
  const sobran = lista.slice(Math.max(capSimple, capDet));
  // Los que caben en la proyección pero no en el cuadro de seguimiento solo aparecen en la proyección; los que no caben en ninguna van a la hoja adicional
  extras.progresion = sobran.map((p) => ({ nombre: nombre(p), etapa: p.etapa, etapaCiclo: pr(p).etapaCiclo || '', areas: pr(p).areas || {}, actividades: pr(p).actividades || '', otras: pr(p).otras || '' }));
  const sinCuadro = lista.slice(capSimple, capDet);
  if (sobran.length || sinCuadro.length) {
    const resto = [...sinCuadro, ...sobran].filter((p, k, a) => a.indexOf(p) === k);
    secciones.push({
      titulo: 'Progresión personal (continuación)',
      columnas: [{ t: 'Nombre', w: 130 }, { t: 'Etapa actual', w: 62 }, { t: 'Etapa en ciclo', w: 62 }, ...AREAS.map((a) => ({ t: a.label.slice(0, 5) + '.', w: 34, centro: true })), { t: 'Actividades propuestas', w: 120 }, { t: 'Otras', w: 90 }],
      filas: resto.map((p) => [nombre(p), p.etapa, pr(p).etapaCiclo || p.etapa, ...AREAS.map((a) => (pr(p).areas?.[a.key] ? 'X' : '')), pr(p).actividades, pr(p).otras]),
    });
  }

  // Traspasos y ceremonias (9 filas)
  const traspasos = ciclo.traspasos || [];
  mapa.traspasos.forEach((f, i) => { const t = traspasos[i]; if (!t) return; texto(f.nombre, t.nombre, `Traspasos · fila ${i + 1} · nombre`); texto(f.actividad, t.actividad, `Traspasos · fila ${i + 1} · actividad`); texto(f.obs, t.observaciones, `Traspasos · fila ${i + 1} · observaciones`); });
  extras.traspasos = traspasos.slice(mapa.traspasos.length);
  if (extras.traspasos.length) secciones.push({ titulo: 'Traspasos y ceremonias (continuación)', columnas: [{ t: 'Nombre', w: 160 }, { t: 'Actividad (traspaso o ceremonia)', w: 300 }, { t: 'Observaciones', w: 270 }], filas: extras.traspasos.map((t) => [t.nombre, t.actividad, t.observaciones]) });

  // Propuesta: objetivos por equipo (2 equipos en el formulario)
  texto(S.numero2, ciclo.numero, 'Ciclo número'); texto(S.anio, ciclo.anio, 'Año');
  texto(S.periodo, ciclo.periodo || `${dmy(ciclo.inicio)} al ${dmy(ciclo.fin)}`, 'Período');
  const equipos = ciclo.equipos || [];
  mapa.equipos.forEach((f, i) => {
    const e = equipos[i]; if (!e) return;
    texto(f.nombre, e.nombre || patrullas.find((p) => p.id === e.patrullaId)?.nombre, `Equipo ${i + 1} · nombre`);
    texto(f.general, e.general, `Equipo ${i + 1} · objetivo general`);
    const lineas = String(e.especificos || '').split('\n').map((x) => x.trim()).filter(Boolean);
    f.especificos.forEach((campo, j) => texto(campo, j === f.especificos.length - 1 ? lineas.slice(j).join('\n') : lineas[j] || '', `Equipo ${i + 1} · objetivos específicos`));
  });
  extras.equipos = equipos.slice(mapa.equipos.length);
  if (extras.equipos.length) secciones.push({ titulo: 'Objetivos de equipo (continuación)', columnas: [{ t: 'Nombre de equipo / patrulla', w: 150 }, { t: 'Objetivo general', w: 250 }, { t: 'Objetivos específicos', w: 330 }], filas: extras.equipos.map((e) => [e.nombre || patrullas.find((p) => p.id === e.patrullaId)?.nombre, e.general, e.especificos]) });
  texto(S.objetivoGeneral, ciclo.objetivoGeneral, 'Objetivo general');
  texto(S.objetivosEspecificos, ciclo.objetivosEspecificos, 'Objetivos específicos');

  // Cronograma (dos páginas de 15 filas)
  const crono = ciclo.cronograma || [];
  const filaCrono = (f, a, n) => { const e = `Cronograma · fila ${n}`; texto(f.fecha, dmy(a.fecha), `${e} · fecha`); texto(f.actividad, a.actividad, `${e} · actividad`); texto(f.objetivo, a.objetivo, `${e} · objetivo`); texto(f.responsable, a.responsable, `${e} · responsable`); };
  mapa.crono1.forEach((f, i) => crono[i] && filaCrono(f, crono[i], i + 1));
  mapa.crono2.forEach((f, i) => crono[mapa.crono1.length + i] && filaCrono(f, crono[mapa.crono1.length + i], mapa.crono1.length + i + 1));
  const capCrono = mapa.crono1.length + mapa.crono2.length;
  extras.cronograma = crono.slice(capCrono);
  if (extras.cronograma.length) secciones.push({ titulo: 'Cronograma (continuación)', columnas: [{ t: 'Fecha', w: 70 }, { t: 'Actividad', w: 220 }, { t: 'Objetivo', w: 300 }, { t: 'Responsable', w: 140 }], filas: extras.cronograma.map((a) => [dmy(a.fecha), a.actividad, a.objetivo, a.responsable]) });

  // Membresía, fondo motivador y Junta
  texto(S.fondo, ciclo.nombre, 'Fondo motivador (tema)');
  texto(S.nuevos, mem.nuevos, 'Nuevos ingresos'); texto(S.partidas, mem.partidas, 'Partidas'); texto(S.dirigentes, mem.dirigentes, 'Dirigentes'); texto(S.activos, lista.length, 'Miembros activos');
  texto(S.desercion, mem.desercion, 'Motivo de la deserción');
  texto(S.solicitudes, ciclo.solicitudes, 'Solicitudes importantes a la Junta de Grupo');

  // Texto que no cupo en su campo: se completa en una hoja adicional
  if (recortes.length) secciones.push({ titulo: 'Texto completo de los campos que no cupieron', columnas: [{ t: 'Campo', w: 220 }, { t: 'Texto completo', w: 510 }], filas: recortes });

  // Campos que quedaron con tamaño de letra «automático»
  for (const campo of form.getFields()) {
    if (!(campo instanceof PDFTextField) || ya.has(campo.getName())) continue;
    const da = campo.acroField.getDefaultAppearance() || '';
    if (Number((/(\d+(?:\.\d+)?)\s+Tf/.exec(da) || [])[1] || 0) > 0) continue;
    const alto = campo.acroField.getWidgets()[0]?.getRectangle().height || 20;
    campo.setFontSize(campo.isMultiline() ? 11 : alto < 17 ? 10 : 12);
  }

  const avisos = [];
  if (secciones.length) {
    const hojas = paginasExtra(pdf, { normal, negrita }, { derecha: `Ciclo ${ciclo.numero || ''} · ${ciclo.nombreSeccion || ''}`.trim(), pie: `Ciclo ${ciclo.numero || ''} ${ciclo.anio || ''} · Grupo ${grupo?.numero || ''}` }, secciones);
    avisos.push(`Se agregaron ${hojas} hoja(s) adicional(es) al final del PDF con lo que no cabía en el formulario: ${secciones.map((x) => x.titulo.replace(' (continuación)', '')).join(', ')}.`);
  }
  // Lo que excede al formulario viaja dentro del PDF para poder volver a subirlo sin perderlo
  const lleno = Object.values(extras).some((v) => (Array.isArray(v) ? v.length : Object.keys(v).length));
  if (lleno) pdf.setSubject(empaquetar(extras));
  pdf.setTitle(`Ciclo de Programa ${ciclo.numero || ''} · ${ciclo.nombreSeccion || ''}`.trim());

  const bytes = await pdf.save();
  return { bytes, avisos };
}

// ───────────────────────── Leer un formulario ya llenado ─────────────────────────
export async function importarPdfCiclo(buffer, { protagonistas = [], patrullas = [] } = {}) {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.load(buffer);
  const form = pdf.getForm();
  const avisos = [];
  const S = mapa.simples;
  if (!form.getFields().length) throw new Error('El PDF no tiene campos de formulario. Usá el formulario oficial descargado desde aquí y llenalo en un lector de PDF (Vista Previa, Adobe, Chrome).');

  const extras = desempaquetar(pdf.getSubject()) || {}; // filas y textos que no cupieron en el formulario al generarlo
  const T = (name) => {
    let v = ''; try { v = (form.getTextField(name).getText() || '').trim(); } catch { /* campo ausente */ }
    const completo = extras.textos?.[name];
    return completo && v.endsWith('…') ? String(completo).trim() : v;
  };
  const C = (name) => { try { return form.getCheckBox(name).isChecked(); } catch { return false; } };
  const filaConTexto = (f) => Object.entries(f).some(([k, name]) => !AREAS_PDF.includes(k) && T(name));

  const d = {};
  d.nombreSeccion = T(S.nombreSeccion);
  d.numero = T(S.numero) || T(S.numero2);
  d.anio = Number(T(S.anio)) || undefined;
  d.fecha = fechaIso(T(S.fecha), d.anio);
  d.inicio = fechaIso(T(S.desde), d.anio);
  d.fin = fechaIso(T(S.hasta), d.anio);
  d.periodo = T(S.periodo);
  d.nombre = T(S.fondo);
  if (!d.anio) d.anio = Number((d.inicio || d.fecha || '').slice(0, 4)) || undefined;

  let sel = ''; try { sel = form.getRadioGroup('Group1').getSelected() || ''; } catch { /* sin opción */ }
  const logro = { Si: 'si', No: 'no', Parcial: 'parcial' }[sel] || '';
  if (['Manada', 'Wak', 'Comu'].includes(sel)) avisos.push('El formulario tiene marcada otra sección (Manada, Wak o Comunidad), no Tropa.');
  let est = '';
  try {
    const g2 = form.getRadioGroup('Group2'); const elegido = g2.getSelected();
    const orden = g2.acroField.getWidgets().map((w) => ({ x: w.getRectangle().x, v: w.getOnValue().decodeText() })).sort((a, b) => a.x - b.x);
    est = ['si', 'no', 'parcial'][orden.findIndex((o) => o.v === elegido)] || '';
  } catch { /* sin opción */ }

  const evaluacion = {
    actividades: mapa.eval.filter(filaConTexto).map((f) => ({
      fecha: fechaIso(T(f.fecha), d.anio), actividad: T(f.actividad), objetivo: T(f.objetivo), responsable: T(f.responsable),
      eval: (T(f.eval).match(/[123]/) || [''])[0], obs: T(f.obs),
    })).concat(extras.eval || []),
    logro, logroDetalle: T(S.logroDetalle), logroEspecificosEstado: est, logroEspecificos: T(S.logroEspecificos),
    gusto: T(S.gusto), noGusto: T(S.noGusto),
  };

  // Progresión: se prefiere la proyección detallada; si está vacía, el cuadro de seguimiento
  const detalladas = [...mapa.proy1, ...mapa.proy2].filter((f) => T(f.nombre));
  const simples = [...mapa.prog1, ...mapa.prog2].filter((f) => T(f.nombre));
  const usar = detalladas.length ? detalladas : simples;
  const progresion = {};
  const todas = protagonistas.map((p) => ({ p, n: norm(`${p.nombre || ''} ${p.apellidos || ''}`) }));
  const buscar = (nombreTxt) => {
    const n = norm(nombreTxt);
    const toks = n.split(' ').filter(Boolean);
    const exactos = todas.filter((x) => x.n === n);
    // Por palabras completas: el nombre del PDF contenido en el del expediente, o al revés
    const cand = exactos.length === 1 ? exactos : todas.filter((x) => {
      const px = x.n.split(' ').filter(Boolean);
      return toks.every((t) => px.includes(t)) || px.every((t) => toks.includes(t));
    });
    if (cand.length !== 1) { avisos.push(cand.length ? `«${nombreTxt}» coincide con varios protagonistas; se omitió.` : `«${nombreTxt}» no coincide con ningún protagonista de los expedientes; se omitió.`); return null; }
    return cand[0].p;
  };
  const asignar = (p, etapaTxt, areas, actividades, otras) => {
    progresion[p.id] = { etapaCiclo: ETAPAS.find((e) => norm(e) === norm(etapaTxt)) || undefined, areas, actividades, otras };
  };
  for (const f of usar) {
    const p = buscar(T(f.nombre));
    if (!p) continue;
    const areas = Object.fromEntries(AREAS_PDF.map((k) => [k, C(f[k])]));
    if (f.servicio && T(f.servicio)) areas.servicio = true;
    asignar(p, T(f.etapaCiclo || f.etapa), areas, T(f.actividades), f.otras ? T(f.otras) : '');
  }
  for (const e of extras.progresion || []) {
    const p = buscar(e.nombre);
    if (p) asignar(p, e.etapaCiclo, e.areas || {}, e.actividades || '', e.otras || '');
  }

  const traspasos = mapa.traspasos.filter(filaConTexto).map((f) => ({ nombre: T(f.nombre), actividad: T(f.actividad), observaciones: T(f.obs) })).concat(extras.traspasos || []);
  const equipos = mapa.equipos.map((e) => ({
    nombre: T(e.nombre), general: T(e.general), especificos: e.especificos.map(T).filter(Boolean).join('\n'),
  })).filter((e) => e.nombre || e.general || e.especificos).concat(extras.equipos || []).map((e) => ({ ...e, patrullaId: e.patrullaId || patrullas.find((p) => norm(p.nombre) === norm(e.nombre))?.id || '' }));
  const cronograma = [...mapa.crono1, ...mapa.crono2].filter(filaConTexto).map((f) => ({
    fecha: fechaIso(T(f.fecha), d.anio), actividad: T(f.actividad), objetivo: T(f.objetivo), responsable: T(f.responsable),
  })).concat(extras.cronograma || []);
  if (cronograma.some((a) => !a.fecha)) avisos.push('Alguna fecha del cronograma no se pudo leer (usá día/mes/año). Revisala.');

  Object.assign(d, {
    evaluacion, progresion, traspasos, equipos, cronograma,
    objetivoGeneral: T(S.objetivoGeneral), objetivosEspecificos: T(S.objetivosEspecificos),
    membresia: { nuevos: T(S.nuevos), partidas: T(S.partidas), dirigentes: T(S.dirigentes), desercion: T(S.desercion) },
    solicitudes: T(S.solicitudes),
  });
  if (!d.fecha && T(S.fecha)) avisos.push(`No pude leer la fecha «${T(S.fecha)}».`);
  if (!d.inicio) avisos.push('Falta la fecha «Rige desde»: sin ella el ciclo no se asigna a las reuniones.');
  return { datos: d, avisos };
}
