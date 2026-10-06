import { useState } from 'react';
import { addDoc, deleteDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useGrupo } from '../lib/grupo.jsx';
import { formatoFecha, hoyISO } from '../lib/etapas';

export default function PuntosExtra() {
  const { col, ref } = useGrupo();
  const { docs: extras } = useCollection('puntosExtra', 'fecha');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: ciclos } = useCollection('ciclos', 'inicio');
  const [f, setF] = useState({ fecha: hoyISO(), patrullaId: '', puntos: 5, motivo: '', cicloId: '' });

  const cicloDe = (fecha) => ciclos.find((c) => c.inicio <= fecha && (!c.fin || c.fin >= fecha))?.id || '';

  const agregar = async (signo) => {
    if (!f.patrullaId || !f.motivo.trim() || !Number(f.puntos)) return alert('Elegí patrulla, puntos y motivo.');
    await addDoc(col('puntosExtra'), {
      fecha: f.fecha,
      cicloId: f.cicloId || cicloDe(f.fecha),
      patrullaId: f.patrullaId,
      puntos: signo * Math.abs(Number(f.puntos)),
      motivo: f.motivo.trim(),
    });
    setF({ ...f, motivo: '' });
  };

  const nombre = (id) => patrullas.find((p) => p.id === id)?.nombre || '—';

  return (
    <div className="grid two">
      <div className="card">
        <h2>Dar o quitar puntos</h2>
        <div className="form">
          <label>Fecha<input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
          <label>Patrulla
            <select value={f.patrullaId} onChange={(e) => setF({ ...f, patrullaId: e.target.value })}>
              <option value="">— Elegir —</option>
              {patrullas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label>Puntos<input type="number" min={1} value={f.puntos} onChange={(e) => setF({ ...f, puntos: e.target.value })} /></label>
          <label>Ciclo
            <select value={f.cicloId} onChange={(e) => setF({ ...f, cicloId: e.target.value })}>
              <option value="">Automático según fecha</option>
              {ciclos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="full">Motivo<input value={f.motivo} placeholder="Ej.: buena acción, campamento limpio, llegó tarde…"
            onChange={(e) => setF({ ...f, motivo: e.target.value })} /></label>
          <div className="row full">
            <button className="btn primary" onClick={() => agregar(1)}>+ Sumar</button>
            <button className="btn danger" onClick={() => agregar(-1)}>− Restar</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Historial</h2>
        {extras.length === 0 && <p className="empty">Sin puntos extra registrados.</p>}
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {[...extras].reverse().map((e) => (
                <tr key={e.id}>
                  <td>{formatoFecha(e.fecha)}</td>
                  <td>{nombre(e.patrullaId)}</td>
                  <td className={e.puntos >= 0 ? 'pos-num' : 'neg-num'}><strong>{e.puntos > 0 ? '+' : ''}{e.puntos}</strong></td>
                  <td>{e.motivo}</td>
                  <td><button className="btn small ghost" onClick={() => confirm('¿Eliminar este registro?') && deleteDoc(ref('puntosExtra', e.id))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
