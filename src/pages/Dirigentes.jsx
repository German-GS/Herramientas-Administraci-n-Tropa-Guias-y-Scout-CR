import { useState } from 'react';
import { deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useGrupo } from '../lib/grupo.jsx';

const ETIQUETA = { activo: 'Activo', pendiente: 'Pendiente', suspendido: 'Suspendido' };

export default function Dirigentes() {
  const { gid, grupo, miembro, ref } = useGrupo();
  const { docs: miembros, error } = useCollection('miembros');
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(gid); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sin portapapeles */ }
  };
  const cambiar = (m, cambios) => updateDoc(ref('miembros', m.id), cambios);
  const quitar = (m) => confirm(`¿Quitar a ${m.nombre || m.email} del grupo?`) && deleteDoc(ref('miembros', m.id));

  const orden = { pendiente: 0, activo: 1, suspendido: 2 };
  const lista = [...miembros].sort((a, b) => (orden[a.estado] - orden[b.estado]) || (a.nombre || '').localeCompare(b.nombre || ''));
  const pendientes = lista.filter((m) => m.estado === 'pendiente').length;

  return (
    <div className="grid two">
      <div className="card">
        <h2>Código del grupo</h2>
        <p className="muted">
          Compartí este código con los dirigentes de tu equipo. Cada uno crea su cuenta, elige «Unirme a un grupo»
          y escribe el código. Vos aprobás cada solicitud.
        </p>
        <div className="codigo">{gid}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn small" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar código'}</button>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Grupo {grupo?.numero} — {grupo?.localidad}. Los dirigentes aprobados ven expedientes y fichas médicas de menores:
          aprobá solo a personas del equipo.
        </p>
      </div>

      <div className="card">
        <h2>Dirigentes {pendientes > 0 && <span className="badge media">{pendientes} por aprobar</span>}</h2>
        {error && <p className="error">No se pudo leer la lista: {error.code}</p>}
        {lista.map((m) => {
          const yo = m.id === miembro.id;
          return (
            <div key={m.id} className="item" style={m.estado === 'suspendido' ? { opacity: 0.6 } : null}>
              <div>
                <strong>{m.nombre || m.email}</strong> {yo && <span className="muted">(vos)</span>}
                <div className="muted">{m.cargo ? `${m.cargo} · ` : ''}{m.email}{m.telefono ? ` · ${m.telefono}` : ''}</div>
                <span className={`badge ${m.estado === 'pendiente' ? 'media' : ''}`}>{m.rol === 'jefe' ? 'Jefe de Grupo' : 'Dirigente'}</span>{' '}
                <span className="badge">{ETIQUETA[m.estado] || m.estado}</span>
              </div>
              {!yo && (
                <div className="row">
                  {m.estado === 'pendiente' && <button className="btn small primary" onClick={() => cambiar(m, { estado: 'activo' })}>Aprobar</button>}
                  {m.estado === 'activo' && <button className="btn small" onClick={() => cambiar(m, { estado: 'suspendido' })}>Suspender</button>}
                  {m.estado === 'suspendido' && <button className="btn small" onClick={() => cambiar(m, { estado: 'activo' })}>Reactivar</button>}
                  {m.estado === 'activo' && (
                    <button className="btn small" onClick={() => cambiar(m, { rol: m.rol === 'jefe' ? 'dirigente' : 'jefe' })}>
                      {m.rol === 'jefe' ? 'Quitar jefatura' : 'Hacer jefe'}
                    </button>
                  )}
                  <button className="btn small danger" onClick={() => quitar(m)}>{m.estado === 'pendiente' ? 'Rechazar' : 'Quitar'}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
