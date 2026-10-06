// Etapas de progresión de la Tropa (bitácoras AGSCR)
export const ETAPAS = ['Aventurero', 'Intrépido', 'Pionero', 'Explorador'];

export const CARGOS = [
  'Guía de patrulla',
  'Subguía',
  'Guardián de leyendas',
  'Intendente',
  'Secretario',
  'Cocinero',
  'Integrante',
];

// Categorías fijas que se puntúan en cada reunión
// Puntaje general de la reunión (no ligado a un juego)
export const CATEGORIAS = [
  { key: 'asistencia', label: 'Asistencia' },
  { key: 'uniforme', label: 'Uniforme' },
  { key: 'inspeccion', label: 'Inspección' },
  { key: 'comportamiento', label: 'Comportamiento' },
];

export const TIPOS_ACTIVIDAD = [
  { v: 'activo', l: 'Juego activo' },
  { v: 'pasiva', l: 'Actividad pasiva' },
  { v: 'jefe', l: '5 minutos del jefe' },
];

// Criterios que se puntúan (1–10) en cada juego activo, por patrulla
export const CRITERIOS = [
  { key: 'espiritu', label: 'Espíritu', ayuda: 'Ánimo que le ponen a la actividad; cantan mientras no juegan (ej. en un relevo)' },
  { key: 'vivencia', label: 'Vivencia de Ley y Promesa', ayuda: 'Cómo viven la Ley y la Promesa durante el juego' },
  { key: 'astucia', label: 'Astucia', ayuda: 'Buenas ideas para facilitar el juego' },
  { key: 'sistema', label: 'Sistema de patrullas', ayuda: 'Uso del sistema de patrullas (guía, subguía, roles)' },
];

export const CONFIG_DEFAULT = {
  mesesPorEtapa: 6,       // tiempo de referencia para evaluar cambio de etapa
  avisoAnticipadoDias: 30, // días antes para avisar "próximo cambio de etapa"
  edadPasoSeccion: 15,     // edad en que se evalúa el paso a Wak
  puntajeMaxCategoria: 10, // puntaje máximo de cada criterio
  puntosLugar: '10, 7, 5, 3', // puntos por 1.º, 2.º, 3.º, 4.º lugar en un juego activo
};

export function siguienteEtapa(etapa) {
  const i = ETAPAS.indexOf(etapa);
  return i >= 0 && i < ETAPAS.length - 1 ? ETAPAS[i + 1] : null;
}

export function parseFecha(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function hoyISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatoFecha(str) {
  const d = parseFecha(str);
  if (!d) return '—';
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function edad(fechaNacimiento, ref = new Date()) {
  const n = parseFecha(fechaNacimiento);
  if (!n) return null;
  let e = ref.getFullYear() - n.getFullYear();
  const m = ref.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < n.getDate())) e--;
  return e;
}

export function sumarMeses(fecha, meses) {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + meses);
  return d;
}

function diasEntre(a, b) {
  return Math.round((b - a) / 86400000);
}

/**
 * Alertas de un protagonista activo.
 * tipo: 'etapa' | 'seccion' | 'expediente' | 'cumple'
 * nivel: 'alta' | 'media' | 'info'
 */
