import { AREAS, edad, ETAPAS, formatoFecha } from '../lib/etapas';

const marca = (b) => (b ? 'X' : '');
export const filasProgresion = (protagonistas) =>
  protagonistas.filter((p) => p.activo !== false)
    .sort((a, b) => `${a.nombre} ${a.apellidos}`.localeCompare(`${b.nombre} ${b.apellidos}`));

export function totalesAreas(filas, progresion) {
  return Object.fromEntries(AREAS.map((a) => [a.key, filas.filter((p) => progresion?.[p.id]?.areas?.[a.key]).length]));
}

// Vista del «Ciclo de Programa» con el formato de la guía de la Asociación (imprimible).
export default function CicloDocumento({ c, protagonistas, patrullas, grupo }) {
  const filas = filasProgresion(protagonistas);
  const tot = totalesAreas(filas, c.progresion);
  const mayor = Math.max(0, ...Object.values(tot));
  const enfasis = mayor > 0 ? AREAS.filter((a) => tot[a.key] === mayor).map((a) => a.label).join(', ') : '—';
  const ev = c.evaluacion || {};
  const m = c.membresia || {};
  const activos = filas.length;
  return (
    <article className="doc">
      <h1>CICLO DE PROGRAMA</h1>
      <p><b>Sección:</b> Manada ( ) Tropa (X) Wak ( ) Comunidad ( )</p>
      <p><b>Nombre de la Sección:</b> {c.nombreSeccion} {grupo ? `· Grupo ${grupo.numero}, ${grupo.localidad}` : ''}</p>
      <p><b>Fecha:</b> {formatoFecha(c.fecha)} &nbsp; <b>Ciclo número:</b> {c.numero} &nbsp; <b>Año:</b> {c.anio}</p>
      <p><b>Rige desde:</b> {formatoFecha(c.inicio)} &nbsp; <b>Rige hasta:</b> {c.fin ? formatoFecha(c.fin) : '—'}</p>
      <p><b>Fondo motivador (tema):</b> {c.nombre}</p>

      <h2>Evaluación de Actividades</h2>
      <p className="muted-print">(*) 3. Cumplido · 2. Parcialmente cumplido · 1. No cumplido</p>
      <table className="doc-tabla">
        <thead><tr><th>Fecha</th><th>Actividad</th><th>Objetivo</th><th>Responsable</th><th>(*)</th><th>Observaciones / Aspectos a mejorar</th></tr></thead>
        <tbody>{(ev.actividades || []).map((a, i) => (
          <tr key={i}><td>{formatoFecha(a.fecha)}</td><td>{a.actividad}</td><td>{a.objetivo}</td><td>{a.responsable}</td><td>{a.eval}</td><td>{a.obs}</td></tr>
        ))}</tbody>
      </table>
      <p><b>Logro del Objetivo propuesto en el Ciclo anterior:</b> SI ({ev.logro === 'si' ? 'X' : ' '}) NO ({ev.logro === 'no' ? 'X' : ' '}) PARCIAL ({ev.logro === 'parcial' ? 'X' : ' '}) <b>Detalle:</b> {ev.logroDetalle}</p>
      <p><b>Logro de los Objetivos específicos en el Ciclo anterior:</b> SI ({ev.logroEspecificosEstado === 'si' ? 'X' : ' '}) NO ({ev.logroEspecificosEstado === 'no' ? 'X' : ' '}) PARCIAL ({ev.logroEspecificosEstado === 'parcial' ? 'X' : ' '}) <b>Detalle:</b> {ev.logroEspecificos}</p>

      <h2>Diagnóstico</h2>
      <p><b>¿Cuál actividad LES GUSTÓ y por qué?</b> {ev.gusto}</p>
      <p><b>¿Cuál actividad NO LES GUSTÓ y por qué?</b> {ev.noGusto}</p>

      <h2>Proyección de la Progresión Personal</h2>
      <table className="doc-tabla chica">
        <thead><tr><th>#</th><th>Nombre</th><th>Ingreso</th><th>Edad</th><th>Etapa actual</th><th>Etapa en ciclo</th>
          {AREAS.map((a) => <th key={a.key}>{a.label}</th>)}<th>Actividades propuestas</th><th>Otras</th></tr></thead>
        <tbody>
          {filas.map((p, i) => {
            const pr = c.progresion?.[p.id] || {};
            return (
              <tr key={p.id}>
                <td>{i + 1}</td><td>{p.nombre} {p.apellidos}</td><td>{formatoFecha(p.fechaIngreso)}</td><td>{edad(p.fechaNacimiento) ?? ''}</td>
                <td>{p.etapa}</td><td>{pr.etapaCiclo || p.etapa}</td>
                {AREAS.map((a) => <td key={a.key} className="c">{marca(pr.areas?.[a.key])}</td>)}
                <td>{pr.actividades}</td><td>{pr.otras}</td>
              </tr>
            );
          })}
          <tr><td colSpan={6}><b>Total</b></td>{AREAS.map((a) => <td key={a.key} className="c"><b>{tot[a.key]}</b></td>)}<td colSpan={2} /></tr>
        </tbody>
      </table>
      <p><b>Énfasis del ciclo</b> (las áreas de mayor puntaje): {enfasis}</p>

      <h2>Traspasos o Ceremonias para el Siguiente Ciclo</h2>
      <table className="doc-tabla">
        <thead><tr><th>Nombre</th><th>Actividad (traspaso o ceremonia)</th><th>Observaciones</th></tr></thead>
        <tbody>{(c.traspasos || []).map((t, i) => <tr key={i}><td>{t.nombre}</td><td>{t.actividad}</td><td>{t.observaciones}</td></tr>)}</tbody>
      </table>

      <h2>Propuesta y selección de actividades</h2>
      <p><b>Ciclo número:</b> {c.numero} &nbsp; <b>Año:</b> {c.anio} &nbsp; <b>Período:</b> {formatoFecha(c.inicio)} – {c.fin ? formatoFecha(c.fin) : '—'}</p>
      <h3>Objetivos de equipo (patrullas)</h3>
      <table className="doc-tabla">
        <thead><tr><th>Nombre de equipo</th><th>Objetivo general</th><th>Objetivos específicos</th></tr></thead>
        <tbody>{(c.equipos || []).map((e, i) => <tr key={i}><td>{e.nombre || patrullas.find((p) => p.id === e.patrullaId)?.nombre}</td><td>{e.general}</td><td className="pre">{e.especificos}</td></tr>)}</tbody>
      </table>
      <h3>Objetivo general</h3><p className="pre">{c.objetivoGeneral}</p>
      <h3>Objetivos específicos</h3><p className="pre">{c.objetivosEspecificos}</p>

      <h2>Cronograma</h2>
      <table className="doc-tabla">
        <thead><tr><th>Fecha</th><th>Actividad</th><th>Objetivo</th><th>Responsable</th></tr></thead>
        <tbody>{(c.cronograma || []).map((a, i) => <tr key={i}><td>{formatoFecha(a.fecha)}</td><td>{a.actividad}</td><td>{a.objetivo}</td><td>{a.responsable}</td></tr>)}</tbody>
      </table>
      <p className="firma">Nombre y firma del (los) coordinadores de la sección: {c.coordinadores}<span /></p>

      <h2>Resumen de Membresía</h2>
      <table className="doc-tabla">
        <thead><tr><th># Nuevos ingresos / juveniles</th><th># Partida de miembros</th><th># de dirigentes de la sección</th><th>Total de miembros activos</th></tr></thead>
        <tbody><tr><td>{m.nuevos}</td><td>{m.partidas}</td><td>{m.dirigentes}</td><td>{activos}</td></tr></tbody>
      </table>
      <p><b>¿Sabe por qué se dio la deserción? (indicar el motivo):</b> {m.desercion}</p>

      <h2>Solicitudes importantes a la Junta de Grupo</h2>
      <p className="pre">{c.solicitudes}</p>
      <p className="firma">Nombre y firma del (los) dirigente(s): <span /></p>
    </article>
  );
}
