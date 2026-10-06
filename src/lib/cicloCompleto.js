// ¿Qué falta para dar por terminado un ciclo de programa? Alimenta los recordatorios del Inicio y las marcas de las pestañas.
// Cada pendiente indica la pestaña del editor a la que pertenece.
export const ETIQUETAS = {
  datos: 'Datos', evaluacion: 'Evaluación y diagnóstico', seguimiento: 'Seguimiento de progresión', propuesta: 'Propuesta: equipos',
  objetivos: 'Objetivos del ciclo', cronograma: 'Cronograma', proyeccion: 'Proyección (dirigente)', junta: 'Membresía y Junta',
};
const TOTAL_SECCIONES = 7; // datos, evaluación, progresión, equipos, objetivos, cronograma, membresía

export function pendientesCiclo(c, { protagonistas = [], ciclos = [] } = {}) {
  const out = [];
  const add = (seccion, texto, grupo = seccion) => out.push({ seccion, texto, grupo });
  const vacio = (v) => !String(v ?? '').trim();

  if (vacio(c.nombre) || !c.inicio || !c.fin) add('datos', 'fondo motivador y fechas de vigencia');

  const hayAnterior = ciclos.some((x) => x.id !== c.id && x.inicio < (c.inicio || ''));
  const ev = c.evaluacion || {};
  if (hayAnterior || (ev.actividades || []).length) {
    const sinEval = (ev.actividades || []).filter((a) => !a.eval).length;
    if (sinEval) add('evaluacion', `${sinEval} actividad(es) sin evaluar`);
    const diag = [!ev.logro && 'logro del objetivo', !ev.logroEspecificosEstado && 'logro de los específicos', vacio(ev.gusto) && 'qué les gustó', vacio(ev.noGusto) && 'qué no les gustó'].filter(Boolean);
    if (diag.length) add('evaluacion', `diagnóstico (${diag.join(', ')})`);
  }

  const activos = protagonistas.filter((p) => p.activo !== false);
  const sinAreas = activos.filter((p) => !Object.values(c.progresion?.[p.id]?.areas || {}).some(Boolean)).length;
  if (activos.length && sinAreas) add('seguimiento', `${sinAreas} protagonista(s) sin áreas de crecimiento marcadas`, 'progresion');

  if (!(c.equipos || []).length || (c.equipos || []).some((e) => vacio(e.general))) add('propuesta', 'objetivos de cada equipo o patrulla');
  if (vacio(c.objetivoGeneral) || vacio(c.objetivosEspecificos)) add('objetivos', 'objetivo general y objetivos específicos');
  const crono = c.cronograma || [];
  if (!crono.length) add('cronograma', 'cronograma sin actividades');
  else if (crono.some((a) => !a.fecha || vacio(a.actividad))) add('cronograma', 'actividades del cronograma sin fecha o sin nombre');
  if (Number(c.membresia?.partidas) > 0 && vacio(c.membresia?.desercion)) add('junta', 'motivo de la deserción');
  return out;
}

export const seccionesPendientes = (pend) => {
  const set = new Set();
  pend.forEach((p) => { set.add(p.seccion); if (p.grupo === 'progresion') set.add('proyeccion'); });
  return set;
};
export const resumenPendientes = (pend) => {
  const grupos = new Set(pend.map((p) => p.grupo));
  return { faltan: grupos.size, total: TOTAL_SECCIONES, nombres: [...grupos].map((g) => (g === 'progresion' ? 'Progresión personal' : ETIQUETAS[g])) };
};

// ───── Borradores sin guardar (se conservan en este dispositivo) ─────
export const claveBorrador = (gid, id) => `tropa.ciclo.${gid}.${id || 'nuevo'}`;
export function leerBorrador(gid, id) {
  try { return JSON.parse(localStorage.getItem(claveBorrador(gid, id)) || 'null'); } catch { return null; }
}
export function guardarBorrador(gid, id, f) {
  try { localStorage.setItem(claveBorrador(gid, id), JSON.stringify({ f, ts: Date.now() })); } catch { /* sin almacenamiento */ }
}
export function borrarBorrador(gid, id) {
  try { localStorage.removeItem(claveBorrador(gid, id)); } catch { /* nada */ }
}
export function listarBorradores(gid) {
  const out = [];
  try {
    const pref = `tropa.ciclo.${gid}.`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k?.startsWith(pref)) continue;
      const b = JSON.parse(localStorage.getItem(k) || 'null');
      if (b?.f) out.push({ id: k.slice(pref.length), f: b.f, ts: b.ts });
    }
  } catch { /* nada */ }
  return out;
}
