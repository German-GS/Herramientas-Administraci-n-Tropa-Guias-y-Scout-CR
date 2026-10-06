import { useMemo, useState } from 'react';
import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useGrupo } from '../lib/grupo.jsx';
import { AREAS, CATEGORIAS, edad, ETAPAS, etiquetaCiclo, EVALUACION, formatoFecha, hoyISO } from '../lib/etapas';
import TablaEditable from '../components/TablaEditable.jsx';
import CicloDocumento, { filasProgresion, totalesAreas } from '../components/CicloDocumento.jsx';

export default function Ciclos() {
  const { col, ref } = useGrupo();
  const { docs: ciclos } = useCollection('ciclos', 'inicio');
  const { docs: reuniones } = useCollection('reuniones', 'fecha');
  const { docs: extras } = useCollection('puntosExtra', 'fecha');
  const [sel, setSel] = useState(null);

  if (sel) {
    const c = sel === 'nuevo' ? null : ciclos.find((x) => x.id === sel);
    return <EditorCiclo key={sel} c={c} ciclos={ciclos} reuniones={reuniones} extras={extras} onCerrar={() => setSel(null)} />;
  }

  const borrar = async (c) => {
    const usados = reuniones.some((r) => r.cicloId === c.id) || extras.some((x) => x.cicloId === c.id);
    if (usados) return alert('Este ciclo tiene reuniones o puntos asociados; no se puede borrar.');
    if (confirm(`¿Borrar ${etiquetaCiclo(c)}?`)) await deleteDoc(ref('ciclos', c.id));
  };
  const hoy = hoyISO();

  return (
    <div className="card">
      <div className="row between">
        <h2>Ciclos de programa</h2>
        <button className="btn primary" onClick={() => setSel('nuevo')}>+ Nuevo ciclo de programa</button>
      </div>
      {ciclos.length === 0 && <p className="empty">Creá el ciclo de programa vigente para empezar a sumar puntajes.</p>}
      {[...ciclos].reverse().map((c) => {
        const vigente = c.inicio <= hoy && (!c.fin || c.fin >= hoy);
        return (
          <div key={c.id} className="item">
            <div>
              <strong>{etiquetaCiclo(c)}</strong> {vigente && <span className="badge">Vigente</span>}
              <div className="muted">{formatoFecha(c.inicio)} – {c.fin ? formatoFecha(c.fin) : 'en curso'} · {reuniones.filter((r) => r.cicloId === c.id).length} reuniones</div>
            </div>
            <div className="row">
              <button className="btn small" onClick={() => setSel(c.id)}>Abrir</button>
              <button className="btn small danger" onClick={() => borrar(c)}>Borrar</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SECCIONES = [
  ['datos', 'Datos'],
  ['evaluacion', 'Evaluación'],
  ['progresion', 'Progresión personal'],
  ['propuesta', 'Propuesta'],
  ['junta', 'Membresía y Junta'],
  ['resultados', 'Puntaje final'],
];

function EditorCiclo({ c, ciclos, reuniones, extras, onCerrar }) {
  const { col, ref, grupo, miembro } = useGrupo();
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: protagonistas } = useCollection('protagonistas');
  const [seccion, setSeccion] = useState('datos');
  const [vista, setVista] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [f, setF] = useState(() => {
    const { id, ...d } = c || {};
    return {
      numero: String(ciclos.length + 1), anio: new Date().getFullYear(), nombre: '', inicio: hoyISO(), fin: '', fecha: hoyISO(),
      nombreSeccion: `Tropa ${grupo?.numero || ''}`.trim(), objetivoGeneral: '', objetivosEspecificos: '',
      traspasos: [], equipos: [], cronograma: [], progresion: {}, solicitudes: '', coordinadores: miembro?.nombre || '',
      ...d,
      evaluacion: { actividades: [], logro: '', logroDetalle: '', logroEspecificos: '', gusto: '', noGusto: '', ...(d.evaluacion || {}) },
      membresia: { nuevos: '', partidas: '', desercion: '', ...(d.membresia || {}) },
    };
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setEv = (k, v) => setF((x) => ({ ...x, evaluacion: { ...x.evaluacion, [k]: v } }));
  const setMem = (k, v) => setF((x) => ({ ...x, membresia: { ...x.membresia, [k]: v } }));
  const setProg = (pid, cambios) => setF((x) => ({ ...x, progresion: { ...x.progresion, [pid]: { ...(x.progresion[pid] || {}), ...cambios } } }));
  const setArea = (pid, area, v) => setProg(pid, { areas: { ...(f.progresion[pid]?.areas || {}), [area]: v } });

  const anterior = useMemo(() => {
    const previos = ciclos.filter((x) => x.id !== c?.id && x.inicio < f.inicio).sort((a, b) => a.inicio.localeCompare(b.inicio));
    return previos[previos.length - 1];
  }, [ciclos, c, f.inicio]);

  const traerCronogramaAnterior = () => {
    if (!anterior?.cronograma?.length) return alert('El ciclo anterior no tiene cronograma guardado.');
    setEv('actividades', anterior.cronograma.map((a) => ({ ...a, eval: '', obs: '' })));
  };
  const cargarPatrullas = () => set('equipos', patrullas.map((p) => ({ patrullaId: p.id, nombre: p.nombre, general: '', especificos: '' })));

  const guardar = async (e) => {
    e?.preventDefault();
    setGuardando(true);
    try {
      if (c) await updateDoc(ref('ciclos', c.id), f);
      else await addDoc(col('ciclos'), f);
      onCerrar();
    } finally { setGuardando(false); }
  };

  const filas = filasProgresion(protagonistas);
  const tot = totalesAreas(filas, f.progresion);

  const tabla = useMemo(() => {
    if (!c) return [];
    const rs = reuniones.filter((r) => r.cicloId === c.id);
    const es = extras.filter((e) => e.cicloId === c.id);
    return patrullas.map((p) => {
      const porCat = Object.fromEntries(CATEGORIAS.map((k) => [k.key, rs.reduce((s, r) => s + (Number(r.puntajes?.[p.id]?.[k.key]) || 0), 0)]));
      const extra = es.filter((e) => e.patrullaId === p.id).reduce((s, e) => s + (Number(e.puntos) || 0), 0);
      return { ...p, porCat, extra, total: Object.values(porCat).reduce((a, b) => a + b, 0) + extra };
    }).sort((a, b) => b.total - a.total);
  }, [c, reuniones, extras, patrullas]);

  if (vista) {
    return (
      <div className="card">
        <div className="row between no-print">
          <button className="btn" onClick={() => setVista(false)}>← Seguir editando</button>
          <button className="btn primary" onClick={() => window.print()}>Imprimir / guardar PDF</button>
        </div>
        <CicloDocumento c={f} protagonistas={protagonistas} patrullas={patrullas} grupo={grupo} />
      </div>
    );
  }

  return (
    <form className="card" onSubmit={guardar}>
      <div className="row between">
        <h2>{c ? etiquetaCiclo(c) : 'Nuevo ciclo de programa'}</h2>
        <button type="button" className="btn" onClick={onCerrar}>← Volver</button>
      </div>
      <div className="seg multi">
        {SECCIONES.filter(([k]) => k !== 'resultados' || c).map(([k, l]) => (
          <button key={k} type="button" className={seccion === k ? 'on' : ''} onClick={() => setSeccion(k)}>{l}</button>
        ))}
      </div>

      {seccion === 'datos' && (
        <div className="form">
          <label>Sección<input value="Tropa" disabled /></label>
          <label>Nombre de la sección<input value={f.nombreSeccion} onChange={(e) => set('nombreSeccion', e.target.value)} /></label>
          <label>Ciclo número<input value={f.numero} onChange={(e) => set('numero', e.target.value)} required /></label>
          <label>Año<input type="number" value={f.anio} onChange={(e) => set('anio', Number(e.target.value))} /></label>
          <label>Fecha del documento<input type="date" value={f.fecha} onChange={(e) => set('fecha', e.target.value)} /></label>
          <label>Rige desde<input type="date" value={f.inicio} required onChange={(e) => set('inicio', e.target.value)} /></label>
          <label>Rige hasta<input type="date" value={f.fin} onChange={(e) => set('fin', e.target.value)} /></label>
          <label className="full">Fondo motivador (tema)<input value={f.nombre} placeholder="Ej.: Guardianes de la Promesa" onChange={(e) => set('nombre', e.target.value)} /></label>
        </div>
      )}

      {seccion === 'evaluacion' && (
        <>
          <h3>Evaluación de actividades del ciclo anterior</h3>
          <div className="row" style={{ marginBottom: 8 }}>
            <button type="button" className="btn small" onClick={traerCronogramaAnterior} disabled={!anterior}>
              Traer cronograma {anterior ? `de «${etiquetaCiclo(anterior)}»` : 'del ciclo anterior'}
            </button>
          </div>
          <TablaEditable
            columnas={[
              { key: 'fecha', label: 'Fecha', tipo: 'date', min: 140 }, { key: 'actividad', label: 'Actividad', min: 200 },
              { key: 'objetivo', label: 'Objetivo', min: 180 }, { key: 'responsable', label: 'Responsable', min: 130 },
              { key: 'eval', label: 'Evaluación', tipo: 'select', opciones: EVALUACION, min: 170 }, { key: 'obs', label: 'Observaciones / aspectos a mejorar', min: 220 },
            ]}
            filas={f.evaluacion.actividades} onChange={(v) => setEv('actividades', v)} agregar="Agregar actividad" />
          <div className="form" style={{ marginTop: 12 }}>
            <label>Logro del objetivo propuesto en el ciclo anterior
              <select value={f.evaluacion.logro} onChange={(e) => setEv('logro', e.target.value)}>
                <option value="">—</option><option value="si">Sí</option><option value="parcial">Parcial</option><option value="no">No</option>
              </select>
            </label>
            <label>Detalle<input value={f.evaluacion.logroDetalle} onChange={(e) => setEv('logroDetalle', e.target.value)} /></label>
            <label className="full">Logro de los objetivos específicos en el ciclo anterior<textarea rows={3} value={f.evaluacion.logroEspecificos} onChange={(e) => setEv('logroEspecificos', e.target.value)} /></label>
          </div>
          <h3 style={{ marginTop: 14 }}>Diagnóstico</h3>
          <div className="form">
            <label className="full">¿Cuál actividad LES GUSTÓ y por qué?<textarea rows={3} value={f.evaluacion.gusto} onChange={(e) => setEv('gusto', e.target.value)} /></label>
            <label className="full">¿Cuál actividad NO LES GUSTÓ y por qué?<textarea rows={3} value={f.evaluacion.noGusto} onChange={(e) => setEv('noGusto', e.target.value)} /></label>
          </div>
        </>
      )}

      {seccion === 'progresion' && (
        <>
          <p className="muted">Marcá las áreas a trabajar con cada protagonista. Los datos personales salen de los expedientes activos.</p>
          {filas.length === 0 ? <p className="empty">No hay protagonistas activos.</p> : (
            <div className="table-wrap">
              <table className="table editable prog">
                <thead>
                  <tr><th>#</th><th>Nombre</th><th>Edad</th><th>Etapa actual</th><th>Etapa en ciclo</th>
                    {AREAS.map((a) => <th key={a.key} className="c">{a.label}</th>)}<th>Actividades propuestas</th><th>Otras</th></tr>
                </thead>
                <tbody>
                  {filas.map((p, i) => {
                    const pr = f.progresion[p.id] || {};
                    return (
                      <tr key={p.id}>
                        <td data-label="#">{i + 1}</td>
                        <td data-label="Nombre"><strong>{p.nombre} {p.apellidos}</strong></td>
                        <td data-label="Edad">{edad(p.fechaNacimiento) ?? '—'}</td>
                        <td data-label="Etapa actual">{p.etapa}</td>
                        <td data-label="Etapa en ciclo">
                          <select value={pr.etapaCiclo || p.etapa} onChange={(e) => setProg(p.id, { etapaCiclo: e.target.value })}>
                            {ETAPAS.map((x) => <option key={x}>{x}</option>)}
                          </select>
                        </td>
                        {AREAS.map((a) => (
                          <td key={a.key} className="c" data-label={a.label}>
                            <input type="checkbox" checked={!!pr.areas?.[a.key]} onChange={(e) => setArea(p.id, a.key, e.target.checked)} aria-label={`${a.label} de ${p.nombre}`} />
                          </td>
                        ))}
                        <td data-label="Actividades propuestas"><input value={pr.actividades || ''} onChange={(e) => setProg(p.id, { actividades: e.target.value })} /></td>
                        <td data-label="Otras"><input value={pr.otras || ''} onChange={(e) => setProg(p.id, { otras: e.target.value })} /></td>
                      </tr>
                    );
                  })}
                  <tr className="totales"><td colSpan={5}><strong>Total</strong></td>{AREAS.map((a) => <td key={a.key} className="c"><strong>{tot[a.key]}</strong></td>)}<td colSpan={2} /></tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="muted">Las áreas de mayor puntaje serán el énfasis del ciclo.</p>
          <h3 style={{ marginTop: 14 }}>Traspasos o ceremonias para el siguiente ciclo</h3>
          <TablaEditable
            columnas={[{ key: 'nombre', label: 'Nombre', min: 160 }, { key: 'actividad', label: 'Actividad (traspaso o ceremonia)', min: 240 }, { key: 'observaciones', label: 'Observaciones', min: 200 }]}
            filas={f.traspasos} onChange={(v) => set('traspasos', v)} agregar="Agregar traspaso o ceremonia" />
        </>
      )}

      {seccion === 'propuesta' && (
        <>
          <h3>Objetivos de equipo (patrullas)</h3>
          {f.equipos.length === 0 && patrullas.length > 0 && (
            <button type="button" className="btn small" onClick={cargarPatrullas} style={{ marginBottom: 8 }}>Cargar mis patrullas</button>
          )}
          <TablaEditable
            columnas={[{ key: 'nombre', label: 'Equipo', min: 140 }, { key: 'general', label: 'Objetivo general', tipo: 'textarea', min: 240 }, { key: 'especificos', label: 'Objetivos específicos', tipo: 'textarea', min: 280 }]}
            filas={f.equipos} onChange={(v) => set('equipos', v)} agregar="Agregar equipo" />
          <div className="form" style={{ marginTop: 12 }}>
            <label className="full">Objetivo general<textarea rows={3} value={f.objetivoGeneral} onChange={(e) => set('objetivoGeneral', e.target.value)} /></label>
            <label className="full">Objetivos específicos<textarea rows={4} value={f.objetivosEspecificos} onChange={(e) => set('objetivosEspecificos', e.target.value)} /></label>
          </div>
          <h3 style={{ marginTop: 14 }}>Cronograma</h3>
          <p className="muted">Recordá contemplar calendario nacional, cumpleaños, ceremonias, traspasos, reunión de padres, aniversarios, entre otros.</p>
          <TablaEditable
            columnas={[{ key: 'fecha', label: 'Fecha', tipo: 'date', min: 140 }, { key: 'actividad', label: 'Actividad', min: 220 }, { key: 'objetivo', label: 'Objetivo', min: 220 }, { key: 'responsable', label: 'Responsable', min: 130 }]}
            filas={f.cronograma} onChange={(v) => set('cronograma', v)} agregar="Agregar actividad" />
          <div className="form" style={{ marginTop: 12 }}>
            <label className="full">Coordinadores de la sección (firma)<input value={f.coordinadores} onChange={(e) => set('coordinadores', e.target.value)} /></label>
          </div>
        </>
      )}

      {seccion === 'junta' && (
        <>
          <h3>Resumen de membresía</h3>
          <div className="form">
            <label># Nuevos ingresos / juveniles<input type="number" min={0} value={f.membresia.nuevos} onChange={(e) => setMem('nuevos', e.target.value)} /></label>
            <label># Partida de miembros<input type="number" min={0} value={f.membresia.partidas} onChange={(e) => setMem('partidas', e.target.value)} /></label>
            <label>Total de miembros activos<input value={filas.length} disabled /></label>
            <label className="full">¿Sabe por qué se dio la deserción? (motivo)<textarea rows={2} value={f.membresia.desercion} onChange={(e) => setMem('desercion', e.target.value)} /></label>
          </div>
          <h3 style={{ marginTop: 14 }}>Solicitudes importantes a la Junta de Grupo</h3>
          <textarea rows={5} style={{ width: '100%' }} value={f.solicitudes} onChange={(e) => set('solicitudes', e.target.value)} />
        </>
      )}

      {seccion === 'resultados' && c && (
        <>
          <p className="muted">{formatoFecha(c.inicio)} – {c.fin ? formatoFecha(c.fin) : 'en curso'} · {reuniones.filter((r) => r.cicloId === c.id).length} reuniones</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Patrulla</th>{CATEGORIAS.map((k) => <th key={k.key}>{k.label}</th>)}<th>Extra</th><th>Total</th></tr></thead>
              <tbody>
                {tabla.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i === 0 && p.total > 0 ? '🏆' : i + 1}</td>
                    <td><span className="dot" style={{ background: p.color }} /> <strong>{p.nombre}</strong></td>
                    {CATEGORIAS.map((k) => <td key={k.key}>{p.porCat[k.key]}</td>)}
                    <td className={p.extra >= 0 ? 'pos-num' : 'neg-num'}>{p.extra > 0 ? '+' : ''}{p.extra}</td>
                    <td><strong>{p.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar ciclo'}</button>
        <button type="button" className="btn" onClick={() => setVista(true)}>Ver / imprimir documento</button>
      </div>
    </form>
  );
}
