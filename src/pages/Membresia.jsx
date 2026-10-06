import { useMemo, useState } from 'react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useCollection } from '../lib/useCollection';
import { useGrupo } from '../lib/grupo.jsx';
import { leerLibroXlsx } from '../lib/leerXlsx.js';
import { parsearLibro, soloDigitos } from '../lib/informeGrupo.js';
import { CHEQUEOS_EXPEDIENTE, edad, ETAPAS, faltantesExpediente, formatoFecha } from '../lib/etapas.js';

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Expediente nuevo con lo que trae el informe; el resto queda por completar
const expedienteDesdeInforme = (m, origen) => ({
  nombre: m.nombre, apellidos: m.apellidos, fechaNacimiento: m.fechaNacimiento, cedula: m.cedula, correo: m.correo,
  patrullaId: '', cargo: 'Integrante', etapa: ETAPAS[0], etapaConfirmada: false, fechaIngreso: '', fechaInicioEtapa: '',
  encargado: { nombre: '', telefono: '', parentesco: '' },
  medico: { tipoSangre: '', alergias: '', sinAlergias: false, condiciones: '', medicamentos: '' },
  notas: '', activo: true, promesado: false, fechaPromesa: '', fechaSalida: '', motivoSalida: '', historialEtapas: [],
  cargoAsociacion: m.cargoAsociacion, origen,
});

