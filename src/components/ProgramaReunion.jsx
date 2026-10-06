import { ESTANDAR, fechaLarga, horaCorta, TIPOS_ACTIVIDAD } from '../lib/etapas';

const tipoL = (v) => (ESTANDAR.includes(v) ? '' : TIPOS_ACTIVIDAD.find((t) => t.v === v)?.l);
const porHora = (a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99');

// Vista del «Programa de reunión» con el formato del documento de la Tropa (imprimible).
export default function ProgramaReunion({ r }) {
  const acts = [...(r.actividades || [])].sort(porHora);
  const detalle = acts.filter((a) => !ESTANDAR.includes(a.tipo)).filter((a) => a.montaje || a.dinamica || a.variante || a.reto);
  const rango = r.horaInicio ? `${horaCorta(r.horaInicio)}${r.horaFin ? ` a ${horaCorta(r.horaFin)}` : ''}` : '';
  return (
    <article className="doc">
      <h1>PROGRAMA DE REUNIÓN — TROPA</h1>
      <p><b>Lugar:</b> {r.lugar}</p>
      <p><b>Fecha:</b> {fechaLarga(r.fecha)}</p>
      <p><b>Hora:</b> {rango}</p>
      <p><b>Encargado:</b> {r.encargado}</p>
      <p><b>Participantes:</b> {r.participantes}</p>
      <p><b>Objetivo:</b> {r.objetivo}</p>
      <p><b>Fondo motivador:</b> {r.fondo}</p>

      <table className="doc-tabla">
        <thead><tr><th>Hora</th><th>Actividad</th><th>Materiales</th><th>Encargado</th></tr></thead>
        <tbody>
          {acts.map((a, i) => (
            <tr key={i}><td>{horaCorta(a.hora)}</td><td>{a.actividad}{tipoL(a.tipo) && <small className="tipo-doc"> · {tipoL(a.tipo)}</small>}</td><td>{a.materiales || '—'}</td><td>{a.encargado}</td></tr>
          ))}
        </tbody>
      </table>

      {detalle.length > 0 && <h2>Ayuda al programa</h2>}
      {detalle.map((a, i) => (
        <section key={i} className="doc-act">
          <h3>{a.actividad}</h3>
          {a.materiales && <p><b>Materiales:</b> {a.materiales}</p>}
          {a.montaje && <p><b>Montaje:</b> {a.montaje}</p>}
          {a.dinamica && <p><b>La dinámica:</b> {a.dinamica}</p>}
          {a.variante && <p><b>Variante:</b> {a.variante}</p>}
          {a.reto && <p><b>El reto:</b> {a.reto}</p>}
        </section>
      ))}

      {(r.impresos || r.otrosMateriales) && (
        <>
          <h2>INSUMOS PARA IMPRIMIR</h2>
          {r.impresos && <p><b>Lista de impresos:</b> {r.impresos}</p>}
          {r.otrosMateriales && <p><b>Otros materiales:</b> {r.otrosMateriales}</p>}
        </>
      )}

      {(r.anexos || []).map((a, i) => (
        <section key={i} className="doc-anexo">
          <h2>{a.titulo || `Anexo ${String.fromCharCode(65 + i)}`}</h2>
          <p className="pre">{a.texto}</p>
        </section>
      ))}
    </article>
  );
}
