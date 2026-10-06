import { useState } from 'react';
import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useGrupo } from '../lib/grupo.jsx';
import { useConfig } from '../lib/useConfig';
import { CATEGORIAS, formatoFecha, hoyISO, totalReunionPatrulla } from '../lib/etapas';

function cicloDeFecha(ciclos, fecha) {
  return ciclos.find((c) => c.inicio <= fecha && (!c.fin || c.fin >= fecha))?.id || '';
}

export default function Reuniones() {
  const { docs: reuniones } = useCollection('reuniones', 'fecha');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: ciclos } = useCollection('ciclos', 'inicio');
  const [sel, setSel] = useState(null);

  if (sel) {
    const r = sel === 'nueva' ? null : reuniones.find((x) => x.id === sel);
    return <EditorReunion key={sel} r={r} patrullas={patrullas} ciclos={ciclos} onCerrar={() => setSel(null)} />;
  }

  const lista = [...reuniones].reverse();
  return (
    <div className="card">
      <div className="row between">
        <h2>Reuniones</h2>
        <button className="btn primary" onClick={() => setSel('nueva')}>+ Registrar reunión</button>
      </div>
      {lista.length === 0 ? <p className="empty">Todavía no hay reuniones registradas.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Tema</th><th>Ciclo</th>{patrullas.map((p) => <th key={p.id}>{p.nombre}</th>)}</tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setSel(r.id)}>
                  <td>{formatoFecha(r.fecha)}</td>
                  <td>{r.tema || '—'}</td>
                  <td>{ciclos.find((c) => c.id === r.cicloId)?.nombre || <span className="muted">sin ciclo</span>}</td>
                  {patrullas.map((p) => <td key={p.id}><strong>{totalReunionPatrulla(r, p.id)}</strong></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EditorReunion({ r, patrullas, ciclos, onCerrar }) {
  const { col, ref } = useGrupo();
  const [config] = useConfig();
  const max = Number(config.puntajeMaxCategoria) || 10;
  const [f, setF] = useState(() => {
    const fecha = r?.fecha || hoyISO();
    return { fecha, tema: r?.tema || '', cicloId: r?.cicloId ?? cicloDeFecha(ciclos, fecha), puntajes: r?.puntajes || {} };
  });

  const setPunto = (pid, cat, v) => {
    const n = v === '' ? '' : Math.max(0, Math.min(max, Number(v)));
    setF((x) => ({ ...x, puntajes: { ...x.puntajes, [pid]: { ...(x.puntajes[pid] || {}), [cat]: n } } }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    const limpio = {};
    for (const p of patrullas) {
      limpio[p.id] = {};
      for (const c of CATEGORIAS) limpio[p.id][c.key] = Number(f.puntajes[p.id]?.[c.key]) || 0;
    }
    const data = { ...f, puntajes: limpio };
    if (r) await updateDoc(ref('reuniones', r.id), data);
    else await addDoc(col('reuniones'), data);
    onCerrar();
  };

  const borrar = async () => {
    if (confirm('¿Borrar esta reunión y sus puntajes?')) { await deleteDoc(ref('reuniones', r.id)); onCerrar(); }
  };

  return (
    <form className="card" onSubmit={guardar}>
      <div className="row between">
        <h2>{r ? `Reunión del ${formatoFecha(r.fecha)}` : 'Nueva reunión'}</h2>
        <button type="button" className="btn ghost" onClick={onCerrar}>← Volver</button>
      </div>
      <div className="form">
        <label>Fecha<input type="date" value={f.fecha} required
          onChange={(e) => setF({ ...f, fecha: e.target.value, cicloId: r ? f.cicloId : cicloDeFecha(ciclos, e.target.value) })} /></label>
        <label>Ciclo
          <select value={f.cicloId} onChange={(e) => setF({ ...f, cicloId: e.target.value })}>
            <option value="">— Sin ciclo —</option>
            {ciclos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="full">Tema / objetivo<input value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })} /></label>
      </div>

      {patrullas.length === 0 ? <p className="empty">Primero creá las patrullas.</p> : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead><tr><th>Categoría (0–{max})</th>{patrullas.map((p) => <th key={p.id}><span className="dot" style={{ background: p.color }} /> {p.nombre}</th>)}</tr></thead>
            <tbody>
              {CATEGORIAS.map((c) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  {patrullas.map((p) => (
                    <td key={p.id}>
                      <input type="number" min={0} max={max} style={{ width: 70 }}
                        value={f.puntajes[p.id]?.[c.key] ?? ''} onChange={(e) => setPunto(p.id, c.key, e.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                {patrullas.map((p) => <td key={p.id}><strong>{totalReunionPatrulla(f, p.id)}</strong></td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="row between" style={{ marginTop: 12 }}>
        <button className="btn primary">Guardar reunión</button>
        {r && <button type="button" className="btn danger" onClick={borrar}>Borrar</button>}
      </div>
    </form>
  );
}
