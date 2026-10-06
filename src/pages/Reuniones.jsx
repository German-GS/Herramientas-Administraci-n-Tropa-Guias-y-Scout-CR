import { useEffect, useState } from 'react';
import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useConfig } from '../lib/useConfig';
import { useGrupo } from '../lib/grupo.jsx';
import { CATEGORIAS, etiquetaCiclo, formatoFecha, hoyISO, totalReunionPatrulla } from '../lib/etapas';
import TablaEditable from '../components/TablaEditable.jsx';
import ProgramaReunion from '../components/ProgramaReunion.jsx';

function cicloDeFecha(ciclos, fecha) {
  return ciclos.find((c) => c.inicio <= fecha && (!c.fin || c.fin >= fecha))?.id || '';
}

export default function Reuniones() {
  const { docs: reuniones } = useCollection('reuniones', 'fecha');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: ciclos } = useCollection('ciclos', 'inicio');
  const [sel, setSel] = useState(null);
  const [copia, setCopia] = useState(null);

  if (sel) {
    const r = sel === 'nueva' ? null : reuniones.find((x) => x.id === sel);
    return <EditorReunion key={sel + (copia ? 'c' : '')} r={r} base={copia} patrullas={patrullas} ciclos={ciclos}
      onCerrar={() => { setSel(null); setCopia(null); }} />;
  }

  const duplicar = (r) => {
    const { id, puntajes, fecha, ...resto } = r;
    setCopia({ ...resto, fecha: hoyISO() });
    setSel('nueva');
  };

  const lista = [...reuniones].reverse();
  return (
    <div className="card">
      <div className="row between">
        <h2>Reuniones</h2>
        <button className="btn primary" onClick={() => { setCopia(null); setSel('nueva'); }}>+ Nuevo programa de reunión</button>
      </div>
      {lista.length === 0 ? <p className="empty">Todavía no hay reuniones. Creá el programa de la próxima.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Fondo motivador / objetivo</th><th>Ciclo</th>{patrullas.map((p) => <th key={p.id}>{p.nombre}</th>)}<th /></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setSel(r.id)}>
                  <td>{formatoFecha(r.fecha)}</td>
                  <td>{r.fondo || r.tema || r.objetivo || '—'}</td>
                  <td>{etiquetaCiclo(ciclos.find((c) => c.id === r.cicloId)) || <span className="muted">sin ciclo</span>}</td>
                  {patrullas.map((p) => <td key={p.id}><strong>{totalReunionPatrulla(r, p.id)}</strong></td>)}
                  <td><button className="btn small quiet" onClick={(e) => { e.stopPropagation(); duplicar(r); }}>Duplicar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const SECCIONES = [
  ['programa', 'Programa'],
  ['detalle', 'Ayuda al programa'],
  ['insumos', 'Insumos y anexos'],
  ['puntajes', 'Puntajes'],
];

function EditorReunion({ r, base, patrullas, ciclos, onCerrar }) {
  const { col, ref, miembro } = useGrupo();
  const [config] = useConfig();
  const { docs: protagonistas } = useCollection('protagonistas');
  const max = Number(config.puntajeMaxCategoria) || 10;
  const [seccion, setSeccion] = useState('programa');
  const [vista, setVista] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [f, setF] = useState(() => {
    const fecha = r?.fecha || base?.fecha || hoyISO();
    const activos = protagonistas.filter((p) => p.activo !== false).length;
    const { id, ...datos } = r || base || {};
    return {
      lugar: '', horaInicio: '', horaFin: '', encargado: miembro?.nombre || '',
      participantes: activos ? `${activos} protagonistas — ${patrullas.length} patrullas` : '',
      objetivo: '', fondo: datos.tema || '', actividades: [], impresos: '', otrosMateriales: '', anexos: [], puntajes: {},
      ...datos, fecha,
      cicloId: datos.cicloId ?? cicloDeFecha(ciclos, fecha),
    };
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    const activos = protagonistas.filter((p) => p.activo !== false).length;
    if (!r && activos) setF((x) => (x.participantes ? x : { ...x, participantes: `${activos} protagonistas — ${patrullas.length} patrullas` }));
  }, [r, protagonistas, patrullas.length]);

  const setPunto = (pid, cat, v) => {
    const n = v === '' ? '' : Math.max(0, Math.min(max, Number(v)));
    setF((x) => ({ ...x, puntajes: { ...x.puntajes, [pid]: { ...(x.puntajes[pid] || {}), [cat]: n } } }));
  };
  const setAct = (i, k, v) => set('actividades', f.actividades.map((a, j) => (j === i ? { ...a, [k]: v } : a)));

  const guardar = async (e) => {
    e?.preventDefault();
    setGuardando(true);
    const limpio = {};
    for (const p of patrullas) {
      limpio[p.id] = {};
      for (const c of CATEGORIAS) limpio[p.id][c.key] = Number(f.puntajes[p.id]?.[c.key]) || 0;
    }
    const data = { ...f, puntajes: limpio };
    try {
      if (r) await updateDoc(ref('reuniones', r.id), data);
      else await addDoc(col('reuniones'), data);
      onCerrar();
    } finally { setGuardando(false); }
  };

  const borrar = async () => {
    if (confirm('¿Borrar esta reunión y sus puntajes?')) { await deleteDoc(ref('reuniones', r.id)); onCerrar(); }
  };

  if (vista) {
    return (
      <div className="card">
        <div className="row between no-print">
          <button className="btn" onClick={() => setVista(false)}>← Seguir editando</button>
          <button className="btn primary" onClick={() => window.print()}>Imprimir / guardar PDF</button>
        </div>
        <ProgramaReunion r={f} />
      </div>
    );
  }

  return (
    <form className="card" onSubmit={guardar}>
      <div className="row between">
        <h2>{r ? `Reunión del ${formatoFecha(r.fecha)}` : 'Nuevo programa de reunión'}</h2>
        <button type="button" className="btn" onClick={onCerrar}>← Volver</button>
      </div>

      <div className="seg multi">
        {SECCIONES.map(([k, l]) => <button key={k} type="button" className={seccion === k ? 'on' : ''} onClick={() => setSeccion(k)}>{l}</button>)}
      </div>

      {seccion === 'programa' && (
        <>
          <div className="form">
            <label>Fecha<input type="date" value={f.fecha} required
              onChange={(e) => setF({ ...f, fecha: e.target.value, cicloId: r ? f.cicloId : cicloDeFecha(ciclos, e.target.value) })} /></label>
            <label>Hora de inicio<input type="time" value={f.horaInicio} onChange={(e) => set('horaInicio', e.target.value)} /></label>
            <label>Hora de fin<input type="time" value={f.horaFin} onChange={(e) => set('horaFin', e.target.value)} /></label>
            <label>Lugar<input value={f.lugar} onChange={(e) => set('lugar', e.target.value)} placeholder="Ej.: Play de Cinco Esquinas" /></label>
            <label>Encargado<input value={f.encargado} onChange={(e) => set('encargado', e.target.value)} /></label>
            <label>Participantes<input value={f.participantes} onChange={(e) => set('participantes', e.target.value)} /></label>
            <label>Ciclo
              <select value={f.cicloId} onChange={(e) => set('cicloId', e.target.value)}>
                <option value="">— Sin ciclo —</option>
                {ciclos.map((c) => <option key={c.id} value={c.id}>{etiquetaCiclo(c)}</option>)}
              </select>
            </label>
            <label className="full">Objetivo<textarea rows={3} value={f.objetivo} onChange={(e) => set('objetivo', e.target.value)} /></label>
            <label className="full">Fondo motivador<textarea rows={3} value={f.fondo} onChange={(e) => set('fondo', e.target.value)} /></label>
          </div>
          <h3 style={{ marginTop: 14 }}>Cronograma</h3>
          <TablaEditable
            columnas={[
              { key: 'hora', label: 'Hora', tipo: 'time', min: 110 },
              { key: 'actividad', label: 'Actividad', min: 240 },
              { key: 'materiales', label: 'Materiales', min: 180 },
              { key: 'encargado', label: 'Encargado', min: 130 },
            ]}
            filas={f.actividades} onChange={(v) => set('actividades', v)}
            nueva={{ hora: '', actividad: '', materiales: '', encargado: f.encargado, montaje: '', dinamica: '', variante: '', reto: '' }}
            agregar="Agregar actividad" />
        </>
      )}

      {seccion === 'detalle' && (
        <>
          <p className="muted">Explicación de cada actividad para quien la dirige. Se agrega a las actividades del cronograma.</p>
          {f.actividades.length === 0 && <p className="empty">Primero agregá actividades en el cronograma.</p>}
          {f.actividades.map((a, i) => (
            <fieldset key={i} style={{ marginBottom: 10 }}>
              <legend>{a.hora ? `${a.hora} · ` : ''}{a.actividad || `Actividad ${i + 1}`}</legend>
              <div className="form">
                <label className="full">Montaje<textarea rows={2} value={a.montaje || ''} onChange={(e) => setAct(i, 'montaje', e.target.value)} /></label>
                <label className="full">La dinámica<textarea rows={4} value={a.dinamica || ''} onChange={(e) => setAct(i, 'dinamica', e.target.value)} /></label>
                <label className="full">Variante<textarea rows={2} value={a.variante || ''} onChange={(e) => setAct(i, 'variante', e.target.value)} /></label>
                <label className="full">El reto<textarea rows={2} value={a.reto || ''} onChange={(e) => setAct(i, 'reto', e.target.value)} /></label>
              </div>
            </fieldset>
          ))}
        </>
      )}

      {seccion === 'insumos' && (
        <>
          <div className="form">
            <label className="full">Lista de impresos<textarea rows={3} value={f.impresos} onChange={(e) => set('impresos', e.target.value)} /></label>
            <label className="full">Otros materiales<textarea rows={3} value={f.otrosMateriales} onChange={(e) => set('otrosMateriales', e.target.value)} /></label>
          </div>
          <h3 style={{ marginTop: 14 }}>Anexos</h3>
          <TablaEditable
            columnas={[{ key: 'titulo', label: 'Título', min: 200 }, { key: 'texto', label: 'Contenido', tipo: 'textarea', min: 320 }]}
            filas={f.anexos} onChange={(v) => set('anexos', v)} nueva={{ titulo: `Anexo ${String.fromCharCode(65 + f.anexos.length)} — `, texto: '' }} agregar="Agregar anexo" />
        </>
      )}

      {seccion === 'puntajes' && (
        patrullas.length === 0 ? <p className="empty">Primero creá las patrullas.</p> : (
          <div className="table-wrap">
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
        )
      )}

      <div className="row between" style={{ marginTop: 14 }}>
        <div className="row">
          <button className="btn primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar reunión'}</button>
          <button type="button" className="btn" onClick={() => setVista(true)}>Ver / imprimir programa</button>
        </div>
        {r && <button type="button" className="btn danger" onClick={borrar}>Borrar</button>}
      </div>
    </form>
  );
}
