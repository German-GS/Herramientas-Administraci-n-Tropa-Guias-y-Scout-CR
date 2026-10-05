import { useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from '../lib/useCollection';
import { CATEGORIAS, formatoFecha, hoyISO } from '../lib/etapas';

export default function Ciclos() {
  const { docs: ciclos } = useCollection('ciclos', 'inicio');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: reuniones } = useCollection('reuniones', 'fecha');
  const { docs: extras } = useCollection('puntosExtra', 'fecha');
  const [form, setForm] = useState({ nombre: '', inicio: hoyISO(), fin: '' });
  const [editando, setEditando] = useState(null);
  const [cicloSel, setCicloSel] = useState('');

  const hoy = hoyISO();
  const actualId = cicloSel || (ciclos.find((c) => c.inicio <= hoy && (!c.fin || c.fin >= hoy)) || ciclos[ciclos.length - 1])?.id;
  const ciclo = ciclos.find((c) => c.id === actualId);

  const tabla = useMemo(() => {
    if (!ciclo) return [];
    const rs = reuniones.filter((r) => r.cicloId === ciclo.id);
    const es = extras.filter((e) => e.cicloId === ciclo.id);
    return patrullas.map((p) => {
      const porCat = Object.fromEntries(CATEGORIAS.map((c) => [c.key,
        rs.reduce((s, r) => s + (Number(r.puntajes?.[p.id]?.[c.key]) || 0), 0)]));
      const extra = es.filter((e) => e.patrullaId === p.id).reduce((s, e) => s + (Number(e.puntos) || 0), 0);
      const total = Object.values(porCat).reduce((a, b) => a + b, 0) + extra;
      return { ...p, porCat, extra, total };
    }).sort((a, b) => b.total - a.total);
  }, [ciclo, reuniones, extras, patrullas]);

  const nReuniones = ciclo ? reuniones.filter((r) => r.cicloId === ciclo.id).length : 0;

  const guardar = async (e) => {
    e.preventDefault();
    if (editando) await updateDoc(doc(db, 'ciclos', editando), form);
    else await addDoc(collection(db, 'ciclos'), form);
    setForm({ nombre: '', inicio: hoyISO(), fin: '' });
    setEditando(null);
  };

  const borrar = async (c) => {
    const usados = reuniones.some((r) => r.cicloId === c.id) || extras.some((x) => x.cicloId === c.id);
    if (usados) return alert('Este ciclo tiene reuniones o puntos asociados; no se puede borrar.');
    if (confirm(`¿Borrar el ciclo ${c.nombre}?`)) await deleteDoc(doc(db, 'ciclos', c.id));
  };

  return (
    <>
      <div className="card">
        <div className="row between">
          <h2>Puntaje final {ciclo ? `— ${ciclo.nombre}` : ''}</h2>
          <select value={actualId || ''} onChange={(e) => setCicloSel(e.target.value)}>
            {ciclos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        {ciclo && <p className="muted">{formatoFecha(ciclo.inicio)} – {ciclo.fin ? formatoFecha(ciclo.fin) : 'en curso'} · {nReuniones} reuniones</p>}
        {!ciclo ? <p className="empty">Creá un ciclo de programa abajo.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Patrulla</th>{CATEGORIAS.map((c) => <th key={c.key}>{c.label}</th>)}<th>Extra</th><th>Total</th></tr></thead>
              <tbody>
                {tabla.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i === 0 && p.total > 0 ? '🏆' : i + 1}</td>
                    <td><span className="dot" style={{ background: p.color }} /> <strong>{p.nombre}</strong></td>
                    {CATEGORIAS.map((c) => <td key={c.key}>{p.porCat[c.key]}</td>)}
                    <td className={p.extra >= 0 ? 'pos-num' : 'neg-num'}>{p.extra > 0 ? '+' : ''}{p.extra}</td>
                    <td><strong>{p.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ciclo && <button className="btn small" style={{ marginTop: 8 }} onClick={() => window.print()}>Imprimir</button>}
      </div>

      <div className="grid two">
        <div className="card">
          <h2>{editando ? 'Editar ciclo' : 'Nuevo ciclo de programa'}</h2>
          <form className="form" onSubmit={guardar}>
            <label className="full">Nombre<input value={form.nombre} required placeholder="Ej.: Ciclo «Guardianes de la Promesa»"
              onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
            <label>Inicio<input type="date" value={form.inicio} required onChange={(e) => setForm({ ...form, inicio: e.target.value })} /></label>
            <label>Fin<input type="date" value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} /></label>
            <div className="row full">
              <button className="btn primary">{editando ? 'Guardar' : 'Crear ciclo'}</button>
              {editando && <button type="button" className="btn ghost" onClick={() => { setEditando(null); setForm({ nombre: '', inicio: hoyISO(), fin: '' }); }}>Cancelar</button>}
            </div>
          </form>
        </div>
        <div className="card">
          <h2>Ciclos</h2>
          {ciclos.map((c) => (
            <div key={c.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
              <div><strong>{c.nombre}</strong><div className="muted">{formatoFecha(c.inicio)} – {c.fin ? formatoFecha(c.fin) : 'en curso'}</div></div>
              <div className="row">
                <button className="btn small" onClick={() => { setEditando(c.id); setForm({ nombre: c.nombre, inicio: c.inicio, fin: c.fin || '' }); }}>Editar</button>
                <button className="btn small danger" onClick={() => borrar(c)}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