export function alertasDe(p, config = CONFIG_DEFAULT, ref = new Date()) {
  const out = [];
  if (p.activo === false) return out;
  const nombre = `${p.nombre || ''} ${p.apellidos || ''}`.trim();

  // Cambio de etapa
  const inicio = parseFecha(p.fechaInicioEtapa);
  if (inicio && siguienteEtapa(p.etapa)) {
    const objetivo = sumarMeses(inicio, Number(config.mesesPorEtapa) || 6);
    const faltan = diasEntre(ref, objetivo);
    if (faltan <= 0) {
      out.push({ tipo: 'etapa', nivel: 'alta', id: p.id, nombre,
        texto: `Evaluar cambio de etapa: ${p.etapa} → ${siguienteEtapa(p.etapa)} (cumplió el tiempo de referencia)` });
    } else if (faltan <= (Number(config.avisoAnticipadoDias) || 30)) {
      out.push({ tipo: 'etapa', nivel: 'media', id: p.id, nombre,
        texto: `Próximo cambio de etapa en ${faltan} días: ${p.etapa} → ${siguienteEtapa(p.etapa)}` });
    }
  }

  // Paso de sección (Tropa → Wak)
  const e = edad(p.fechaNacimiento, ref);
  if (e !== null && e >= (Number(config.edadPasoSeccion) || 15)) {
    out.push({ tipo: 'seccion', nivel: 'alta', id: p.id, nombre,
      texto: `Tiene ${e} años: evaluar paso a la Sección Wak` });
  } else if (p.etapa === 'Explorador' && e !== null && e >= (Number(config.edadPasoSeccion) || 15) - 1) {
    out.push({ tipo: 'seccion', nivel: 'media', id: p.id, nombre,
      texto: `Etapa Explorador y ${e} años: preparar su paso a Wak` });
  }

  // Expediente incompleto
  const faltantes = [];
  if (!p.fechaNacimiento) faltantes.push('fecha de nacimiento');
  if (!p.encargado?.nombre || !p.encargado?.telefono) faltantes.push('encargado/teléfono');
  if (!p.medico?.tipoSangre) faltantes.push('tipo de sangre');
  if (!p.medico?.alergias && !p.medico?.sinAlergias) faltantes.push('alergias');
  if (!p.fechaInicioEtapa) faltantes.push('fecha de inicio de etapa');
  if (faltantes.length) {
    out.push({ tipo: 'expediente', nivel: 'media', id: p.id, nombre,
      texto: `Expediente incompleto: falta ${faltantes.join(', ')}` });
  }

  // Cumpleaños del mes
  const n = parseFecha(p.fechaNacimiento);
  if (n && n.getMonth() === ref.getMonth()) {
    out.push({ tipo: 'cumple', nivel: 'info', id: p.id, nombre,
      texto: `Cumple años el ${n.getDate()} de este mes` });
  }

  return out;
}

export function listaPuntosLugar(config = CONFIG_DEFAULT) {
  const n = String(config?.puntosLugar ?? CONFIG_DEFAULT.puntosLugar).split(/[,;\s]+/).map(Number).filter((x) => !Number.isNaN(x));
  return n.length ? n : [10, 7, 5, 3];
}

const suma = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// Puntos de una patrulla en una reunión: juegos activos (criterios + lugar) + puntaje general
export function desglosePatrulla(reunion, pid, config = CONFIG_DEFAULT) {
  const crit = Object.fromEntries(CRITERIOS.map((c) => [c.key, 0]));
  const porLugar = listaPuntosLugar(config);
  let lugar = 0;
  const activos = new Set((reunion?.actividades || []).filter((a) => a.tipo === 'activo').map((a) => a.id));
  for (const [aid, j] of Object.entries(reunion?.juegos || {})) {
    const x = j?.[pid];
    if (!x || !activos.has(aid)) continue;
    CRITERIOS.forEach((c) => { crit[c.key] += Number(x[c.key]) || 0; });
    if (x.lugar) lugar += porLugar[Number(x.lugar) - 1] || 0;
  }
  const general = Object.fromEntries(CATEGORIAS.map((c) => [c.key, Number(reunion?.puntajes?.[pid]?.[c.key]) || 0]));
  return { crit, lugar, general, total: suma(crit) + lugar + suma(general) };
}

export const totalReunionPatrulla = (reunion, pid, config) => desglosePatrulla(reunion, pid, config).total;

// Áreas de crecimiento del método (Ciclo de Programa)
export const AREAS = [
  { key: 'corporalidad', label: 'Corporalidad' },
  { key: 'creatividad', label: 'Creatividad' },
  { key: 'caracter', label: 'Carácter' },
  { key: 'afectividad', label: 'Afectividad' },
  { key: 'sociabilidad', label: 'Sociabilidad' },
  { key: 'espiritualidad', label: 'Espiritualidad' },
  { key: 'servicio', label: 'Servicio' },
];

export const EVALUACION = [
  { v: '3', l: '3 · Cumplido' },
  { v: '2', l: '2 · Parcialmente cumplido' },
  { v: '1', l: '1 · No cumplido' },
];

export const etiquetaCiclo = (c) => (c ? `Ciclo ${c.numero || ''}${c.nombre ? ` — ${c.nombre}` : ''}`.replace('Ciclo  ', 'Ciclo ').trim() : '');

export function fechaLarga(str) {
  const d = parseFecha(str);
  if (!d) return '';
  const t = d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function horaCorta(h) {
  if (!h) return '';
  const [H, M] = h.split(':').map(Number);
  if (Number.isNaN(H)) return h;
  return `${((H + 11) % 12) + 1}:${String(M || 0).padStart(2, '0')} ${H < 12 ? 'a.m.' : 'p.m.'}`;
}
