import { CATEGORIAS, CRITERIOS, ITEMS_INSPECCION, desglosePatrulla, hoyISO, parseFecha } from './etapas.js';

// Ciclo vigente: el que contiene la fecha de hoy
export const cicloVigente = (ciclos, hoy = hoyISO()) => ciclos.find((c) => c.inicio <= hoy && (!c.fin || c.fin >= hoy)) || null;

// Días desde hoy hasta una fecha ISO (negativo si ya pasó)
export function diasHasta(fechaISO, hoy = hoyISO()) {
  const a = parseFecha(hoy); const b = parseFecha(fechaISO);
  return a && b ? Math.round((b - a) / 86400000) : null;
}

// Resultado de un ciclo: puntos por patrulla (con desglose), extras y participación individual.
// Es lo que se archiva cuando el ciclo termina.
export function resultadoCiclo(c, { reuniones = [], extras = [], patrullas = [], protagonistas = [], config } = {}) {
  const rs = reuniones.filter((r) => r.cicloId === c.id);
  const es = extras.filter((e) => e.cicloId === c.id);
  const pats = patrullas.map((pa) => {
    const acc = { crit: Object.fromEntries(CRITERIOS.map((k) => [k.key, 0])), lugar: 0, asistencia: 0, inspeccion: 0, general: Object.fromEntries(CATEGORIAS.map((k) => [k.key, 0])) };
    for (const r of rs) {
      const d = desglosePatrulla(r, pa.id, config);
      CRITERIOS.forEach((k) => { acc.crit[k.key] += d.crit[k.key]; });
      CATEGORIAS.forEach((k) => { acc.general[k.key] += d.general[k.key]; });
      acc.lugar += d.lugar; acc.asistencia += d.asistencia; acc.inspeccion += d.inspeccion;
    }
    const extra = es.filter((e) => e.patrullaId === pa.id).reduce((s, e) => s + (Number(e.puntos) || 0), 0);
    const total = Object.values(acc.crit).reduce((a, b) => a + b, 0) + acc.lugar + acc.asistencia + acc.inspeccion + Object.values(acc.general).reduce((a, b) => a + b, 0) + extra;
    return { id: pa.id, nombre: pa.nombre, color: pa.color || '', ...acc, extra, total };
  }).sort((a, b) => b.total - a.total);

  const mayor = pats[0]?.total ?? 0;
  const ganadoras = mayor > 0 ? pats.filter((p) => p.total === mayor).map((p) => ({ id: p.id, nombre: p.nombre })) : [];

  const individual = protagonistas.map((p) => {
    const presentes = rs.filter((r) => r.asistencia?.[p.id]);
    const elementos = presentes.reduce((t, r) => t + ITEMS_INSPECCION.filter((i) => r.inspeccion?.[p.id]?.[i.key]).length, 0);
    return { id: p.id, nombre: `${p.nombre || ''} ${p.apellidos || ''}`.trim(), asistencias: presentes.length, elementos };
  }).filter((x) => x.asistencias > 0);

  return {
    reuniones: rs.length,
    puntosLugar: config?.puntosLugar || '',
    patrullas: pats, ganadoras, individual,
    extras: es.map((e) => ({ fecha: e.fecha, patrullaId: e.patrullaId, puntos: Number(e.puntos) || 0, motivo: e.motivo || '' })),
  };
}
