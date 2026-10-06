import { useEffect, useState } from 'react';
import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useConfig } from '../lib/useConfig';
import { useGrupo } from '../lib/grupo.jsx';
import { CATEGORIAS, CRITERIOS, desglosePatrulla, ESTANDAR, ITEMS_INSPECCION, etiquetaCiclo, formatoFecha, hoyISO, listaPuntosLugar, TIPOS_ACTIVIDAD, totalReunionPatrulla } from '../lib/etapas';

const nuevoId = () => Math.random().toString(36).slice(2, 9);
// Toda reunión lleva inicio, inspección y cierre
const FILAS_BASE = () => [
  { hora: '11:00', actividad: 'Inicio: Rutina inicial', tipo: 'inicio', materiales: '', encargado: '' },
  { hora: '11:05', actividad: 'Inspección', tipo: 'inspeccion', materiales: '', encargado: '' },
  { hora: '12:55', actividad: 'Cierre (consejo de patrulla, avisos y porra)', tipo: 'cierre', materiales: '', encargado: '' },
].map((a) => ({ ...a, id: nuevoId(), montaje: '', dinamica: '', variante: '', reto: '' }));
const porHora = (a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99');
import TablaEditable from '../components/TablaEditable.jsx';
import { importarMachote } from '../lib/importarMachote';
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
  const [avisos, setAvisos] = useState(null);
  const [importando, setImportando] = useState(false);
  const [errorImp, setErrorImp] = useState('');
  const [config] = useConfig();

  const importar = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setImportando(true); setErrorImp('');
    try {
      const { datos, avisos: av } = await importarMachote(await archivo.arrayBuffer(), ciclos);
      const lleno = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== ''));
      lleno.actividades = (lleno.actividades || []).map((a) => ({ ...a, encargado: a.encargado || lleno.encargado || '' }));
      setCopia({ ...lleno, fecha: lleno.fecha || hoyISO() });
      setAvisos(av);
      setSel('nueva');
    } catch (err) {
      setErrorImp(err.message || 'No se pudo leer el archivo.');
    } finally { setImportando(false); }
  };

  if (sel) {
    const r = sel === 'nueva' ? null : reuniones.find((x) => x.id === sel);
    return <EditorReunion key={sel + (copia ? 'c' : '')} r={r} base={copia} patrullas={patrullas} ciclos={ciclos}
      avisos={avisos} onCerrar={() => { setSel(null); setCopia(null); setAvisos(null); }} />;
  }

  const duplicar = (r) => {
    const { id, puntajes, juegos, asistencia, inspeccion, fecha, ...resto } = r;
    setCopia({ ...resto, fecha: hoyISO() });
    setAvisos(null);
    setSel('nueva');
  };

  const lista = [...reuniones].reverse();
  return (
    <>
    <div className="card leyenda">
      <h2>Planificá con el machote oficial</h2>
      <p>
        Cada programa de reunión se arma con el <strong>machote de Word</strong> del Grupo, que mantiene siempre las mismas secciones,
        campos y tipos de actividad. Así todas las reuniones quedan ordenadas y el sistema puede leerlas por completo.
      </p>
      <ol>
        <li><strong>Descargá el machote</strong> y llenalo, vos o con la herramienta de IA de tu confianza. No cambies las secciones, los nombres de los campos ni los 6 tipos de actividad.</li>
        <li><strong>Subí el Word ya completo.</strong> El sistema llena la reunión: fecha y horario, cronograma con sus tipos, ayuda al programa, insumos y anexos.</li>
        <li><strong>Revisá, ajustá y guardá.</strong> Después de la reunión registrás la asistencia, la inspección y los puntajes por patrulla.</li>
      </ol>
      <div className="row">
        <a className="btn" href="/machote/Machote_Reunion_Tropa_307.docx" download>⬇ Descargar machote (Word)</a>
        <label className="btn primary" style={{ cursor: 'pointer', margin: 0 }}>
          {importando ? 'Leyendo el documento…' : '⬆ Subir machote lleno'}
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importar} disabled={importando} hidden />
        </label>
      </div>
      {errorImp && <p className="error" role="alert">{errorImp}</p>}
    </div>
    <div className="card">
      <div className="row between">
        <h2>Reuniones</h2>
        <button className="btn primary" onClick={() => { setCopia(null); setAvisos(null); setSel('nueva'); }}>+ Programa en blanco</button>
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
                  {patrullas.map((p) => <td key={p.id}><strong>{totalReunionPatrulla(r, p.id, config)}</strong></td>)}
                  <td><button className="btn small quiet" onClick={(e) => { e.stopPropagation(); duplicar(r); }}>Duplicar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </>
  );
}

