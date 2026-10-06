import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useGrupo } from '../lib/grupo.jsx';
import { useConfig } from '../lib/useConfig';
import { AREAS, CATEGORIAS, CRITERIOS, desglosePatrulla, edad, ETAPAS, etiquetaCiclo, EVALUACION, formatoFecha, hoyISO } from '../lib/etapas';
import TablaEditable from '../components/TablaEditable.jsx';
import IconoOjo from '../components/IconoOjo.jsx';
import CicloDocumento, { filasProgresion, totalesAreas } from '../components/CicloDocumento.jsx';
import { borrarBorrador, guardarBorrador, leerBorrador, pendientesCiclo, resumenPendientes, seccionesPendientes } from '../lib/cicloCompleto.js';

export default function Ciclos({ abrirCiclo, limpiarCiclo }) {
  const { col, ref } = useGrupo();
  const { docs: ciclos } = useCollection('ciclos', 'inicio');
  const { docs: reuniones } = useCollection('reuniones', 'fecha');
  const { docs: extras } = useCollection('puntosExtra', 'fecha');
  const { docs: protagonistas } = useCollection('protagonistas');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const [sel, setSel] = useState(null);
  const [vistaDirecta, setVistaDirecta] = useState(false);
  const [base, setBase] = useState(null);
  const [avisos, setAvisos] = useState(null);
  const [importando, setImportando] = useState(false);
  const [errorImp, setErrorImp] = useState('');

  // Llegada desde un recordatorio del Inicio
  useEffect(() => {
    if (!abrirCiclo) return;
    setBase(null); setAvisos(null); setVistaDirecta(false); setSel(abrirCiclo);
    limpiarCiclo?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirCiclo]);

  const importar = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setImportando(true); setErrorImp('');
    try {
      const { importarPdfCiclo } = await import('../lib/cicloPdf.js');
      const { datos, avisos: av } = await importarPdfCiclo(await archivo.arrayBuffer(), { protagonistas, patrullas });
      const limpio = JSON.parse(JSON.stringify(datos)); // quita valores indefinidos (Firestore no los acepta)
      const lleno = Object.fromEntries(Object.entries(limpio).filter(([, v]) => v !== ''));
      setBase({ ...lleno, fecha: lleno.fecha || hoyISO() });
      setAvisos(av);
      setSel('nuevo');
    } catch (err) {
      setErrorImp(err.message || 'No se pudo leer el PDF.');
    } finally { setImportando(false); }
  };

  if (sel) {
    const c = sel === 'nuevo' ? null : ciclos.find((x) => x.id === sel);
    return <EditorCiclo key={sel + (vistaDirecta ? 'v' : '') + (base ? 'b' : '')} c={c} base={base} avisos={avisos} ciclos={ciclos} reuniones={reuniones} extras={extras} vistaInicial={vistaDirecta}
      onCerrar={() => { setSel(null); setVistaDirecta(false); setBase(null); setAvisos(null); }} />;
  }

  const borrar = async (c) => {
    const usados = reuniones.some((r) => r.cicloId === c.id) || extras.some((x) => x.cicloId === c.id);
    if (usados) return alert('Este ciclo tiene reuniones o puntos asociados; no se puede borrar.');
    if (confirm(`¿Borrar ${etiquetaCiclo(c)}?`)) await deleteDoc(ref('ciclos', c.id));
  };
  const hoy = hoyISO();

  return (
    <>
    <div className="card leyenda">
      <h2>Ciclo de Programa con el formulario oficial</h2>
      <p>
        La Asociación presenta el ciclo con su <strong>herramienta oficial en PDF</strong>. El sistema trabaja con ese mismo formulario:
        podés llenarlo aquí o en el PDF, y pasar los datos de un lado al otro sin volver a escribirlos.
      </p>
      <ol>
        <li><strong>Llenalo aquí</strong> con «+ Nuevo ciclo de programa», o <strong>descargá el formulario oficial</strong> y llenalo en tu lector de PDF.</li>
        <li><strong>Subí el PDF lleno.</strong> El sistema carga la evaluación, la progresión personal, los objetivos, el cronograma, la membresía y las solicitudes a la Junta.</li>
        <li><strong>Revisá y guardá.</strong> Dentro del ciclo, «Generar PDF oficial» te entrega el formulario ya lleno para presentarlo a la Junta de Grupo.</li>
      </ol>
      <div className="row">
        <a className="btn" href="/formularios/Herramienta_Ciclo_de_Programa.pdf" download>⬇ Descargar formulario oficial (PDF)</a>
        <label className="btn primary" style={{ cursor: 'pointer', margin: 0 }}>
          {importando ? 'Leyendo el PDF…' : '⬆ Subir formulario lleno (PDF)'}
          <input type="file" accept=".pdf,application/pdf" onChange={importar} disabled={importando} hidden />
        </label>
      </div>
      {errorImp && <p className="error" role="alert">{errorImp}</p>}
    </div>
    <div className="card">
      <div className="row between">
        <h2>Ciclos de programa</h2>
        <button className="btn primary" onClick={() => { setBase(null); setAvisos(null); setSel('nuevo'); }}>+ Nuevo ciclo de programa</button>
      </div>
      {ciclos.length === 0 && <p className="empty">Creá el ciclo de programa vigente para empezar a sumar puntajes.</p>}
      {[...ciclos].reverse().map((c) => {
        const vigente = c.inicio <= hoy && (!c.fin || c.fin >= hoy);
        return (
          <div key={c.id} className="item">
            <div>
              <strong>{etiquetaCiclo(c)}</strong> {vigente && <span className="badge">Vigente</span>}
              {(() => {
                const pe = pendientesCiclo(c, { protagonistas, ciclos });
                if (c.terminado || !pe.length) return <span className="badge"> {c.terminado ? 'Terminado' : 'Completo'}</span>;
                return <span className="badge media"> Faltan {resumenPendientes(pe).faltan} secciones</span>;
              })()}
              <div className="muted">{formatoFecha(c.inicio)} – {c.fin ? formatoFecha(c.fin) : 'en curso'} · {reuniones.filter((r) => r.cicloId === c.id).length} reuniones</div>
            </div>
            <div className="row">
              <button className="btn small icono" title="Ver el documento" aria-label="Ver el documento" onClick={() => { setVistaDirecta(true); setSel(c.id); }}><IconoOjo /></button>
              <button className="btn small" onClick={() => setSel(c.id)}>Abrir</button>
              <button className="btn small danger" onClick={() => borrar(c)}>Borrar</button>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

const SECCIONES = [
  ['datos', 'Datos'],
  ['evaluacion', 'Evaluación y diagnóstico'],
  ['seguimiento', 'Seguimiento de progresión'],
  ['traspasos', 'Traspasos y ceremonias'],
  ['propuesta', 'Propuesta: equipos'],
  ['objetivos', 'Objetivos del ciclo'],
  ['cronograma', 'Cronograma'],
  ['proyeccion', 'Proyección (dirigente)'],
  ['junta', 'Membresía y Junta'],
  ['resultados', 'Puntaje final'],
];

const filasDeCronograma = (cr = []) => cr.filter((a) => a.actividad || a.fecha).map((a) => ({
  fecha: a.fecha || '', actividad: a.actividad || '', objetivo: a.objetivo || '', responsable: a.responsable || '', eval: '', obs: '',
}));
const cicloAnterior = (ciclos, idActual, inicio) => ciclos
  .filter((x) => x.id !== idActual && x.inicio < inicio).sort((a, b) => a.inicio.localeCompare(b.inicio)).pop();
const mesAnio = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(iso || ''); return m ? `${m[2]}/${m[1]}` : '—'; };
const enRango = (fecha, ini, fin) => !!fecha && fecha >= (ini || '') && fecha <= (fin || hoyISO());
const nombreDe = (p) => `${p.nombre || ''} ${p.apellidos || ''}`.trim();

// Totales por área de crecimiento y énfasis del ciclo (las áreas con más marcas)
function Enfasis({ tot }) {
  const max = Math.max(0, ...Object.values(tot));
  const lideres = AREAS.filter((a) => max > 0 && tot[a.key] === max);
  return (
    <div className="enfasis" role="status">
      <div className="enfasis-titulo">
        {max > 0 ? <>Énfasis del ciclo: <strong>{lideres.map((a) => a.label).join(' y ')}</strong></> : 'Marcá las áreas para ver el énfasis del ciclo'}
      </div>
      <div className="enfasis-chips">
        {AREAS.map((a) => (
          <span key={a.key} className={max > 0 && tot[a.key] === max ? 'chip lider' : 'chip'}>{a.label} <b>{tot[a.key]}</b></span>
        ))}
      </div>
      <div className="muted">Las sumatorias mayores definen las áreas que deben tener mayor énfasis en el siguiente ciclo.</div>
    </div>
  );
}

function EditorCiclo({ c, base, avisos, ciclos, reuniones, extras, vistaInicial = false, onCerrar }) {
  const { gid, col, ref, grupo, miembro } = useGrupo();
  const [config] = useConfig();
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: protagonistas } = useCollection('protagonistas');
  const { docs: miembros } = useCollection('miembros');
  const [seccion, setSeccion] = useState('datos');
  const [vista, setVista] = useState(vistaInicial);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Estado completo del ciclo a partir de datos guardados (o importados); los vacíos toman valores por defecto
  const construir = (datos) => {
    const { id, ...d } = datos || {};
    const prev = cicloAnterior(ciclos, c?.id, d.inicio || hoyISO());
    const precarga = !(d.evaluacion?.actividades?.length) && prev ? filasDeCronograma(prev.cronograma) : null;
    return {
      numero: String(ciclos.length + 1), anio: new Date().getFullYear(), nombre: '', inicio: hoyISO(), fin: '', fecha: hoyISO(),
      nombreSeccion: `Tropa ${grupo?.numero || ''}`.trim(), objetivoGeneral: '', objetivosEspecificos: '',
      traspasos: [], equipos: [], cronograma: [], progresion: {}, solicitudes: '', coordinadores: miembro?.nombre || '', terminado: false,
      ...d,
      evaluacion: { actividades: [], logro: '', logroDetalle: '', logroEspecificos: '', gusto: '', noGusto: '', ...(d.evaluacion || {}), ...(precarga ? { actividades: precarga } : {}) },
      membresia: { nuevos: '', partidas: '', dirigentes: '', desercion: '', ...(d.membresia || {}) },
    };
  };
  // Un ciclo nuevo se compara contra uno en blanco; uno existente, contra lo guardado
  const baseline = useRef(null);
  if (baseline.current === null) baseline.current = JSON.stringify(construir(c || {}));
  const borradorInicial = useRef(base ? null : leerBorrador(gid, c?.id)).current;
  const [restaurado, setRestaurado] = useState(!!borradorInicial?.f);
  const [f, setF] = useState(() => construir(borradorInicial?.f || c || base || {}));

  // Autoguardado local: si hay cambios sin guardar se conserva un borrador y el Inicio avisa
  useEffect(() => {
    const t = setTimeout(() => {
      if (JSON.stringify(f) === baseline.current) borrarBorrador(gid, c?.id); else guardarBorrador(gid, c?.id, f);
    }, 700);
    return () => clearTimeout(t);
  }, [f, gid, c?.id]);
  const descartarBorrador = () => {
    borrarBorrador(gid, c?.id);
    setF(construir(c || base || {}));
    setRestaurado(false);
  };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setEv = (k, v) => setF((x) => ({ ...x, evaluacion: { ...x.evaluacion, [k]: v } }));
  const setMem = (k, v) => setF((x) => ({ ...x, membresia: { ...x.membresia, [k]: v } }));
  const setProg = (pid, cambios) => setF((x) => ({ ...x, progresion: { ...x.progresion, [pid]: { ...(x.progresion[pid] || {}), ...cambios } } }));
  const setArea = (pid, area, v) => setProg(pid, { areas: { ...(f.progresion[pid]?.areas || {}), [area]: v } });

  const anterior = useMemo(() => cicloAnterior(ciclos, c?.id, f.inicio), [ciclos, c, f.inicio]);

  // Vuelve a leer el cronograma del ciclo anterior sin perder lo ya evaluado
  const recargarEvaluacion = () => {
    if (!anterior?.cronograma?.length) return alert('El ciclo anterior no tiene cronograma guardado.');
    const previas = f.evaluacion.actividades;
    const nuevas = filasDeCronograma(anterior.cronograma).map((r) => {
      const ya = previas.find((x) => !x.manual && x.actividad === r.actividad && x.fecha === r.fecha);
      return ya ? { ...r, eval: ya.eval, obs: ya.obs } : r;
    });
    setEv('actividades', [...nuevas, ...previas.filter((x) => x.manual)]);
  };
  const setFilaEv = (i, k, v) => setF((x) => ({ ...x, evaluacion: { ...x.evaluacion, actividades: x.evaluacion.actividades.map((a, j) => (j === i ? { ...a, [k]: v } : a)) } }));
  const conteoEv = ['3', '2', '1'].map((v) => f.evaluacion.actividades.filter((a) => a.eval === v).length);
  const evaluadas = conteoEv[0] + conteoEv[1] + conteoEv[2];
  const cargarPatrullas = () => {
    const ya = new Set(f.equipos.map((e) => e.patrullaId).filter(Boolean));
    set('equipos', [...f.equipos, ...patrullas.filter((p) => !ya.has(p.id)).map((p) => ({ patrullaId: p.id, nombre: p.nombre, general: '', especificos: '' }))]);
  };
  const traspasosAlCronograma = () => {
    const existentes = new Set(f.cronograma.map((a) => a.actividad));
    const nuevas = f.traspasos.filter((t) => t.actividad || t.nombre)
      .map((t) => ({ fecha: '', actividad: `${t.actividad || 'Traspaso o ceremonia'}${t.nombre ? ` — ${t.nombre}` : ''}`, objetivo: t.observaciones || '', responsable: '' }))
      .filter((a) => !existentes.has(a.actividad));
    set('cronograma', [...f.cronograma, ...nuevas]);
    setMensaje(nuevas.length ? `Se agregaron ${nuevas.length} al cronograma. Falta ponerles fecha.` : 'Todos los traspasos ya estaban en el cronograma.');
  };

  const filas = filasProgresion(protagonistas);
  const tot = totalesAreas(filas, f.progresion);
  const pend = pendientesCiclo({ ...f, id: c?.id }, { protagonistas, ciclos });
  const secPend = seccionesPendientes(pend);
  const resumen = resumenPendientes(pend);

  // Resumen de membresía: se calcula con los expedientes; cada valor se puede corregir a mano
  const auto = useMemo(() => ({
    nuevos: protagonistas.filter((p) => enRango(p.fechaIngreso, f.inicio, f.fin)).length,
    partidas: protagonistas.filter((p) => p.activo === false && enRango(p.fechaSalida, f.inicio, f.fin)).length,
    dirigentes: miembros.filter((m) => m.estado === 'activo').length,
    activos: filas.length,
  }), [protagonistas, miembros, f.inicio, f.fin, filas.length]);
  const valorMem = (k) => (f.membresia[k] !== undefined && f.membresia[k] !== '' && f.membresia[k] !== null ? f.membresia[k] : auto[k]);
  const membresiaFinal = { ...f.membresia, nuevos: valorMem('nuevos'), partidas: valorMem('partidas'), dirigentes: valorMem('dirigentes'), activos: auto.activos };
  const cicloFinal = { ...f, membresia: membresiaFinal };
  const salidas = protagonistas.filter((p) => p.activo === false && enRango(p.fechaSalida, f.inicio, f.fin));

  const generarPdf = async () => {
    setGenerando(true);
    try {
      const { generarPdfCiclo } = await import('../lib/cicloPdf.js');
      const plantilla = await (await fetch('/formularios/Herramienta_Ciclo_de_Programa.pdf')).arrayBuffer();
      const { bytes, avisos: av } = await generarPdfCiclo({ plantilla, ciclo: cicloFinal, protagonistas, patrullas, grupo });
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `Ciclo_${f.numero || ''}_${f.anio || ''}_Tropa_${grupo?.numero || ''}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      if (av.length) alert(`PDF generado. Tené en cuenta:\n\n• ${av.join('\n• ')}`);
    } catch (err) {
      alert(`No se pudo generar el PDF: ${err.message}`);
    } finally { setGenerando(false); }
  };

  const guardar = async (e) => {
    e?.preventDefault();
    setGuardando(true);
    try {
      if (c) await updateDoc(ref('ciclos', c.id), cicloFinal);
      else await addDoc(col('ciclos'), cicloFinal);
      borrarBorrador(gid, c?.id);
      baseline.current = JSON.stringify(f); // evita que el autoguardado recree el borrador al cerrar
      onCerrar();
    } finally { setGuardando(false); }
  };

  const tabla = useMemo(() => {
    if (!c) return [];
    const rs = reuniones.filter((r) => r.cicloId === c.id);
    const es = extras.filter((e) => e.cicloId === c.id);
    return patrullas.map((p) => {
      const acc = { crit: Object.fromEntries(CRITERIOS.map((k) => [k.key, 0])), lugar: 0, asistencia: 0, inspeccion: 0, general: Object.fromEntries(CATEGORIAS.map((k) => [k.key, 0])) };
      for (const r of rs) {
        const d = desglosePatrulla(r, p.id, config);
        CRITERIOS.forEach((k) => { acc.crit[k.key] += d.crit[k.key]; });
        CATEGORIAS.forEach((k) => { acc.general[k.key] += d.general[k.key]; });
        acc.lugar += d.lugar; acc.asistencia += d.asistencia; acc.inspeccion += d.inspeccion;
      }
      const extra = es.filter((e) => e.patrullaId === p.id).reduce((s2, e) => s2 + (Number(e.puntos) || 0), 0);
      const total = Object.values(acc.crit).reduce((a, b) => a + b, 0) + acc.lugar + acc.asistencia + acc.inspeccion + Object.values(acc.general).reduce((a, b) => a + b, 0) + extra;
      return { ...p, ...acc, extra, total };
    }).sort((a, b) => b.total - a.total);
  }, [c, reuniones, extras, patrullas, config]);

  if (vista) {
    return (
      <div className="card">
        <div className="row between no-print">
          <div className="row">
            <button className="btn" onClick={onCerrar}>← Ciclos</button>
            <button className="btn" onClick={() => setVista(false)}>Editar</button>
          </div>
          <button className="btn primary" onClick={() => window.print()}>Imprimir / guardar PDF</button>
        </div>
        <CicloDocumento c={cicloFinal} protagonistas={protagonistas} patrullas={patrullas} grupo={grupo} />
      </div>
    );
  }

  const selectEtapa = (p, pr) => (
    <select value={pr.etapaCiclo || p.etapa} onChange={(e) => setProg(p.id, { etapaCiclo: e.target.value })} aria-label={`Etapa en el ciclo de ${p.nombre}`}>
      {ETAPAS.map((x) => <option key={x}>{x}</option>)}
    </select>
  );
  const celdasAreas = (p, pr) => AREAS.map((a) => (
    <td key={a.key} className="c" data-label={a.label}>
      <input type="checkbox" checked={!!pr.areas?.[a.key]} onChange={(e) => setArea(p.id, a.key, e.target.checked)} aria-label={`${a.label} de ${p.nombre}`} />
    </td>
  ));
  const totalesFila = (antes, despues) => (
    <tr className="totales">
      <td colSpan={antes}><strong>Total</strong></td>
      {AREAS.map((a) => <td key={a.key} className="c" data-label={a.label}><strong>{tot[a.key]}</strong></td>)}
      {despues > 0 && <td colSpan={despues} />}
    </tr>
  );

  return (
    <form className="card" onSubmit={guardar}>
      <div className="row between">
        <h2>{c ? etiquetaCiclo(c) : 'Nuevo ciclo de programa'}</h2>
        <button type="button" className="btn" onClick={onCerrar}>← Volver</button>
      </div>
      {avisos && (
        <div className={avisos.length ? 'alert media' : 'alert info'} role="status">
          <strong>Formulario importado desde PDF.</strong> Revisá los datos y guardá el ciclo.
          {avisos.length > 0 && <ul style={{ margin: '.4rem 0 0 1rem', padding: 0 }}>{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
        </div>
      )}

      {restaurado && (
        <div className="alert media" role="status">
          <strong>Recuperamos tu borrador sin guardar.</strong> Revisalo y pulsá «Guardar ciclo».
          <button type="button" className="link" style={{ marginLeft: 8 }} onClick={descartarBorrador}>Descartar el borrador</button>
        </div>
      )}
      {!f.terminado && pend.length > 0 && (
        <div className="alert info pendientes" role="status">
          <strong>Falta completar {resumen.faltan} de {resumen.total} secciones:</strong> {resumen.nombres.join(' · ')}.
          <span className="muted"> Las pestañas con ● tienen algo pendiente.</span>
        </div>
      )}

      <div className="seg multi">
        {SECCIONES.filter(([k]) => k !== 'resultados' || c).map(([k, l]) => (
          <button key={k} type="button" className={seccion === k ? 'on' : ''} onClick={() => { setSeccion(k); setMensaje(''); }}>
            {l}{secPend.has(k) && !f.terminado && <span className="pend" title="Pendiente" aria-label="pendiente"> ●</span>}
          </button>
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
          <h3>Evaluación de actividades</h3>
          {anterior ? (
            <p className="muted">
              Se alimenta con el <strong>cronograma del ciclo anterior</strong> ({etiquetaCiclo(anterior)}). Solo evaluás cada actividad y anotás observaciones.
            </p>
          ) : (
            <p className="alert media">No hay un ciclo anterior con cronograma. Podés agregar a mano las actividades que se programaron.</p>
          )}
          <div className="leyenda-eval" role="note">
            <span className="v3">(*) 3 · Cumplido</span><span className="v2">2 · Parcialmente cumplido</span><span className="v1">1 · No se cumplió</span>
          </div>
          {f.evaluacion.actividades.length > 0 && (
            <div className="table-wrap">
              <table className="table editable evaltab">
                <thead>
                  <tr><th>Fecha</th><th>Actividad</th><th>Objetivo</th><th>Responsable</th><th>Evaluación (*)</th><th>Observaciones / aspectos a mejorar</th><th aria-label="Quitar" /></tr>
                </thead>
                <tbody>
                  {f.evaluacion.actividades.map((a, i) => (
                    <tr key={i}>
                      {a.manual ? (
                        <>
                          <td data-label="Fecha"><input type="date" value={a.fecha || ''} onChange={(e) => setFilaEv(i, 'fecha', e.target.value)} /></td>
                          <td data-label="Actividad"><input value={a.actividad || ''} onChange={(e) => setFilaEv(i, 'actividad', e.target.value)} /></td>
                          <td data-label="Objetivo"><input value={a.objetivo || ''} onChange={(e) => setFilaEv(i, 'objetivo', e.target.value)} /></td>
                          <td data-label="Responsable"><input value={a.responsable || ''} onChange={(e) => setFilaEv(i, 'responsable', e.target.value)} /></td>
                        </>
                      ) : (
                        <>
                          <td data-label="Fecha">{a.fecha ? formatoFecha(a.fecha) : '—'}</td>
                          <td data-label="Actividad"><strong>{a.actividad}</strong></td>
                          <td data-label="Objetivo">{a.objetivo || '—'}</td>
                          <td data-label="Responsable">{a.responsable || '—'}</td>
                        </>
                      )}
                      <td data-label="Evaluación (*)">
                        <div className="evbtns" role="group" aria-label={`Evaluación de ${a.actividad}`}>
                          {EVALUACION.map((o) => (
                            <button key={o.v} type="button" title={o.l} aria-pressed={a.eval === o.v} className={`evbtn v${o.v}${a.eval === o.v ? ' on' : ''}`}
                              onClick={() => setF((x) => ({ ...x, evaluacion: { ...x.evaluacion, actividades: x.evaluacion.actividades.map((r, j) => (j === i ? { ...r, eval: r.eval === o.v ? '' : o.v } : r)) } }))}>{o.v}</button>
                          ))}
                        </div>
                      </td>
                      <td data-label="Observaciones"><input value={a.obs || ''} onChange={(e) => setFilaEv(i, 'obs', e.target.value)} /></td>
                      <td>{a.manual && <button type="button" className="btn small quiet" onClick={() => setEv('actividades', f.evaluacion.actividades.filter((_, j) => j !== i))}>✕ Quitar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="row" style={{ marginTop: 6 }}>
            <button type="button" className="btn small" onClick={() => setEv('actividades', [...f.evaluacion.actividades, { fecha: '', actividad: '', objetivo: '', responsable: '', eval: '', obs: '', manual: true }])}>+ Agregar actividad no programada</button>
            {anterior && <button type="button" className="btn small quiet" onClick={recargarEvaluacion}>↻ Actualizar desde el cronograma anterior</button>}
          </div>
          {f.evaluacion.actividades.length > 0 && (
            <p className="muted" style={{ marginTop: 8 }}>
              Evaluadas {evaluadas} de {f.evaluacion.actividades.length} · Cumplidas {conteoEv[0]} · Parcialmente {conteoEv[1]} · No se cumplieron {conteoEv[2]}
              {evaluadas > 0 && <> · <strong>Cumplimiento {Math.round(((conteoEv[0] + conteoEv[1] * 0.5) / evaluadas) * 100)} %</strong></>}
            </p>
          )}

          <h3 style={{ marginTop: 18 }}>Diagnóstico del ciclo anterior</h3>
          {anterior && (anterior.objetivoGeneral || anterior.objetivosEspecificos) && (
            <div className="contexto-prev">
              <strong>Lo que se propuso en {etiquetaCiclo(anterior)}</strong>
              {anterior.objetivoGeneral && <p className="pre"><b>Objetivo general:</b> {anterior.objetivoGeneral}</p>}
              {anterior.objetivosEspecificos && <p className="pre"><b>Objetivos específicos:</b> {anterior.objetivosEspecificos}</p>}
            </div>
          )}
          <div className="form">
            <label>1. Logro del objetivo propuesto en el ciclo anterior
              <select value={f.evaluacion.logro} onChange={(e) => setEv('logro', e.target.value)}>
                <option value="">—</option><option value="si">Sí</option><option value="parcial">Parcial</option><option value="no">No</option>
              </select>
            </label>
            <label>Detalle<input value={f.evaluacion.logroDetalle} onChange={(e) => setEv('logroDetalle', e.target.value)} /></label>
            <label>2. Logro de los objetivos específicos en el ciclo anterior
              <select value={f.evaluacion.logroEspecificosEstado || ''} onChange={(e) => setEv('logroEspecificosEstado', e.target.value)}>
                <option value="">—</option><option value="si">Sí</option><option value="parcial">Parcial</option><option value="no">No</option>
              </select>
            </label>
            <label>Detalle<input value={f.evaluacion.logroEspecificos} onChange={(e) => setEv('logroEspecificos', e.target.value)} /></label>
            <label className="full">3. ¿Cuál actividad LES GUSTÓ y por qué?<textarea rows={3} value={f.evaluacion.gusto} onChange={(e) => setEv('gusto', e.target.value)} /></label>
            <label className="full">4. ¿Cuál actividad NO LES GUSTÓ y por qué?<textarea rows={3} value={f.evaluacion.noGusto} onChange={(e) => setEv('noGusto', e.target.value)} /></label>
          </div>
        </>
      )}

      {seccion === 'seguimiento' && (
        <>
          <h3>Seguimiento de la progresión personal para el siguiente ciclo</h3>
          <p className="muted">Se carga con los protagonistas activos de «Expedientes». Marcá las áreas de crecimiento a trabajar con cada uno.</p>
          {filas.length === 0 ? <p className="empty">No hay protagonistas activos. Registralos en «Expedientes».</p> : (
            <>
              <div className="table-wrap">
                <table className="table editable prog">
                  <thead>
                    <tr><th>#</th><th>Nombre</th><th>Etapa</th><th>Actividades propuestas</th>{AREAS.map((a) => <th key={a.key} className="c">{a.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filas.map((p, i) => {
                      const pr = f.progresion[p.id] || {};
                      return (
                        <tr key={p.id}>
                          <td data-label="#">{i + 1}</td>
                          <td data-label="Nombre"><strong>{nombreDe(p)}</strong></td>
                          <td data-label="Etapa">{selectEtapa(p, pr)}</td>
                          <td data-label="Actividades propuestas"><input value={pr.actividades || ''} onChange={(e) => setProg(p.id, { actividades: e.target.value })} /></td>
                          {celdasAreas(p, pr)}
                        </tr>
                      );
                    })}
                    {totalesFila(4, 0)}
                  </tbody>
                </table>
              </div>
              <Enfasis tot={tot} />
            </>
          )}
        </>
      )}

      {seccion === 'traspasos' && (
        <>
          <h3>Traspasos y ceremonias que deben incluirse en el cronograma del siguiente ciclo</h3>
          <TablaEditable
            columnas={[{ key: 'nombre', label: 'Nombre', min: 160 }, { key: 'actividad', label: 'Actividad (traspaso o ceremonia)', min: 240 }, { key: 'observaciones', label: 'Observaciones', min: 200 }]}
            filas={f.traspasos} onChange={(v) => set('traspasos', v)} agregar="Agregar traspaso o ceremonia"
            acciones={f.traspasos.length > 0 && <button type="button" className="btn small" onClick={traspasosAlCronograma}>Incluir en el cronograma →</button>} />
          {mensaje && <p className="ok" role="status">{mensaje}</p>}
          <p className="muted">Estos traspasos y ceremonias deben tomarse en cuenta en el cronograma del siguiente ciclo.</p>
        </>
      )}

      {seccion === 'propuesta' && (
        <>
          <h3>Propuesta y selección de actividades</h3>
          <p><strong>Ciclo número:</strong> {f.numero} &nbsp; <strong>Año:</strong> {f.anio} &nbsp; <strong>Período:</strong> {formatoFecha(f.inicio)} – {f.fin ? formatoFecha(f.fin) : '—'}</p>
          <h3 style={{ marginTop: 14 }}>Objetivos del equipo (patrulla)</h3>
          {patrullas.some((p) => !f.equipos.some((e) => e.patrullaId === p.id)) && (
            <button type="button" className="btn small" onClick={cargarPatrullas} style={{ marginBottom: 8 }}>
              {f.equipos.length ? 'Agregar las patrullas que faltan' : 'Cargar mis patrullas'}
            </button>
          )}
          <TablaEditable
            columnas={[{ key: 'nombre', label: 'Nombre de equipo / patrulla', min: 140 }, { key: 'general', label: 'Objetivo general', tipo: 'textarea', min: 240 }, { key: 'especificos', label: 'Objetivos específicos', tipo: 'textarea', min: 280 }]}
            filas={f.equipos} onChange={(v) => set('equipos', v)} agregar="Agregar equipo" />
        </>
      )}

      {seccion === 'objetivos' && (
        <>
          <h3>Objetivo general y objetivos específicos del nuevo ciclo</h3>
          <div className="form">
            <label className="full">Objetivo general<textarea rows={7} value={f.objetivoGeneral} onChange={(e) => set('objetivoGeneral', e.target.value)} /></label>
            <label className="full">Objetivos específicos<textarea rows={9} value={f.objetivosEspecificos} onChange={(e) => set('objetivosEspecificos', e.target.value)} /></label>
          </div>
        </>
      )}

      {seccion === 'cronograma' && (
        <>
          <h3>Cronograma del nuevo ciclo</h3>
          <p className="muted">
            ✱ Recordá incluir todas las actividades del calendario nacional, internacional y mundial, cumpleaños, ceremonias, traspasos,
            reunión de padres, reuniones regulares de la sección, actividades seleccionadas por los chicos, aniversarios, entre otros.
          </p>
          <TablaEditable
            columnas={[{ key: 'fecha', label: 'Fecha', tipo: 'date', min: 140 }, { key: 'actividad', label: 'Actividad', min: 220 }, { key: 'objetivo', label: 'Objetivo', min: 220 }, { key: 'responsable', label: 'Responsable', min: 130 }]}
            filas={f.cronograma} onChange={(v) => set('cronograma', v)} agregar="Agregar actividad"
            acciones={f.cronograma.length > 1 && (
              <button type="button" className="btn small quiet" onClick={() => set('cronograma', [...f.cronograma].sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999')))}>Ordenar por fecha</button>
            )} />
          <p className="muted">{f.cronograma.length} {f.cronograma.length === 1 ? 'actividad' : 'actividades'}. Podés agregar, quitar y reordenar filas; si pasan de 30, el PDF oficial suma hojas adicionales.</p>
          <div className="form" style={{ marginTop: 12 }}>
            <label className="full">Nombre y firma del (los) coordinadores de la sección<input value={f.coordinadores} onChange={(e) => set('coordinadores', e.target.value)} /></label>
          </div>
        </>
      )}

      {seccion === 'proyeccion' && (
        <>
          <h3>Proyección de la progresión personal — para dirigente de sección</h3>
          <p className="muted">Marcá las áreas a trabajar de cada miembro. Nombre, ingreso, edad y etapa actual se cargan solos desde los expedientes; las marcas son las mismas del seguimiento.</p>
          {filas.length === 0 ? <p className="empty">No hay protagonistas activos. Registralos en «Expedientes».</p> : (
            <>
              <div className="table-wrap">
                <table className="table editable prog">
                  <thead>
                    <tr><th>#</th><th>Nombre</th><th>Fecha de ingreso (mes/año)</th><th>Edad</th><th>Etapa actual</th><th>Etapa en el ciclo</th>
                      {AREAS.map((a) => <th key={a.key} className="c">{a.label}</th>)}<th>Servicio</th><th>Actividades propuestas</th><th>Otras</th></tr>
                  </thead>
                  <tbody>
                    {filas.map((p, i) => {
                      const pr = f.progresion[p.id] || {};
                      return (
                        <tr key={p.id}>
                          <td data-label="#">{i + 1}</td>
                          <td data-label="Nombre"><strong>{nombreDe(p)}</strong></td>
                          <td data-label="Fecha de ingreso (mes/año)">{mesAnio(p.fechaIngreso)}</td>
                          <td data-label="Edad">{edad(p.fechaNacimiento) ?? '—'}</td>
                          <td data-label="Etapa actual">{p.etapa}</td>
                          <td data-label="Etapa en el ciclo">{selectEtapa(p, pr)}</td>
                          {celdasAreas(p, pr)}
                          <td data-label="Servicio"><input value={pr.servicio || ''} onChange={(e) => setProg(p.id, { servicio: e.target.value })} /></td>
                          <td data-label="Actividades propuestas"><input value={pr.actividades || ''} onChange={(e) => setProg(p.id, { actividades: e.target.value })} /></td>
                          <td data-label="Otras"><input value={pr.otras || ''} onChange={(e) => setProg(p.id, { otras: e.target.value })} /></td>
                        </tr>
                      );
                    })}
                    {totalesFila(6, 3)}
                  </tbody>
                </table>
              </div>
              <Enfasis tot={tot} />
            </>
          )}
        </>
      )}

      {seccion === 'junta' && (
        <>
          <h3>Resumen de membresía</h3>
          <p className="muted">Se calcula con los expedientes durante la vigencia del ciclo. Podés corregir cualquier número; «Recalcular» vuelve a los valores automáticos.</p>
          <div className="form">
            <label># Nuevos ingresos / juveniles
              <input type="number" min={0} value={valorMem('nuevos')} onChange={(e) => setMem('nuevos', e.target.value)} />
              <span className="muted">Automático: {auto.nuevos} (ingresaron entre {formatoFecha(f.inicio)} y {f.fin ? formatoFecha(f.fin) : 'hoy'})</span>
            </label>
            <label># Partida de miembros
              <input type="number" min={0} value={valorMem('partidas')} onChange={(e) => setMem('partidas', e.target.value)} />
              <span className="muted">Automático: {auto.partidas} (inactivos con fecha de salida en el ciclo)</span>
            </label>
            <label>Total de miembros activos
              <input value={auto.activos} disabled />
              <span className="muted">Protagonistas activos en este momento</span>
            </label>
            <label># de dirigentes de la sección
              <input type="number" min={0} value={valorMem('dirigentes')} onChange={(e) => setMem('dirigentes', e.target.value)} />
              <span className="muted">Automático: {auto.dirigentes} (dirigentes activos del grupo)</span>
            </label>
          </div>
          <div className="row" style={{ margin: '8px 0' }}>
            <button type="button" className="btn small" onClick={() => setF((x) => ({ ...x, membresia: { ...x.membresia, nuevos: '', partidas: '', dirigentes: '' } }))}>↺ Recalcular automático</button>
          </div>
          <div className="form">
            <label className="full">¿Sabe por qué se dio la deserción? (indicar el motivo)
              <textarea rows={3} value={f.membresia.desercion} onChange={(e) => setMem('desercion', e.target.value)} />
            </label>
          </div>
          {salidas.some((p) => p.motivoSalida) && (
            <button type="button" className="btn small" onClick={() => setMem('desercion', salidas.filter((p) => p.motivoSalida).map((p) => `${nombreDe(p)}: ${p.motivoSalida}`).join('\n'))}>
              Usar los motivos registrados en los expedientes
            </button>
          )}

          <h3 style={{ marginTop: 18 }}>Solicitudes importantes a la Junta de Grupo (transporte / materiales)</h3>
          <textarea rows={7} style={{ width: '100%' }} value={f.solicitudes} onChange={(e) => set('solicitudes', e.target.value)} />
          <p className="muted" style={{ marginTop: 8 }}>
            Nombre y firma del (los) dirigentes: {miembros.filter((m) => m.estado === 'activo').map((m) => m.nombre || m.email).join(' · ') || '—'}
          </p>
        </>
      )}

      {seccion === 'resultados' && c && (
        <>
          <p className="muted">{formatoFecha(c.inicio)} – {c.fin ? formatoFecha(c.fin) : 'en curso'} · {reuniones.filter((r) => r.cicloId === c.id).length} reuniones</p>
          <div className="table-wrap">
            <table className="table cards-movil">
              <thead><tr><th>#</th><th>Patrulla</th>{CRITERIOS.map((k) => <th key={k.key}>{k.label}</th>)}<th>Lugares</th><th>Asistencia</th><th>Inspección</th>{CATEGORIAS.map((k) => <th key={k.key}>{k.label}</th>)}<th>Extra</th><th>Total</th></tr></thead>
              <tbody>
                {tabla.map((p, i) => (
                  <tr key={p.id}>
                    <td className="oculto-movil">{i === 0 && p.total > 0 ? '🏆' : i + 1}</td>
                    <td className="titulo" data-label="Patrulla">{i === 0 && p.total > 0 ? '🏆 ' : `${i + 1}. `}<span className="dot" style={{ background: p.color }} /> <strong>{p.nombre}</strong></td>
                    {CRITERIOS.map((k) => <td key={k.key} data-label={k.label}>{p.crit[k.key]}</td>)}
                    <td data-label="Lugares">{p.lugar}</td><td data-label="Asistencia">{p.asistencia}</td><td data-label="Inspección">{p.inspeccion}</td>
                    {CATEGORIAS.map((k) => <td key={k.key} data-label={k.label}>{p.general[k.key]}</td>)}
                    <td data-label="Extra" className={p.extra >= 0 ? 'pos-num' : 'neg-num'}>{p.extra > 0 ? '+' : ''}{p.extra}</td>
                    <td data-label="Total"><strong className="pts-grande">{p.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <label className="terminado"><input type="checkbox" checked={!!f.terminado} onChange={(e) => set('terminado', e.target.checked)} /> Marcar el ciclo como terminado (deja de aparecer el recordatorio en el Inicio)</label>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar ciclo'}</button>
        <button type="button" className="btn" onClick={() => setVista(true)}>Ver / imprimir documento</button>
        <button type="button" className="btn" onClick={generarPdf} disabled={generando}>{generando ? 'Generando PDF…' : '⬇ Generar PDF oficial'}</button>
      </div>
    </form>
  );
}
