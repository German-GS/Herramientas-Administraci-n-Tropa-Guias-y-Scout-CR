import JSZip from 'jszip';

// Lee un «Machote — Programa de reunión de Tropa» (.docx) ya llenado y lo convierte en los datos de una reunión.
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const nuevoId = () => Math.random().toString(36).slice(2, 9);
const nombreLimpio = (s) => (s || '').replace(/^Actividad\s+(?:activa|pasiva)?\s*\d+\s*:\s*/i, '').trim();
const vacio = (s) => !s || /^[—–-]+$/.test(s.trim());
const pendiente = (s) => /\[[^\]]*\]/.test(s || ''); // texto de la plantilla sin reemplazar

function textoDe(el) {
  let t = '';
  for (const n of el.getElementsByTagName('*')) {
    if (n.namespaceURI !== W) continue;
    if (n.localName === 't') t += n.textContent;
    else if (n.localName === 'tab') t += ' ';
    else if (n.localName === 'br') t += '\n';
  }
  return t;
}

async function leerBloques(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('El archivo no parece un documento de Word (.docx).');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const bloques = [];
  for (const el of body.children) {
    if (el.localName === 'p') {
      const t = textoDe(el).replace(/\s+/g, ' ').trim();
      if (t) bloques.push({ t: 'p', texto: t, lista: el.getElementsByTagNameNS(W, 'numPr').length > 0 });
    } else if (el.localName === 'tbl') {
      const filas = [...el.getElementsByTagNameNS(W, 'tr')].map((tr) =>
        [...tr.children].filter((c) => c.localName === 'tc')
          .map((tc) => [...tc.children].filter((c) => c.localName === 'p').map((p) => textoDe(p).replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')));
      bloques.push({ t: 'tbl', filas });
    }
  }
  return bloques;
}

function hora24(txt) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i.exec(txt || '');
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'p') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
}

function fechaISO(txt) {
  const m = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/i.exec(txt || '');
  const mes = m && MESES[m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
  return m && mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` : '';
}

function tipoDe(txt) {
  const n = norm(txt);
  let tipo = '';
  if (n.includes('inicio')) tipo = 'inicio';
  else if (n.includes('inspecci')) tipo = 'inspeccion';
  else if (n.includes('cierre')) tipo = 'cierre';
  else if (n.includes('juego activo') || n.includes('activa')) tipo = 'activo';
  else if (n.includes('pasiva')) tipo = 'pasiva';
  else if (n.includes('jefe')) tipo = 'jefe';
  const c = /(simple|compleja|manualidad)/i.exec(txt || '');
  return { tipo, complejidad: c ? c[1].toLowerCase() : '' };
}

const ETIQUETAS_FICHA = [
  [/^materiales\s*:\s*(.*)$/i, 'materiales'], [/^montaje\s*:\s*(.*)$/i, 'montaje'],
  [/^la din[aá]mica\s*:\s*(.*)$/i, 'dinamica'], [/^variante\s*:\s*(.*)$/i, 'variante'], [/^el reto\s*:\s*(.*)$/i, 'reto'],
];

export async function importarMachote(buffer, ciclos = []) {
  const bloques = await leerBloques(buffer);
  const avisos = [];
  const d = { lugar: '', fecha: '', horaInicio: '', horaFin: '', encargado: '', participantes: '', objetivo: '', fondo: '', notaEntorno: '', actividades: [], impresos: '', otrosMateriales: '', anexos: [] };
  let cicloTxt = '';
  let sec = 0;
  let ficha = null; let campo = null; const fichas = []; let enCierre = false; const cierreTxt = []; let conexion = '';
  let modo = ''; const impresos = []; let anexo = null; const anexos = [];

  for (let bi = 0; bi < bloques.length; bi += 1) {
    const b = bloques[bi];
    const sig = bloques[bi + 1];
    if (b.t === 'p') {
      const t = b.texto;
      if (/^1\.\s*Programa/i.test(t)) { sec = 1; continue; }
      if (/^2\.\s*Ayuda/i.test(t)) { sec = 2; continue; }
      if (/^3\.\s*Insumos/i.test(t)) { sec = 3; enCierre = false; continue; }
      if (/^4\./.test(t)) { sec = 3; continue; } // «4. Puntajes»: el contenido solo se toma si hay un anexo abierto

      if (sec === 1) {
        const m = /^(Lugar|Fecha|Hora|Encargado|Participantes|Ciclo|Objetivo|Fondo motivador)\s*:\s*(.*)$/i.exec(t);
        if (!m || pendiente(m[2])) continue;
        const k = m[1].toLowerCase(); const v = m[2].trim();
        if (k === 'lugar') d.lugar = v;
        else if (k === 'fecha') { d.fecha = fechaISO(v); if (!d.fecha) avisos.push(`No pude leer la fecha «${v}». Elegila a mano.`); }
        else if (k === 'hora') { const h = [...v.matchAll(/\d{1,2}(?::\d{2})?\s*[ap]\.?\s*m\.?/gi)].map((x) => hora24(x[0])); d.horaInicio = h[0] || ''; d.horaFin = h[1] || ''; }
        else if (k === 'encargado') d.encargado = v;
        else if (k === 'participantes') d.participantes = v;
        else if (k === 'ciclo') cicloTxt = v;
        else if (k === 'objetivo') d.objetivo = v;
        else d.fondo = v;
      } else if (sec === 2) {
        const nota = /^Nota de entorno seguro\s*[:.]\s*(.*)$/i.exec(t);
        const conecta = /^C[oó]mo se conecta con el fondo motivador\s*:\s*(.*)$/i.exec(t);
        const fi = /^Actividad\s+\d+\s*:\s*(.*)$/i.exec(t);
        const titulo = !/^Tipo\s*:/i.test(t) && sig?.t === 'p' && /^Tipo\s*:/i.test(sig.texto); // cualquier título seguido de «Tipo:»
        if (nota) { if (!pendiente(nota[1])) d.notaEntorno = nota[1].trim(); ficha = null; campo = null; }
        else if (conecta) { if (!pendiente(conecta[1])) conexion = conecta[1].trim(); ficha = null; campo = null; }
        else if (fi || titulo) {
          const nombre = nombreLimpio(fi ? fi[1] : t);
          ficha = pendiente(nombre) ? null : { nombre, duracion: '', encargado: '', materiales: '', montaje: '', dinamica: '', variante: '', reto: '' };
          campo = null; enCierre = false;
          if (ficha) fichas.push(ficha);
        } else if (/^Cierre$/i.test(t)) { ficha = null; campo = null; enCierre = true; }
        else if (enCierre) { if (!pendiente(t)) cierreTxt.push(t); }
        else if (ficha) {
          if (/^Tipo\s*:/i.test(t)) {
            for (const seg of t.split(/[·•]/)) {
              const kv = /^\s*(Duraci[oó]n|Encargado)\s*:\s*(.*)$/i.exec(seg);
              if (kv && !pendiente(kv[2])) {
                if (/^dur/i.test(kv[1])) ficha.duracion = (kv[2].match(/\d+/) || [''])[0];
                else ficha.encargado = kv[2].trim();
              }
            }
            campo = null;
          } else {
            const et = ETIQUETAS_FICHA.map(([re, k]) => [re.exec(t), k]).find(([m]) => m);
            if (et) { campo = et[1]; ficha[campo] = pendiente(et[0][1]) ? '' : et[0][1].trim(); }
            else if (campo && !pendiente(t)) ficha[campo] += `${ficha[campo] ? '\n' : ''}${b.lista ? '• ' : ''}${t}`;
          }
        }
      } else if (sec === 3) {
        if (/^Insumos para imprimir/i.test(t)) { modo = 'impresos'; continue; }
        const otros = /^Otros materiales\s*:\s*(.*)$/i.exec(t);
        if (otros) { if (!pendiente(otros[1])) d.otrosMateriales = otros[1].trim(); modo = 'anexos'; continue; }
        if (/^Agreg[aá] un anexo/i.test(t)) continue;
        if (modo === 'impresos' && /^Anexo\s+[A-Z]/i.test(t)) { if (!pendiente(t)) impresos.push(t); continue; }
        if (/^Anexo\s+[A-Z]\s*[—–-]/i.test(t)) {
          if (pendiente(t)) { anexo = null; continue; }
          const letra = /^Anexo\s+([A-Z])/i.exec(t)[1].toUpperCase();
          const previo = anexos.find((x) => x.letra === letra);
          if (previo) { anexo = previo; anexo.lineas.push(`— ${t} —`); } else { anexo = { letra, titulo: t, lineas: [] }; anexos.push(anexo); }
          continue;
        }
        if (anexo && !pendiente(t)) anexo.lineas.push(t);
      }
    } else if (b.t === 'tbl') {
      const cab = (b.filas[0] || []).map(norm);
      if (sec === 1 && cab[0] === 'hora' && cab.includes('actividad') && cab.includes('tipo')) {
        let sinCompletar = 0;
        for (const f of b.filas.slice(1)) {
          const [h, act, tipo, mat, enc] = f;
          if (pendiente(h) || pendiente(act) || !act) { sinCompletar += 1; continue; }
          const { tipo: tp, complejidad } = tipoDe(tipo);
          if (!tp) avisos.push(`La fila «${act}» tiene un tipo que no reconozco («${tipo}»). Elegí el tipo a mano.`);
          d.actividades.push({
            id: nuevoId(), hora: hora24(h), actividad: nombreLimpio(act), tipo: tp, complejidad,
            materiales: pendiente(mat) || vacio(mat) ? '' : mat.trim(), encargado: pendiente(enc) || vacio(enc) ? '' : enc.trim(),
            duracion: '', montaje: '', dinamica: '', variante: '', reto: '',
          });
        }
        if (sinCompletar) avisos.push(`${sinCompletar} fila(s) del cronograma siguen con texto de la plantilla [entre corchetes] y no se importaron.`);
      } else if (sec === 3 && anexo) {
        for (const f of b.filas) anexo.lineas.push(f.join(' | '));
      }
    }
  }

  // Fichas de «Ayuda al programa» → actividades (por nombre; si no, por orden)
  const conFicha = d.actividades.filter((a) => ['activo', 'pasiva', 'jefe'].includes(a.tipo));
  const usadas = new Set();
  const limpio = (s) => norm(nombreLimpio(s)).replace(/^juego central /, '');
  for (const a of conFicha) {
    const f = fichas.find((x) => !usadas.has(x) && (limpio(x.nombre) === limpio(a.actividad) || limpio(a.actividad).includes(limpio(x.nombre)) || limpio(x.nombre).includes(limpio(a.actividad))));
    if (f) { usadas.add(f); Object.assign(a, { duracion: f.duracion, montaje: f.montaje, dinamica: f.dinamica, variante: f.variante, reto: f.reto }); if (!a.materiales) a.materiales = f.materiales; if (!a.encargado) a.encargado = f.encargado; }
  }
  const sobrantes = fichas.filter((x) => !usadas.has(x));
  for (const a of conFicha.filter((x) => !x.dinamica)) {
    const f = sobrantes.shift();
    if (f) Object.assign(a, { duracion: f.duracion, montaje: f.montaje, dinamica: f.dinamica, variante: f.variante, reto: f.reto });
  }
  for (const a of d.actividades.filter((x) => ['activo', 'pasiva'].includes(x.tipo) && !x.dinamica)) avisos.push(`«${a.actividad}» no tiene ficha con «La dinámica» en la Ayuda al programa.`);

  if (cierreTxt.length) { const c = d.actividades.find((a) => a.tipo === 'cierre'); if (c) c.dinamica = cierreTxt.join('\n'); }
  if (conexion) d.fondo = `${d.fondo}${d.fondo ? '\n\n' : ''}Cómo se conecta: ${conexion}`;
  d.impresos = impresos.join('\n');
  d.anexos = anexos.map((x) => ({ titulo: x.titulo, texto: x.lineas.join('\n') }));
  const citados = new Set([...d.actividades.map((a) => a.materiales), d.impresos].join(' ').match(/Anexo\s+[A-Z]/gi)?.map((x) => `Anexo ${x.slice(-1).toUpperCase()}`) || []);
  const existentes = new Set(d.anexos.map((x) => (/^Anexo\s+([A-Z])/i.exec(x.titulo) || [])[1] ? `Anexo ${/^Anexo\s+([A-Z])/i.exec(x.titulo)[1].toUpperCase()}` : ''));
  for (const c of citados) if (!existentes.has(c)) avisos.push(`Se cita el ${c} pero no existe en «Insumos y anexos».`);

  if (cicloTxt && !vacio(cicloTxt) && !pendiente(cicloTxt)) {
    const nc = norm(cicloTxt);
    const c = ciclos.find((x) => nc.includes(norm(x.nombre || '###')) || norm(`ciclo ${x.numero} ${x.nombre || ''}`).includes(nc));
    if (c) d.cicloId = c.id; else avisos.push(`No encontré el ciclo «${cicloTxt}» en el sistema; se asignará según la fecha.`);
  }
  if (!d.actividades.length) avisos.push('No encontré el cronograma. ¿El archivo es el machote de la reunión de Tropa?');
  return { datos: d, avisos };
}