export default function Membresia({ irAExpediente }) {
  const { col, ref, grupo } = useGrupo();
  const { docs: protagonistas } = useCollection('protagonistas', 'nombre');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const [analisis, setAnalisis] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState('');

  const activos = protagonistas.filter((p) => p.activo !== false);
  const pendientes = useMemo(
    () => activos.map((p) => ({ p, falta: faltantesExpediente(p) })).filter((x) => x.falta.length).sort((a, b) => b.falta.length - a.falta.length),
    [activos]
  );

  const marcarDuplicado = (m) => {
    const ced = soloDigitos(m.cedula);
    const nom = norm(`${m.nombre} ${m.apellidos}`);
    const dup = protagonistas.find((p) => (ced && soloDigitos(p.cedula) === ced)
      || (norm(`${p.nombre} ${p.apellidos}`) === nom && m.fechaNacimiento && p.fechaNacimiento === m.fechaNacimiento));
    return dup ? dup.id : '';
  };

  const importar = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setLeyendo(true); setError(''); setResultado(''); setAnalisis(null);
    try {
      if (archivo.name.startsWith('~$') || archivo.size < 2000) throw new Error('Ese archivo es temporal o está vacío (los que empiezan con «~$» los crea Excel mientras el informe está abierto). Cerrá Excel y elegí el informe real.');
      const inf = parsearLibro(await leerLibroXlsx(await archivo.arrayBuffer()));
      setAnalisis({ ...inf, archivo: archivo.name, miembros: inf.miembros.map((m) => { const dup = marcarDuplicado(m); return { ...m, dup, incluir: !dup }; }) });
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo.');
    } finally { setLeyendo(false); }
  };

  const setMiembro = (i, cambios) => setAnalisis((a) => ({ ...a, miembros: a.miembros.map((m, j) => (j === i ? { ...m, ...cambios } : m)) }));

  const crear = async () => {
    const lista = analisis.miembros.filter((m) => m.incluir && !m.dup && m.nombre.trim());
    if (!lista.length) return;
    setCreando(true); setError('');
    try {
      const batch = writeBatch(db);
      const origen = `informe Asociación ${analisis.fechaInforme || ''}`.trim();
      lista.forEach((m) => batch.set(doc(col('protagonistas')), expedienteDesdeInforme(m, origen)));
      await batch.commit();
      setResultado(`Se crearon ${lista.length} expediente(s). Ya puedes completarlos abajo.`);
      setAnalisis(null);
    } catch (err) {
      setError(`No se pudieron crear los expedientes (${err.code || err.message}).`);
    } finally { setCreando(false); }
  };

  const actualizar = (id, cambios) => updateDoc(ref('protagonistas', id), cambios);
  const nuevos = analisis ? analisis.miembros.filter((m) => m.incluir && !m.dup).length : 0;
  const completos = activos.length - pendientes.length;

  return (
    <>
      <div className="grid stats">
        <div className="card stat"><div className="n">{activos.length}</div><div className="l">Protagonistas activos</div></div>
        <div className="card stat"><div className="n">{completos}</div><div className="l">Expedientes completos</div></div>
        <div className="card stat"><div className="n">{pendientes.length}</div><div className="l">Por completar</div></div>
        <div className="card stat"><div className="n">{activos.filter((p) => !p.patrullaId).length}</div><div className="l">Sin patrulla</div></div>
      </div>

      <div className="card leyenda">
        <h2>Importar la membresía del informe de la Asociación</h2>
        <p>
          Subí el <strong>«Reporte detalle por Grupo»</strong> (Excel). El sistema toma solo a los miembros de la <strong>Sección Tropa</strong>,
          te los muestra para revisar y crea sus expedientes con nombre, cédula, fecha de nacimiento y correo. Lo demás queda marcado para completar.
        </p>
        <p className="muted">El archivo se lee en tu navegador: no se sube a ningún servidor. Los miembros que ya tienen expediente se omiten.</p>
        <div className="row">
          <label className="btn primary" style={{ cursor: 'pointer', margin: 0 }}>
            {leyendo ? 'Leyendo el informe…' : '⬆ Subir informe (Excel)'}
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importar} disabled={leyendo} hidden />
          </label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {resultado && <p className="ok" role="status">{resultado}</p>}
      </div>

      {analisis && (
        <div className="card">
          <h2>Revisá antes de crear</h2>
          <p className="muted">
            {analisis.archivo} · Grupo {analisis.grupo || '—'}{analisis.fechaInforme ? ` · ${analisis.fechaInforme}` : ''} ·
            {' '}<strong>{analisis.miembros.length}</strong> de la Sección Tropa{analisis.dirigentes ? ` (los ${analisis.dirigentes} dirigentes de Tropa no se importan como protagonistas)` : ''}.
          </p>
          {analisis.grupo && grupo?.numero && String(analisis.grupo).trim() !== String(grupo.numero).trim() && (
            <p className="alert alta">El informe es del grupo {analisis.grupo}, pero tu grupo es el {grupo.numero}. Verificá que sea el archivo correcto.</p>
          )}
          {analisis.miembros.length === 0 ? <p className="empty">No encontré miembros de la Sección Tropa en el informe.</p> : (
            <>
              <div className="table-wrap">
                <table className="table editable cards-movil">
                  <thead><tr><th aria-label="Incluir" /><th>Nombre</th><th>Apellidos</th><th>Cédula</th><th>Nacimiento</th><th>Correo</th><th>Estado</th></tr></thead>
                  <tbody>
                    {analisis.miembros.map((m, i) => (
                      <tr key={i} style={m.dup ? { opacity: 0.6 } : null}>
                        <td data-label="Incluir"><input type="checkbox" checked={m.incluir && !m.dup} disabled={!!m.dup} onChange={(e) => setMiembro(i, { incluir: e.target.checked })} aria-label={`Incluir a ${m.nombre}`} /></td>
                        <td data-label="Nombre"><input value={m.nombre} onChange={(e) => setMiembro(i, { nombre: e.target.value })} disabled={!!m.dup} /></td>
                        <td data-label="Apellidos"><input value={m.apellidos} onChange={(e) => setMiembro(i, { apellidos: e.target.value })} disabled={!!m.dup} /></td>
                        <td data-label="Cédula">{m.cedula || '—'}</td>
                        <td data-label="Nacimiento">{m.fechaNacimiento ? `${formatoFecha(m.fechaNacimiento)} · ${edad(m.fechaNacimiento)} años` : '—'}</td>
                        <td data-label="Correo">{m.correo || '—'}</td>
                        <td data-label="Estado">{m.dup ? <span className="badge">Ya tiene expediente</span> : <span className="badge media">Nuevo</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">Los nombres vienen en mayúsculas y sin separar: revisá que el nombre y los apellidos estén bien divididos.</p>
              <div className="row">
                <button className="btn agregar" onClick={crear} disabled={creando || nuevos === 0}>
                  <span className="mas" aria-hidden="true">＋</span> {creando ? 'Creando…' : `Crear ${nuevos} expediente(s)`}
                </button>
                <button className="btn" onClick={() => setAnalisis(null)}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2>Expedientes por completar</h2>
        {activos.length === 0 && <p className="empty">Todavía no hay protagonistas. Subí el informe de la Asociación para crearlos.</p>}
        {activos.length > 0 && pendientes.length === 0 && <p className="ok">¡Todos los expedientes están completos!</p>}
        {pendientes.length > 0 && (
          <>
            <p className="muted">Asignales patrulla y etapa aquí mismo; el resto (encargado, ficha médica, fechas) se completa en el expediente.</p>
            <div className="table-wrap">
              <table className="table editable cards-movil">
                <thead><tr><th>Protagonista</th><th>Edad</th><th>Patrulla</th><th>Etapa</th><th>Falta</th><th aria-label="Abrir" /></tr></thead>
                <tbody>
                  {pendientes.map(({ p, falta }) => (
                    <tr key={p.id}>
                      <td className="titulo" data-label="Protagonista"><strong>{p.nombre} {p.apellidos}</strong></td>
                      <td data-label="Edad">{edad(p.fechaNacimiento) ?? '—'}</td>
                      <td data-label="Patrulla">
                        <select value={p.patrullaId || ''} onChange={(e) => actualizar(p.id, { patrullaId: e.target.value })} aria-label={`Patrulla de ${p.nombre}`}>
                          <option value="">— Elegir —</option>
                          {patrullas.map((pa) => <option key={pa.id} value={pa.id}>{pa.nombre}</option>)}
                        </select>
                      </td>
                      <td data-label="Etapa">
                        <select value={p.etapa} onChange={(e) => actualizar(p.id, { etapa: e.target.value, etapaConfirmada: true })} aria-label={`Etapa de ${p.nombre}`}>
                          {ETAPAS.map((x) => <option key={x}>{x}</option>)}
                        </select>
                        {p.etapaConfirmada === false && <span className="muted"> por confirmar</span>}
                      </td>
                      <td className="completo" data-label={`Falta (${falta.length} de ${CHEQUEOS_EXPEDIENTE.length})`}>
                        <div className="chips-falta">{falta.map((x) => <span key={x.k} className="chip">{x.etiqueta}</span>)}</div>
                      </td>
                      <td className="acciones"><button className="btn accion" onClick={() => irAExpediente?.(p.id)}>Completar →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
