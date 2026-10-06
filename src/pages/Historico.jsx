import { useMemo, useState } from 'react';
import { updateDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useConfig } from '../lib/useConfig';
import { useGrupo } from '../lib/grupo.jsx';
import { CATEGORIAS, CRITERIOS, etiquetaCiclo, formatoFecha, hoyISO } from '../lib/etapas.js';
import { cicloVigente, resultadoCiclo } from '../lib/puntajes.js';

const MEDALLAS = ['🥇', '🥈', '🥉'];

function Ranking({ res }) {
  const max = Math.max(1, ...res.patrullas.map((p) => p.total));
  return res.patrullas.map((p, i) => (
    <div className="rank" key={p.id}>
      <div className="pos">{p.total > 0 && i < 3 ? MEDALLAS[i] : i + 1}</div>
      <div style={{ flex: 1 }}>
        <div className="row between"><strong><span className="dot" style={{ background: p.color }} />{p.nombre}</strong><span className="pts">{p.total}</span></div>
        <div className="bar"><span style={{ width: `${(Math.max(0, p.total) / max) * 100}%`, background: p.color || undefined }} /></div>
      </div>
    </div>
  ));
}

function Desglose({ res }) {
  return (
    <details className="desglose">
      <summary>Ver el desglose por criterio</summary>
      <div className="table-wrap">
        <table className="table cards-movil">
          <thead><tr><th>Patrulla</th>{CRITERIOS.map((k) => <th key={k.key}>{k.label}</th>)}<th>Lugares</th><th>Asistencia</th><th>Inspección</th>{CATEGORIAS.map((k) => <th key={k.key}>{k.label}</th>)}<th>Extra</th><th>Total</th></tr></thead>
          <tbody>
            {res.patrullas.map((p) => (
              <tr key={p.id}>
                <td className="titulo" data-label="Patrulla"><span className="dot" style={{ background: p.color }} /><strong>{p.nombre}</strong></td>
                {CRITERIOS.map((k) => <td key={k.key} data-label={k.label}>{p.crit?.[k.key] ?? 0}</td>)}
                <td data-label="Lugares">{p.lugar}</td><td data-label="Asistencia">{p.asistencia}</td><td data-label="Inspección">{p.inspeccion}</td>
                {CATEGORIAS.map((k) => <td key={k.key} data-label={k.label}>{p.general?.[k.key] ?? 0}</td>)}
                <td data-label="Extra" className={p.extra >= 0 ? 'pos-num' : 'neg-num'}>{p.extra > 0 ? '+' : ''}{p.extra}</td>
                <td data-label="Total"><strong className="pts-grande">{p.total}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {res.extras?.length > 0 && (
        <>
          <h3 style={{ marginTop: 12 }}>Puntos extra del ciclo</h3>
          <ul className="lista-extras">
            {res.extras.map((e, i) => (
              <li key={i}><span className={e.puntos >= 0 ? 'pos-num' : 'neg-num'}>{e.puntos > 0 ? '+' : ''}{e.puntos}</span> · {res.patrullas.find((p) => p.id === e.patrullaId)?.nombre || '—'} · {e.motivo} <span className="muted">({formatoFecha(e.fecha)})</span></li>
            ))}
          </ul>
        </>
      )}
      {res.individual?.length > 0 && (
        <>
          <h3 style={{ marginTop: 12 }}>Participación individual</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Protagonista</th><th>Reuniones asistidas</th><th>Elementos de inspección</th></tr></thead>
              <tbody>{[...res.individual].sort((a, b) => b.asistencias - a.asistencias).map((x) => <tr key={x.id}><td>{x.nombre}</td><td>{x.asistencias} de {res.reuniones}</td><td>{x.elementos}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </details>
  );
}

export default function Historico() {
  const { ref } = useGrupo();
  const [config] = useConfig();
  const { docs: ciclos } = useCollection('ciclos', 'inicio');
  const { docs: reuniones } = useCollection('reuniones');
  const { docs: extras } = useCollection('puntosExtra');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: protagonistas } = useCollection('protagonistas');
  const [trabajando, setTrabajando] = useState('');
  const hoy = hoyISO();
  const vigente = cicloVigente(ciclos, hoy);
  const contexto = { reuniones, extras, patrullas, protagonistas, config };

  const terminados = useMemo(() => ciclos.filter((c) => c.fin && c.fin < hoy).sort((a, b) => b.fin.localeCompare(a.fin))
    .map((c) => ({ c, res: c.historico || resultadoCiclo(c, contexto), archivado: !!c.historico })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [ciclos, reuniones, extras, patrullas, protagonistas, config, hoy]);
  const enCurso = vigente ? resultadoCiclo(vigente, contexto) : null;

  const campeonatos = useMemo(() => {
    const m = new Map();
    for (const { res } of terminados) for (const g of res.ganadoras || []) m.set(g.nombre, (m.get(g.nombre) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [terminados]);

  const reArchivar = async (c) => {
    if (!confirm(`¿Recalcular y volver a archivar el resultado de ${etiquetaCiclo(c)}? Se usarán las reuniones y puntos registrados hoy.`)) return;
    setTrabajando(c.id);
    try {
      const historico = JSON.parse(JSON.stringify({ ...resultadoCiclo(c, contexto), archivado: new Date().toISOString() }));
      await updateDoc(ref('ciclos', c.id), { historico });
    } finally { setTrabajando(''); }
  };

  return (
    <>
      <div className="card leyenda">
        <h2>Histórico de puntajes</h2>
        <p>
          Cada ciclo tiene su propio puntaje. Cuando un ciclo termina, el puntaje del Inicio <strong>vuelve a cero</strong> y los resultados finales
          quedan <strong>archivados aquí</strong>, tal como estaban al cierre. Nada se borra.
        </p>
      </div>

      {campeonatos.length > 0 && (
        <div className="card">
          <h2>Ciclos ganados por patrulla</h2>
          <div className="enfasis-chips">
            {campeonatos.map(([nombre, n]) => <span key={nombre} className="chip lider">🏆 {nombre} <b>{n}</b></span>)}
          </div>
        </div>
      )}

      {enCurso && (
        <div className="card">
          <div className="row between"><h2>{etiquetaCiclo(vigente)}</h2><span className="badge">En curso</span></div>
          <p className="muted">{formatoFecha(vigente.inicio)} – {vigente.fin ? formatoFecha(vigente.fin) : 'sin fecha de fin'} · {enCurso.reuniones} reuniones · puntaje parcial</p>
          <Ranking res={enCurso} />
          <Desglose res={enCurso} />
        </div>
      )}

      {terminados.length === 0 && !enCurso && <div className="card"><p className="empty">Todavía no hay ciclos terminados. Cuando termine el primero, sus resultados quedarán aquí.</p></div>}

      {terminados.map(({ c, res, archivado }) => (
        <div className="card" key={c.id}>
          <div className="row between">
            <h2>{etiquetaCiclo(c)}</h2>
            <span className="badge">{archivado ? `Archivado ${formatoFecha((c.historico.archivado || '').slice(0, 10))}` : 'Archivando…'}</span>
          </div>
          <p className="muted">
            {formatoFecha(c.inicio)} – {formatoFecha(c.fin)} · {res.reuniones} reuniones
            {res.ganadoras?.length ? <> · <strong>🏆 {res.ganadoras.map((g) => g.nombre).join(' y ')}</strong></> : ' · sin puntos registrados'}
          </p>
          <Ranking res={res} />
          <Desglose res={res} />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn accion" onClick={() => reArchivar(c)} disabled={trabajando === c.id}>{trabajando === c.id ? 'Actualizando…' : '↻ Recalcular y volver a archivar'}</button>
          </div>
        </div>
      ))}
    </>
  );
}
