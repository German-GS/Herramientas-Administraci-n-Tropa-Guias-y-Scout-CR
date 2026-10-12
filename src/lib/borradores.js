// Borradores locales (en este dispositivo) de lo que se está editando: no se pierde nada si se sale o se recarga.
const clave = (tipo, gid, id) => `tropa.${tipo}.${gid}.${id || 'nuevo'}`;

export function leerBorradorDe(tipo, gid, id) {
  try { return JSON.parse(localStorage.getItem(clave(tipo, gid, id)) || 'null'); } catch { return null; }
}
export function guardarBorradorDe(tipo, gid, id, f) {
  try { localStorage.setItem(clave(tipo, gid, id), JSON.stringify({ f, ts: Date.now() })); } catch { /* sin almacenamiento */ }
}
export function borrarBorradorDe(tipo, gid, id) {
  try { localStorage.removeItem(clave(tipo, gid, id)); } catch { /* nada */ }
}
export function listarBorradoresDe(tipo, gid) {
  const out = [];
  try {
    const pref = `tropa.${tipo}.${gid}.`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k?.startsWith(pref)) continue;
      const b = JSON.parse(localStorage.getItem(k) || 'null');
      if (b?.f) out.push({ id: k.slice(pref.length), f: b.f, ts: b.ts });
    }
  } catch { /* nada */ }
  return out;
}
