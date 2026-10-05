import { useState } from 'react';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, JEFE_EMAIL } from '../firebase';
import { useCollection } from '../lib/useCollection';

export default function Dirigentes() {
  const { docs: dirigentes, error } = useCollection('usuarios');
  const [f, setF] = useState({ email: '', nombre: '' });

  const agregar = async (e) => {
    e.preventDefault();
    const email = f.email.trim().toLowerCase();
    if (!email) return;
    await setDoc(doc(db, 'usuarios', email), { email, nombre: f.nombre.trim(), activo: true, rol: 'dirigente' });
    setF({ email: '', nombre: '' });
  };

  return (
    <div className="grid two">
      <div className="card">
        <h2>Autorizar dirigente</h2>
        <p className="muted">
          Agregá el correo con el que el dirigente creó su cuenta. Podrá ver y editar los datos de la Tropa
          apenas confirme su correo. Incluye expedientes y fichas médicas de menores.
        </p>
        <form className="form" onSubmit={agregar}>
          <label>Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
          <label>Correo<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <div className="row full"><button className="btn primary">Autorizar</button></div>
        </form>
      </div>

      <div className="card">
        <h2>Dirigentes con acceso</h2>
        {error && <p className="error">No se pudo leer la lista: {error.code}</p>}
        <div className="item">
          <div><strong>Jefe de Grupo</strong><div className="muted">{JEFE_EMAIL}</div></div>
          <span className="badge">Acceso total</span>
        </div>
        {dirigentes.length === 0 && <p className="empty">Aún no hay otros dirigentes autorizados.</p>}
        {dirigentes.map((d) => (
          <div key={d.id} className="item" style={d.activo === false ? { opacity: 0.55 } : null}>
            <div><strong>{d.nombre || d.email}</strong><div className="muted">{d.email}</div></div>
            <div className="row">
              <button className="btn small" onClick={() => updateDoc(doc(db, 'usuarios', d.id), { activo: d.activo === false })}>
                {d.activo === false ? 'Reactivar' : 'Suspender'}
              </button>
              <button className="btn small danger" onClick={() => confirm(`¿Quitar el acceso de ${d.email}?`) && deleteDoc(doc(db, 'usuarios', d.id))}>Quitar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