const SECCIONES = [
  ['programa', 'Programa'],
  ['detalle', 'Ayuda al programa'],
  ['insumos', 'Insumos y anexos'],
  ['inspeccion', 'Asistencia e inspección'],
  ['puntajes', 'Puntajes'],
];

function EditorReunion({ r, base, avisos, patrullas, ciclos, onCerrar }) {
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
      objetivo: '', fondo: datos.tema || '', impresos: '', otrosMateriales: '', anexos: [], puntajes: {}, juegos: {}, asistencia: {}, inspeccion: {},
      ...datos, fecha,
      actividades: (datos.actividades?.length ? datos.actividades : (r ? [] : FILAS_BASE().map((a) => ({ ...a, encargado: miembro?.nombre || '' })))).map((a) => (a.id ? a : { ...a, id: nuevoId() })),
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
  const setJuego = (aid, pid, k, v) => {
    const n = v === '' ? '' : Math.max(0, Math.min(k === 'lugar' ? patrullas.length : max, Number(v)));
    setF((x) => ({ ...x, juegos: { ...x.juegos, [aid]: { ...(x.juegos?.[aid] || {}), [pid]: { ...(x.juegos?.[aid]?.[pid] || {}), [k]: n } } } }));
  };
  const setPresente = (m, pid, on) => setF((x) => {
    const a = { ...x.asistencia };
    if (on) a[m.id] = pid; else delete a[m.id];
    return { ...x, asistencia: a };
  });
  const setItem = (mid, key, on) => setF((x) => ({ ...x, inspeccion: { ...x.inspeccion, [mid]: { ...(x.inspeccion?.[mid] || {}), [key]: on } } }));
  const todosPresentes = (pid, miembros) => setF((x) => ({ ...x, asistencia: { ...x.asistencia, ...Object.fromEntries(miembros.map((m) => [m.id, pid])) } }));
  const setAct = (i, k, v) => set('actividades', f.actividades.map((a, j) => (j === i ? { ...a, [k]: v } : a)));

  const guardar = async (e) => {
    e?.preventDefault();
    setGuardando(true);
    const limpio = {};
    for (const p of patrullas) {
      limpio[p.id] = {};
      for (const c of CATEGORIAS) limpio[p.id][c.key] = Number(f.puntajes[p.id]?.[c.key]) || 0;
    }
    const juegos = {};
    for (const a of f.actividades.filter((x) => x.tipo === 'activo')) {
      juegos[a.id] = {};
      for (const p of patrullas) {
        const j = f.juegos?.[a.id]?.[p.id] || {};
        juegos[a.id][p.id] = { ...Object.fromEntries(CRITERIOS.map((c) => [c.key, Number(j[c.key]) || 0])), lugar: Number(j.lugar) || 0 };
      }
    }
    const asistencia = Object.fromEntries(Object.entries(f.asistencia || {}).filter(([, pat]) => patrullas.some((p) => p.id === pat)));
    const inspeccion = {};
    for (const id of Object.keys(asistencia)) {
      const it = f.inspeccion?.[id] || {};
      inspeccion[id] = Object.fromEntries(ITEMS_INSPECCION.filter((i) => it[i.key]).map((i) => [i.key, true]));
    }
    const nPres = Object.keys(asistencia).length;
    const participantes = !f.participantesManual && nPres
      ? `${nPres} protagonistas — ${new Set(Object.values(asistencia)).size} patrullas` : f.participantes;
    const data = { ...f, participantes, puntajes: limpio, juegos, asistencia, inspeccion };
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

      {avisos && (
        <div className={avisos.length ? 'alert media' : 'alert info'} role="status">
          <strong>Programa importado desde Word.</strong> Revisá los datos y guardá la reunión.
          {avisos.length > 0 && <ul style={{ margin: '.4rem 0 0 1rem', padding: 0 }}>{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
        </div>
      )}

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
            <label>Participantes<input value={f.participantes} onChange={(e) => setF((x) => ({ ...x, participantes: e.target.value, participantesManual: true }))} /></label>
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
              { key: 'tipo', label: 'Tipo', tipo: 'select', opciones: TIPOS_ACTIVIDAD.map((t) => ({ v: t.v, l: t.l })), min: 160 },
              { key: 'materiales', label: 'Materiales', min: 180 },
              { key: 'encargado', label: 'Encargado', min: 130 },
            ]}
            filas={f.actividades} onChange={(v) => set('actividades', v)}
            nueva={() => ({ id: nuevoId(), hora: '', actividad: '', tipo: '', materiales: '', encargado: f.encargado, montaje: '', dinamica: '', variante: '', reto: '' })}
            agregar="Agregar actividad"
            acciones={f.actividades.length > 1 && (
              <button type="button" className="btn small quiet" onClick={() => set('actividades', [...f.actividades].sort(porHora))}>Ordenar por hora</button>
            )} />
          <p className="muted">Arrastrá el asa ⠿ de cada fila para cambiar el orden (en el celular, mantené el dedo sobre ella).</p>
        </>
      )}

      {seccion === 'detalle' && (
        <>
          <p className="muted">Explicación de cada actividad para quien la dirige. Inicio, inspección y cierre son siempre iguales y no necesitan ayuda.</p>
          <div className="form" style={{ marginBottom: 12 }}>
            <label className="full">Nota de entorno seguro<textarea rows={3} value={f.notaEntorno || ''} placeholder="Revisión del terreno, reglas de contacto, hidratación y riesgos propios de la reunión"
              onChange={(e) => set('notaEntorno', e.target.value)} /></label>
          </div>
          {f.actividades.length === 0 && <p className="empty">Primero agregá actividades en el cronograma.</p>}
          {f.actividades.map((a, i) => (a.tipo === 'cierre' ? (
            <fieldset key={i} style={{ marginBottom: 10 }}>
              <legend>Cierre</legend>
              <label>Algo especial del cierre (opcional)
                <textarea rows={2} value={a.dinamica || ''} onChange={(e) => setAct(i, 'dinamica', e.target.value)} />
              </label>
            </fieldset>
          ) : (
            <fieldset key={i} hidden={ESTANDAR.includes(a.tipo)} style={{ marginBottom: 10 }}>
              <legend>{a.hora ? `${a.hora} · ` : ''}{a.actividad || `Actividad ${i + 1}`}</legend>
              <div className="form">
                <label>Duración (min)<input type="number" min={1} value={a.duracion || ''} onChange={(e) => setAct(i, 'duracion', e.target.value)} /></label>
                {a.tipo === 'pasiva' && (
                  <label>Complejidad
                    <select value={a.complejidad || ''} onChange={(e) => setAct(i, 'complejidad', e.target.value)}>
                      <option value="">—</option><option value="simple">Simple (5 min máx.)</option><option value="compleja">Compleja (10 min máx.)</option><option value="manualidad">Manualidad (sin límite)</option>
                    </select>
                  </label>
                )}
                <label className="full">Montaje<textarea rows={2} value={a.montaje || ''} onChange={(e) => setAct(i, 'montaje', e.target.value)} /></label>
                <label className="full">La dinámica<textarea rows={4} value={a.dinamica || ''} onChange={(e) => setAct(i, 'dinamica', e.target.value)} /></label>
                <label className="full">Variante<textarea rows={2} value={a.variante || ''} onChange={(e) => setAct(i, 'variante', e.target.value)} /></label>
                <label className="full">El reto<textarea rows={2} value={a.reto || ''} onChange={(e) => setAct(i, 'reto', e.target.value)} /></label>
              </div>
            </fieldset>
          )))}
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

      {seccion === 'inspeccion' && (
        patrullas.length === 0 ? <p className="empty">Primero creá las patrullas.</p> : (
          <>
            <p className="muted">
              Marcá quién asistió; solo los presentes habilitan sus campos de inspección. Cada elemento vale 1 punto para su patrulla
              y cada asistente suma 1 punto de asistencia. El uniforme completo solo aplica a protagonistas promesados.
            </p>
            {protagonistas.filter((x) => x.activo !== false).length === 0 && <p className="alert media">Registrá primero a los protagonistas en «Expedientes» y asignales patrulla.</p>}
            {patrullas.map((p) => {
              const miembros = protagonistas.filter((x) => x.activo !== false && x.patrullaId === p.id)
                .sort((a, b) => `${a.nombre} ${a.apellidos}`.localeCompare(`${b.nombre} ${b.apellidos}`));
              const d = desglosePatrulla(f, p.id, config);
              const nPres = miembros.filter((m) => f.asistencia?.[m.id] === p.id).length;
              return (
                <fieldset key={p.id} style={{ marginBottom: 12 }}>
                  <legend><span className="dot" style={{ background: p.color }} /> {p.nombre} · asistieron {nPres} de {miembros.length}</legend>
                  {miembros.length === 0 ? <p className="empty">Esta patrulla no tiene protagonistas asignados.</p> : (
                    <>
                      <div className="row between" style={{ marginBottom: 6 }}>
                        <button type="button" className="btn small" onClick={() => todosPresentes(p.id, miembros)}>Todos presentes</button>
                        <span className="muted">Asistencia {d.asistencia} pts · Inspección {d.inspeccion} pts</span>
                      </div>
                      <div className="table-wrap">
                        <table className="table insp">
                          <thead>
                            <tr>
                              <th>Protagonista</th><th className="c">Presente</th>
                              {ITEMS_INSPECCION.map((i) => <th key={i.key} className="c" title={i.label}>{i.corto}</th>)}
                              <th className="c">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {miembros.map((m) => {
                              const pres = f.asistencia?.[m.id] === p.id;
                              const marcados = ITEMS_INSPECCION.filter((i) => pres && f.inspeccion?.[m.id]?.[i.key]).length;
                              return (
                                <tr key={m.id} style={pres ? null : { opacity: 0.6 }}>
                                  <td><strong>{m.nombre} {m.apellidos}</strong>{m.promesado ? <span className="badge" style={{ marginLeft: 6 }}>Promesado</span> : null}</td>
                                  <td className="c"><input type="checkbox" checked={pres} onChange={(e) => setPresente(m, p.id, e.target.checked)} aria-label={`${m.nombre} presente`} /></td>
                                  {ITEMS_INSPECCION.map((i) => {
                                    const bloqueado = !pres || (i.soloPromesado && !m.promesado);
                                    return (
                                      <td key={i.key} className="c">
                                        <input type="checkbox" disabled={bloqueado} title={i.soloPromesado && !m.promesado ? 'No promesado' : i.label}
                                          checked={!bloqueado && !!f.inspeccion?.[m.id]?.[i.key]} onChange={(e) => setItem(m.id, i.key, e.target.checked)}
                                          aria-label={`${i.label} de ${m.nombre}`} />
                                      </td>
                                    );
                                  })}
                                  <td className="c"><strong>{marcados}</strong></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </fieldset>
              );
            })}
          </>
        )
      )}

      {seccion === 'puntajes' && (
        patrullas.length === 0 ? <p className="empty">Primero creá las patrullas.</p> : (
          <>
            {f.actividades.filter((a) => a.tipo === 'activo').length === 0 && (
              <p className="alert info">Marcá actividades como «Juego activo» en el Programa para puntuarlas aquí.</p>
            )}
            {f.actividades.filter((a) => a.tipo === 'activo').map((a) => (
              <fieldset key={a.id} style={{ marginBottom: 12 }}>
                <legend>{a.hora ? `${a.hora} · ` : ''}{a.actividad || 'Juego activo'}</legend>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Patrulla</th>
                        {CRITERIOS.map((c) => <th key={c.key} title={c.ayuda}>{c.label} (1–{max})</th>)}
                        <th>Lugar</th><th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patrullas.map((p) => {
                        const j = f.juegos?.[a.id]?.[p.id] || {};
                        const porLugar = listaPuntosLugar(config);
                        const pts = CRITERIOS.reduce((t, c) => t + (Number(j[c.key]) || 0), 0) + (j.lugar ? porLugar[Number(j.lugar) - 1] || 0 : 0);
                        return (
                          <tr key={p.id}>
                            <td><span className="dot" style={{ background: p.color }} /> <strong>{p.nombre}</strong></td>
                            {CRITERIOS.map((c) => (
                              <td key={c.key}>
                                <input type="number" min={1} max={max} style={{ width: 64 }} aria-label={`${c.label} de ${p.nombre}`}
                                  value={j[c.key] ?? ''} onChange={(e) => setJuego(a.id, p.id, c.key, e.target.value)} />
                              </td>
                            ))}
                            <td>
                              <select value={j.lugar || ''} onChange={(e) => setJuego(a.id, p.id, 'lugar', e.target.value)} aria-label={`Lugar de ${p.nombre}`}>
                                <option value="">—</option>
                                {patrullas.map((_, n) => <option key={n} value={n + 1}>{n + 1}.º ({porLugar[n] ?? 0} pts)</option>)}
                              </select>
                            </td>
                            <td><strong>{pts}</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </fieldset>
            ))}
            <p className="muted">
              Espíritu: ánimo y cantos mientras no juegan · Vivencia: Ley y Promesa · Astucia: buenas ideas para facilitar el juego ·
              Sistema: uso del sistema de patrullas · Lugar: puntos configurables en Ajustes.
            </p>

            <fieldset style={{ marginTop: 12 }}>
              <legend>Comportamiento (0–{max})</legend>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Categoría</th>{patrullas.map((p) => <th key={p.id}><span className="dot" style={{ background: p.color }} /> {p.nombre}</th>)}</tr></thead>
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
                      <td><strong>Total de la reunión</strong></td>
                      {patrullas.map((p) => <td key={p.id}><strong>{desglosePatrulla(f, p.id, config).total}</strong></td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            </fieldset>
          </>
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
