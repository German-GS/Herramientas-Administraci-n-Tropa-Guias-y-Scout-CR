import { useEffect, useState } from 'react';
import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useGrupo } from '../lib/grupo.jsx';
import { useConfig } from '../lib/useConfig';
import { alertasDe, CARGOS, ITEMS_INSPECCION, edad, ETAPAS, formatoFecha, hoyISO, siguienteEtapa } from '../lib/etapas';

const VACIO = {
  nombre: '', apellidos: '', fechaNacimiento: '', patrullaId: '', cargo: 'Integrante',
  etapa: ETAPAS[0], fechaIngreso: hoyISO(), fechaInicioEtapa: hoyISO(),
  encargado: { nombre: '', telefono: '', parentesco: '' },
  medico: { tipoSangre: '', alergias: '', sinAlergias: false, condiciones: '', medicamentos: '', seguro: '' },
  notas: '', activo: true, promesado: false, fechaPromesa: '', fechaSalida: '', motivoSalida: '', historialEtapas: [],
};

export default function Protagonistas({ abrirExpediente, limpiarExpediente }) {
  const { docs: protagonistas } = useCollection('protagonistas', 'nombre');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const [config] = useConfig();
  const [sel, setSel] = useState(null); // id | 'nuevo' | null
  const [filtro, setFiltro] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);

  useEffect(() => { if (abrirExpediente) setSel(abrirExpediente); }, [abrirExpediente]);

  const cerrar = () => { setSel(null); limpiarExpediente?.(); };
  const nombrePatrulla = (id) => patrullas.find((p) => p.id === id)?.nombre || '—';

  if (sel) {
    const actual = sel === 'nuevo' ? null : protagonistas.find((p) => p.id === sel);
    if (sel !== 'nuevo' && !actual) return <div className="card">Cargando expediente…</div>;
    return <Expediente key={sel} p={actual} patrullas={patrullas} config={config} onCerrar={cerrar} />;
  }

  const lista = protagonistas
    .filter((p) => verInactivos || p.activo !== false)
    .filter((p) => `${p.nombre} ${p.apellidos}`.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div className="card">
      <div className="row between">
        <h2>Expedientes</h2>
        <button className="btn primary" onClick={() => setSel('nuevo')}>+ Nuevo protagonista</button>
      </div>
      <div className="row" style={{ margin: '8px 0 12px' }}>
        <input placeholder="Buscar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        <label className="muted"><input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Ver inactivos</label>
      </div>
      {lista.length === 0 ? <p className="empty">No hay protagonistas registrados.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Edad</th><th>Patrulla</th><th>Cargo</th><th>Etapa</th><th>Desde</th><th>Avisos</th></tr></thead>
            <tbody>
              {lista.map((p) => {
                const al = alertasDe(p, config).filter((a) => a.tipo !== 'cumple');
                return (
                  <tr key={p.id} className="clickable" onClick={() => setSel(p.id)} style={p.activo === false ? { opacity: 0.5 } : null}>
                    <td><strong>{p.nombre} {p.apellidos}</strong></td>
                    <td>{edad(p.fechaNacimiento) ?? '—'}</td>
                    <td>{nombrePatrulla(p.patrullaId)}</td>
                    <td>{p.cargo}{p.promesado ? <span className="badge" style={{ marginLeft: 6 }}>Promesado</span> : null}</td>
                    <td><span className="badge">{p.etapa}</span></td>
                    <td>{formatoFecha(p.fechaInicioEtapa)}</td>
                    <td>{al.map((a, i) => <span key={i} className={`badge ${a.nivel}`} title={a.texto}>{a.tipo}</span>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Expediente({ p, patrullas, config, onCerrar }) {
  const { col, ref } = useGrupo();
  const { docs: reuniones } = useCollection('reuniones', 'fecha');
  const [f, setF] = useState(() => ({
    ...VACIO, ...(p || {}),
    encargado: { ...VACIO.encargado, ...(p?.encargado || {}) },
    medico: { ...VACIO.medico, ...(p?.medico || {}) },
  }));
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setSub = (g, k, v) => setF((x) => ({ ...x, [g]: { ...x[g], [k]: v } }));

  const guardar = async (e) => {
    e?.preventDefault();
    setGuardando(true);
    const { id, ...data } = f;
    try {
      if (p) await updateDoc(ref('protagonistas', p.id), data);
      else await addDoc(col('protagonistas'), data);
      onCerrar();
    } finally { setGuardando(false); }
  };

  const avanzarEtapa = async () => {
    const sig = siguienteEtapa(f.etapa);
    if (!sig || !p) return;
    const fecha = prompt(`Fecha del cambio de etapa ${f.etapa} → ${sig} (AAAA-MM-DD):`, hoyISO());
    if (!fecha) return;
    const historial = [...(f.historialEtapas || []), { etapa: f.etapa, desde: f.fechaInicioEtapa, hasta: fecha }];
    const cambios = { etapa: sig, fechaInicioEtapa: fecha, historialEtapas: historial };
    await updateDoc(ref('protagonistas', p.id), cambios);
    setF((x) => ({ ...x, ...cambios }));
  };

  const borrar = async () => {
    if (confirm(`¿Borrar definitivamente el expediente de ${f.nombre}? Si salió del grupo, mejor marcalo como inactivo.`)) {
      await deleteDoc(ref('protagonistas', p.id));
      onCerrar();
    }
  };

  const alertas = p ? alertasDe(f, config) : [];
  const e = edad(f.fechaNacimiento);

  return (
    <form className="card" onSubmit={guardar}>
      <div className="row between">
        <h2>{p ? `${f.nombre} ${f.apellidos}` : 'Nuevo protagonista'}{e !== null ? <span className="muted"> · {e} años</span> : null}</h2>
        <button type="button" className="btn ghost" onClick={onCerrar}>← Volver</button>
      </div>

      {alertas.map((a, i) => <div key={i} className={`alert ${a.nivel}`}>{a.texto}</div>)}

      <fieldset>
        <legend>Datos personales</legend>
        <div className="form">
          <label>Nombre<input value={f.nombre} onChange={(x) => set('nombre', x.target.value)} required /></label>
          <label>Apellidos<input value={f.apellidos} onChange={(x) => set('apellidos', x.target.value)} /></label>
          <label>Fecha de nacimiento<input type="date" value={f.fechaNacimiento} onChange={(x) => set('fechaNacimiento', x.target.value)} /></label>
          <label>Fecha de ingreso<input type="date" value={f.fechaIngreso} onChange={(x) => set('fechaIngreso', x.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Tropa</legend>
        <div className="form">
          <label>Patrulla
            <select value={f.patrullaId} onChange={(x) => set('patrullaId', x.target.value)}>
              <option value="">— Sin patrulla —</option>
              {patrullas.map((pa) => <option key={pa.id} value={pa.id}>{pa.nombre}</option>)}
            </select>
          </label>
          <label>Cargo
            <select value={f.cargo} onChange={(x) => set('cargo', x.target.value)}>
              {CARGOS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Etapa
            <select value={f.etapa} onChange={(x) => set('etapa', x.target.value)}>
              {ETAPAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Inicio de la etapa actual<input type="date" value={f.fechaInicioEtapa} onChange={(x) => set('fechaInicioEtapa', x.target.value)} /></label>
          <label className="full"><span><input type="checkbox" checked={f.activo !== false} onChange={(x) => setF((y) => ({ ...y, activo: x.target.checked, fechaSalida: !x.target.checked && !y.fechaSalida ? hoyISO() : y.fechaSalida }))} /> Activo en la Tropa</span></label>
          {f.activo === false && (
            <>
              <label>Fecha de salida<input type="date" value={f.fechaSalida || ''} onChange={(x) => set('fechaSalida', x.target.value)} /></label>
              <label>Motivo de la salida (para el resumen de membresía del ciclo)<input value={f.motivoSalida || ''} onChange={(x) => set('motivoSalida', x.target.value)} /></label>
            </>
          )}
          <label className="full"><span><input type="checkbox" checked={!!f.promesado} onChange={(x) => set('promesado', x.target.checked)} /> Ya hizo su Promesa (promesado) — habilita «uniforme completo» en la inspección</span></label>
          {f.promesado && <label>Fecha de la Promesa<input type="date" value={f.fechaPromesa || ''} onChange={(x) => set('fechaPromesa', x.target.value)} /></label>}
        </div>
        {p && siguienteEtapa(f.etapa) && (
          <button type="button" className="btn small" onClick={avanzarEtapa}>Registrar paso a {siguienteEtapa(f.etapa)}</button>
        )}
        {(f.historialEtapas || []).length > 0 && (
          <div className="muted" style={{ marginTop: 8 }}>
            Historial: {f.historialEtapas.map((h) => `${h.etapa} (${formatoFecha(h.desde)} – ${formatoFecha(h.hasta)})`).join(' · ')}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Persona encargada</legend>
        <div className="form">
          <label>Nombre<input value={f.encargado.nombre} onChange={(x) => setSub('encargado', 'nombre', x.target.value)} /></label>
          <label>Teléfono<input type="tel" value={f.encargado.telefono} onChange={(x) => setSub('encargado', 'telefono', x.target.value)} /></label>
          <label>Parentesco<input value={f.encargado.parentesco} onChange={(x) => setSub('encargado', 'parentesco', x.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Ficha médica</legend>
        <div className="form">
          <label>Tipo de sangre
            <select value={f.medico.tipoSangre} onChange={(x) => setSub('medico', 'tipoSangre', x.target.value)}>
              <option value="">—</option>
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Desconocido'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Seguro / póliza<input value={f.medico.seguro} onChange={(x) => setSub('medico', 'seguro', x.target.value)} /></label>
          <label className="full">Alergias
            <input value={f.medico.alergias} disabled={f.medico.sinAlergias} onChange={(x) => setSub('medico', 'alergias', x.target.value)} />
            <span className="muted"><input type="checkbox" checked={f.medico.sinAlergias} onChange={(x) => setSub('medico', 'sinAlergias', x.target.checked)} /> No tiene alergias conocidas</span>
          </label>
          <label className="full">Condiciones de salud<textarea rows={2} value={f.medico.condiciones} onChange={(x) => setSub('medico', 'condiciones', x.target.value)} /></label>
          <label className="full">Medicamentos<textarea rows={2} value={f.medico.medicamentos} onChange={(x) => setSub('medico', 'medicamentos', x.target.value)} /></label>
        </div>
      </fieldset>

      {p && (() => {
        const tomadas = reuniones.filter((r) => r.fecha >= (f.fechaIngreso || '') && r.asistencia && Object.keys(r.asistencia).length > 0);
        if (tomadas.length === 0) return null;
        const asistidas = tomadas.filter((r) => r.asistencia[p.id]);
        const posibles = ITEMS_INSPECCION.filter((i) => !i.soloPromesado || f.promesado).length;
        const traidos = asistidas.reduce((t, r) => t + ITEMS_INSPECCION.filter((i) => r.inspeccion?.[p.id]?.[i.key]).length, 0);
        return (
          <fieldset>
            <legend>Participación</legend>
            <p>Asistió a <strong>{asistidas.length}</strong> de {tomadas.length} reuniones ({Math.round((asistidas.length / tomadas.length) * 100)} %).</p>
            {asistidas.length > 0 && <p>Inspección: promedio de <strong>{(traidos / asistidas.length).toFixed(1)}</strong> de {posibles} elementos.</p>}
          </fieldset>
        );
      })()}

      <fieldset>
        <legend>Notas de seguimiento</legend>
        <textarea rows={4} style={{ width: '100%' }} value={f.notas} onChange={(x) => set('notas', x.target.value)} />
      </fieldset>

      <div className="row between">
        <button className="btn primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar expediente'}</button>
        {p && <button type="button" className="btn danger" onClick={borrar}>Borrar</button>}
      </div>
    </form>
  );
}
