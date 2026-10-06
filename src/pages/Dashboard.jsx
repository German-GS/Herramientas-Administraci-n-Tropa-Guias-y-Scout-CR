import { useMemo } from 'react';
import { useCollection } from '../lib/useCollection';
import { useConfig } from '../lib/useConfig';
import { alertasDe, etiquetaCiclo, formatoFecha, hoyISO, totalReunionPatrulla } from '../lib/etapas';

const ORDEN_NIVEL = { alta: 0, media: 1, info: 2 };

export default function Dashboard({ irAExpediente }) {
  const [config] = useConfig();
  const { docs: protagonistas } = useCollection('protagonistas');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: ciclos } = useCollection('ciclos', 'inicio');
  const { docs: reuniones } = useCollection('reuniones', 'fecha');
  const { docs: extras } = useCollection('puntosExtra', 'fecha');

  const activos = protagonistas.filter((p) => p.activo !== false);

  const alertas = useMemo(
    () => activos.flatMap((p) => alertasDe(p, config))
      .sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel]),
    [activos, config]
  );

  const hoy = hoyISO();
  const cicloActual = ciclos.find((c) => c.inicio <= hoy && (!c.fin || c.fin >= hoy))
    || ciclos[ciclos.length - 1];

  const ranking = useMemo(() => {
    if (!cicloActual) return [];
    const rs = reuniones.filter((r) => r.cicloId === cicloActual.id);
    const es = extras.filter((e) => e.cicloId === cicloActual.id);
    return patrullas.map((pa) => ({
      ...pa,
      total: rs.reduce((s, r) => s + totalReunionPatrulla(r, pa.id), 0)
        + es.filter((e) => e.patrullaId === pa.id).reduce((s, e) => s + (Number(e.puntos) || 0), 0),
    })).sort((a, b) => b.total - a.total);
  }, [cicloActual, reuniones, extras, patrullas]);

  const max = Math.max(1, ...ranking.map((r) => r.total));
  const ultima = [...reuniones].reverse()[0];

  return (
    <>
      <div className="grid stats">
        <div className="card stat"><div className="n">{activos.length}</div><div className="l">Protagonistas activos</div></div>
        <div className="card stat"><div className="n">{patrullas.length}</div><div className="l">Patrullas</div></div>
        <div className="card stat"><div className="n">{alertas.filter((a) => a.tipo === 'etapa').length}</div><div className="l">Cambios de etapa</div></div>
        <div className="card stat"><div className="n">{ultima ? formatoFecha(ultima.fecha) : '—'}</div><div className="l">Última reunión</div></div>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Puntaje {cicloActual ? `— ${etiquetaCiclo(cicloActual)}` : ''}</h2>
          {!cicloActual && <p className="empty">Creá un ciclo en «Puntaje final» para empezar a sumar.</p>}
          {ranking.map((r, i) => (
            <div className="rank" key={r.id}>
              <div className="pos">{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div className="row between"><strong>{r.nombre}</strong><span className="pts">{r.total}</span></div>
                <div className="bar"><span style={{ width: `${(Math.max(0, r.total) / max) * 100}%`, background: r.color || undefined }} /></div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>Recordatorios</h2>
          {alertas.length === 0 && <p className="empty">Sin pendientes. Todo al día.</p>}
          {alertas.map((a, i) => (
            <div key={i} className={`alert ${a.nivel} clickable`} onClick={() => irAExpediente(a.id)}>
              <strong>{a.nombre}</strong> — {a.texto}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
