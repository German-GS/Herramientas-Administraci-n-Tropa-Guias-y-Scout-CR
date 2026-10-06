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
export async function generarPdfCiclo({ plantilla, ciclo, protagonistas, patrullas = [], grupo, filas }) {
  const { PDFDocument, PDFTextField, TextAlignment } = await import('pdf-lib');
  const pdf = await PDFDocument.load(plantilla);
  const form = pdf.getForm();
  const avisos = [];
  const S = mapa.simples;

  const texto = (name, v) => { try { form.getTextField(name).setText(seguro(v)); } catch { /* campo ausente */ } };
  const marca = (name, on) => { try { const c = form.getCheckBox(name); if (on) c.check(); else c.uncheck(); } catch { /* campo ausente */ } };
  const llenarTabla = (clave, datos, fn, etiqueta) => {
    const rows = mapa[clave];
    datos.slice(0, rows.length).forEach((d, i) => fn(rows[i], d, i));
    if (datos.length > rows.length) avisos.push(`${etiqueta}: el formulario oficial admite ${rows.length} filas; sobraron ${datos.length - rows.length}.`);
  };

  const ev = ciclo.evaluacion || {};
  const mem = ciclo.membresia || {};

  // Encabezado
  texto(S.nombreSeccion, ciclo.nombreSeccion);
  texto(S.grupo, grupo?.numero);
  texto(S.fecha, dmy(ciclo.fecha));
  texto(S.numero, ciclo.numero);
  texto(S.desde, dmy(ciclo.inicio));
  texto(S.hasta, dmy(ciclo.fin));

  // «Group1» es un solo grupo de opciones que el formulario usa en la página 1 (sección) y en la 3 (logro del objetivo):
  // elegir una desmarca la otra. Se deja el logro seleccionado y «Tropa» se marca con una X dibujada.
  const sec = form.getRadioGroup('Group1');
  const widgetTropa = sec.acroField.getWidgets().find((w) => w.getOnValue()?.decodeText() === 'Tropa');
  if (widgetTropa) {
    // Los campos de formulario se dibujan sobre el contenido de la página: la X va en un campo de texto de solo lectura encima
    const r = widgetTropa.getRectangle();
    const x = form.createTextField('marca_tropa');
    x.addToPage(pdf.getPage(0), { x: r.x, y: r.y, width: r.width, height: r.height, borderWidth: 0 });
    x.setAlignment(TextAlignment.Center);
    x.setFontSize(15);
    x.setText('X');
    x.enableReadOnly();
  }
  const LOGRO = { si: 'Si', no: 'No', parcial: 'Parcial' };
  if (LOGRO[ev.logro]) sec.select(LOGRO[ev.logro]);
  const g2 = form.getRadioGroup('Group2');
  const orden2 = g2.acroField.getWidgets().map((w) => ({ x: w.getRectangle().x, v: w.getOnValue().decodeText() })).sort((a, b) => a.x - b.x);
  const idx2 = ['si', 'no', 'parcial'].indexOf(ev.logroEspecificosEstado);
  if (idx2 >= 0 && orden2[idx2]) g2.select(orden2[idx2].v);

  // Evaluación de actividades del ciclo anterior
  llenarTabla('eval', ev.actividades || [], (f, a) => {
    texto(f.fecha, dmy(a.fecha)); texto(f.actividad, a.actividad); texto(f.objetivo, a.objetivo);
    texto(f.responsable, a.responsable); texto(f.eval, a.eval); texto(f.obs, a.obs);
  }, 'Evaluación de actividades');
  texto(S.logroDetalle, ev.logroDetalle);
  texto(S.logroEspecificos, ev.logroEspecificos);
  texto(S.gusto, ev.gusto);
  texto(S.noGusto, ev.noGusto);

  // Progresión personal (cuadro de seguimiento y proyección)
  const lista = filas || protagonistas.filter((p) => p.activo !== false);
  const pr = (p) => ciclo.progresion?.[p.id] || {};
  const nombre = (p) => `${p.nombre || ''} ${p.apellidos || ''}`.trim();
  const sumas = Object.fromEntries(AREAS_PDF.map((k) => [k, lista.filter((p) => pr(p).areas?.[k]).length]));
  const simple = (f, p) => {
    texto(f.nombre, nombre(p)); texto(f.etapa, pr(p).etapaCiclo || p.etapa); texto(f.actividades, pr(p).actividades);
    AREAS_PDF.forEach((k) => marca(f[k], !!pr(p).areas?.[k]));
  };
  const detallada = (f, p) => {
    texto(f.nombre, nombre(p)); texto(f.ingreso, mesAnio(p.fechaIngreso)); texto(f.edad, edad(p.fechaNacimiento) ?? '');
    texto(f.etapaActual, p.etapa); texto(f.etapaCiclo, pr(p).etapaCiclo || p.etapa);
    AREAS_PDF.forEach((k) => marca(f[k], !!pr(p).areas?.[k]));
    texto(f.servicio, pr(p).areas?.servicio ? 'X' : ''); texto(f.actividades, pr(p).actividades); texto(f.otras, pr(p).otras);
  };
  const n1 = mapa.prog1.length; const n3 = mapa.proy1.length;
  mapa.prog1.forEach((f, i) => lista[i] && simple(f, lista[i]));
  mapa.prog2.forEach((f, i) => lista[n1 + i] && simple(f, lista[n1 + i]));
  mapa.proy1.forEach((f, i) => lista[i] && detallada(f, lista[i]));
  mapa.proy2.forEach((f, i) => lista[n3 + i] && detallada(f, lista[n3 + i]));
  AREAS_PDF.forEach((k) => {
    texto(mapa.totales_prog2[k], sumas[k]);
    texto(mapa.totales_proy2[k], sumas[k]);
  });
  const capacidad = Math.min(n1 + mapa.prog2.length, n3 + mapa.proy2.length);
  if (lista.length > capacidad) avisos.push(`Progresión personal: el formulario oficial admite ${capacidad} protagonistas; sobraron ${lista.length - capacidad}.`);

  // Traspasos y ceremonias
  llenarTabla('traspasos', ciclo.traspasos || [], (f, t) => { texto(f.nombre, t.nombre); texto(f.actividad, t.actividad); texto(f.obs, t.observaciones); }, 'Traspasos y ceremonias');

  // Propuesta
  texto(S.numero2, ciclo.numero);
  texto(S.anio, ciclo.anio);
  texto(S.periodo, ciclo.periodo || `${dmy(ciclo.inicio)} al ${dmy(ciclo.fin)}`);
  (ciclo.equipos || []).slice(0, mapa.equipos.length).forEach((e, i) => {
    const f = mapa.equipos[i];
    texto(f.nombre, e.nombre || patrullas.find((p) => p.id === e.patrullaId)?.nombre);
    texto(f.general, e.general);
    const lineas = String(e.especificos || '').split('\n').map((x) => x.trim()).filter(Boolean);
    f.especificos.forEach((campo, j) => texto(campo, j === f.especificos.length - 1 ? lineas.slice(j).join('\n') : lineas[j] || ''));
  });
  if ((ciclo.equipos || []).length > mapa.equipos.length) avisos.push(`Objetivos de equipo: el formulario oficial admite ${mapa.equipos.length} equipos.`);
  texto(S.objetivoGeneral, ciclo.objetivoGeneral);
  texto(S.objetivosEspecificos, ciclo.objetivosEspecificos);

  // Cronograma (dos páginas de 15 filas)
  const crono = ciclo.cronograma || [];
  const filaCrono = (f, a) => { texto(f.fecha, dmy(a.fecha)); texto(f.actividad, a.actividad); texto(f.objetivo, a.objetivo); texto(f.responsable, a.responsable); };
  mapa.crono1.forEach((f, i) => crono[i] && filaCrono(f, crono[i]));
  mapa.crono2.forEach((f, i) => crono[mapa.crono1.length + i] && filaCrono(f, crono[mapa.crono1.length + i]));
  if (crono.length > mapa.crono1.length + mapa.crono2.length) avisos.push(`Cronograma: el formulario oficial admite ${mapa.crono1.length + mapa.crono2.length} actividades.`);

  // Membresía, fondo motivador y Junta
  texto(S.fondo, ciclo.nombre);
  texto(S.nuevos, mem.nuevos);
  texto(S.partidas, mem.partidas);
  texto(S.dirigentes, mem.dirigentes);
  texto(S.activos, lista.length);
  texto(S.desercion, mem.desercion);
  texto(S.solicitudes, ciclo.solicitudes);

  // Los campos con tamaño de letra «automático» salen gigantes: se fija un tamaño legible
  for (const campo of form.getFields()) {
    if (!(campo instanceof PDFTextField)) continue;
    const da = campo.acroField.getDefaultAppearance() || '';
    const tam = Number((/(\d+(?:\.\d+)?)\s+Tf/.exec(da) || [])[1] || 0);
    if (tam > 0) continue;
    const alto = campo.acroField.getWidgets()[0]?.getRectangle().height || 20;
    campo.setFontSize(campo.isMultiline() ? 11 : alto < 17 ? 10 : 12);
  }

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

  const T = (name) => { try { return (form.getTextField(name).getText() || '').trim(); } catch { return ''; } };
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
    })),
    logro, logroDetalle: T(S.logroDetalle), logroEspecificosEstado: est, logroEspecificos: T(S.logroEspecificos),
    gusto: T(S.gusto), noGusto: T(S.noGusto),
  };

  // Progresión: se prefiere la proyección detallada; si está vacía, el cuadro de seguimiento
  const detalladas = [...mapa.proy1, ...mapa.proy2].filter((f) => T(f.nombre));
  const simples = [...mapa.prog1, ...mapa.prog2].filter((f) => T(f.nombre));
  const usar = detalladas.length ? detalladas : simples;
  const progresion = {};
  const todas = protagonistas.map((p) => ({ p, n: norm(`${p.nombre || ''} ${p.apellidos || ''}`) }));
  for (const f of usar) {
    const n = norm(T(f.nombre));
    const toks = n.split(' ').filter(Boolean);
    const cand = todas.filter((x) => x.n === n || toks.every((t) => x.n.includes(t)) || x.n.split(' ').every((t) => n.includes(t)));
    if (cand.length !== 1) { avisos.push(cand.length ? `«${T(f.nombre)}» coincide con varios protagonistas; se omitió.` : `«${T(f.nombre)}» no coincide con ningún protagonista de los expedientes; se omitió.`); continue; }
    const etapaTxt = T(f.etapaCiclo || f.etapa);
    const areas = Object.fromEntries(AREAS_PDF.map((k) => [k, C(f[k])]));
    if (f.servicio && T(f.servicio)) areas.servicio = true;
    progresion[cand[0].p.id] = {
      etapaCiclo: ETAPAS.find((e) => norm(e) === norm(etapaTxt)) || undefined,
      areas, actividades: T(f.actividades), otras: f.otras ? T(f.otras) : '',
    };
  }

  const traspasos = mapa.traspasos.filter(filaConTexto).map((f) => ({ nombre: T(f.nombre), actividad: T(f.actividad), observaciones: T(f.obs) }));
  const equipos = mapa.equipos.map((e) => ({
    nombre: T(e.nombre), general: T(e.general), especificos: e.especificos.map(T).filter(Boolean).join('\n'),
  })).filter((e) => e.nombre || e.general || e.especificos).map((e) => ({ ...e, patrullaId: patrullas.find((p) => norm(p.nombre) === norm(e.nombre))?.id || '' }));
  const cronograma = [...mapa.crono1, ...mapa.crono2].filter(filaConTexto).map((f) => ({
    fecha: fechaIso(T(f.fecha), d.anio), actividad: T(f.actividad), objetivo: T(f.objetivo), responsable: T(f.responsable),
  }));
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
