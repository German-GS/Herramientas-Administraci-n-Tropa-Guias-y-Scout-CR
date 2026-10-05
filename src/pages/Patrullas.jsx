import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from '../lib/useCollection';

const VACIA = { nombre: '', color: '#1f3864', lema: '' };

export default function Patrullas() {
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: protagonistas } = useCollection('protagonistas');
  const [form, setForm] = useState(VACIA);
  const [editando, setEditando] = useState(null);

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    const data = { nombre: form.nombre.trim(), color: form.color, lema: form.lema.trim() };
    if (editando) await updateDoc(doc(db, 'patrullas', editando), data);
    else await addDoc(collection(db, 'patrullas'), data);
    setForm(VACIA);
    setEditando(null);
  };

  const borrar = async (p) => {
    const n = protagonistas.filter((x) => x.patrullaId === p.id).length;
    if (n > 0) return alert(`La patrulla tiene ${n} protagonista(s). Reasignalos antes de borrarla.`);
    if (confirm(`¿Borrar la patrulla ${p.nombre}?`)) await deleteDoc(doc(db, 'patrullas', p.id));
  };

  return (
    <div className="grid two">
      <div className="card">
        <h2>{editando ? 'Editar patrulla' : 'Nueva patrulla'}</h2>
        <form className="form" onSubmit={guardar}>
          <label>Nombre<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
          <label>Color<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
          <label className="full">Lema / grito<input value={form.lema} onChange={(e) => setForm({ ...form, lema: e.target.value })} /></label>
          <div className="row full">
            <button className="btn primary">{editando ? 'Guardar' : 'Agregar'}</button>
            {editando && <button type="button" className="btn ghost" onClick={() => { setForm(VACIA); setEditando(null); }}>Cancelar</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Patrullas</h2>
        {patrullas.length === 0 && <p className="empty">Aún no hay patrullas.</p>}
        {patrullas.map((p) => {
          const miembros = protagonistas.filter((x) => x.patrullaId === p.id && x.activo !== false);
          return (
            <div key={p.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <div>
                <span className="dot" style={{ background: p.color }} /> <strong>{p.nombre}</strong>
                <div className="muted">{miembros.length} protagonistas{p.lema ? ` · «${p.lema}»` : ''}</div>
                <div className="muted">{miembros.map((m) => `${m.nombre}${m.cargo && m.cargo !== 'Integrante' ? ` (${m.cargo})` : ''}`).join(', ')}</div>
              </div>
              <div className="row">
                <button className="btn small" onClick={() => { setEditando(p.id); setForm({ nombre: p.nombre, color: p.color || '#1f3864', lema: p.lema || '' }); }}>Editar</button>
                <button className="btn small danger" onClick={() => borrar(p)}>Borrar</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
