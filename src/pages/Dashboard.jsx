import { useMemo, useState } from 'react';
import { useCollection } from '../lib/useCollection';
import { useConfig } from '../lib/useConfig';
import { useGrupo } from '../lib/grupo.jsx';
import { listarBorradores, pendientesCiclo, resumenPendientes } from '../lib/cicloCompleto.js';
import { alertasDe, CATEGORIAS, CRITERIOS, desglosePatrulla, etiquetaCiclo, formatoFecha, hoyISO } from '../lib/etapas';

const ORDEN_NIVEL = { alta: 0, media: 1, info: 2 };

// Criterios que se muestran como tarjetas: los dos primeros son los destacados
const TARJETAS = [
  { key: 'espiritu', titulo: 'Espíritu', ayuda: 'Ánimo y cantos en cada juego', destacado: true, valor: (d) => d.crit.espiritu },
  { key: 'vivencia', titulo: 'Vivencia de Ley y Promesa', ayuda: 'Cómo viven la Ley y la Promesa', destacado: true, valor: (d) => d.crit.vivencia },
  { key: 'astucia', titulo: 'Astucia', ayuda: 'Buenas ideas para facilitar el juego', valor: (d) => d.crit.astucia },
  { key: 'sistema', titulo: 'Sistema de patrullas', ayuda: 'Uso del sistema de patrullas', valor: (d) => d.crit.sistema },
  { key: 'lugar', titulo: 'Lugares en juegos', ayuda: 'Puntos por el lugar obtenido', valor: (d) => d.lugar },
  { key: 'asistencia', titulo: 'Asistencia', ayuda: '1 punto por asistente', valor: (d) => d.asistencia },
  { key: 'inspeccion', titulo: 'Inspección', ayuda: '1 punto por elemento', valor: (d) => d.inspeccion },
  { key: 'comportamiento', titulo: 'Comportamiento', ayuda: 'Puntaje general de la reunión', valor: (d) => d.general.comportamiento },
];

function Barras({ datos, valor }) {
  const max = Math.max(1, ...datos.map(valor));
  const mayor = Math.max(...datos.map(valor));
  return datos.map((p) => {
    const v = valor(p);
    return (
      <div className="barra-fila" key={p.id}>
        <span className="barra-nombre"><span className="dot" style={{ background: p.color }} />{p.nombre}</span>
        <div className="bar"><span style={{ width: `${(Math.max(0, v) / max) * 100}%`, background: p.color || undefined }} /></div>
        <strong className="barra-valor">{v}{v > 0 && v === mayor && datos.length > 1 ? ' 🏆' : ''}</strong>
      </div>
    );
  });
}

export default function Dashboard({ irAExpediente, irAlCiclo }) {
  const { gid } = useGrupo();
  const [config] = useConfig();
  const { docs: protagonistas } = useCollection('protagonistas');
  const { docs: patrullas } = useCollection('patrullas', 'nombre');
  const { docs: ciclos } = useCollection('ciclos', 'inicio');
  const { docs: reuniones } = useCollection('reuniones', 'fecha');
  const { docs: extras } = useCollection('puntosExtra', 'fecha');
  const [alcance, setAlcance] = useState('ciclo'); // ciclo | ultima

  const activos = protagonistas.filter((p) => p.activo !== false);

  const alertas = useMemo(
    () => activos.flatMap((p) => alertasDe(p, config))
      .sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel]),
    [activos, config]
  );

  const hoy = hoyISO();

  // Recordatorios del ciclo de programa: borradores sin guardar y ciclos con secciones pendientes
  const alertasCiclo = useMemo(() => {
    const out = [];
    const borradores = listarBorradores(gid);
    for (const b of borradores) {
      const guardado = ciclos.find((x) => x.id === b.id);
      if (b.id !== 'nuevo' && !guardado) continue; // el ciclo ya no existe
      const nombre = `Ciclo ${b.f.numero || ''}${b.f.nombre ? ` — ${b.f.nombre}` : ''}`.trim();
      const hace = b.ts ? new Date(b.ts).toLocaleString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      out.push({ tipo: 'ciclo', nivel: 'alta', nombre, texto: `Tenés cambios sin guardar${hace ? ` (${hace})` : ''}. Abrilo y pulsá «Guardar ciclo».`, accion: () => irAlCiclo?.(b.id) });
    }
    const limite = new Date(); limite.setDate(limite.getDate() - 45);
    const desde = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
    for (const c of ciclos) {
      if (c.terminado || (c.fin && c.fin < desde) || borradores.some((b) => b.id === c.id)) continue;
      const pe = pendientesCiclo(c, { protagonistas, ciclos });
      if (!pe.length) continue;
      const r = resumenPendientes(pe);
      out.push({ tipo: 'ciclo', nivel: 'media', nombre: etiquetaCiclo(c), texto: `Falta terminar el ciclo de programa: ${r.faltan} de ${r.total} secciones pendientes (${r.nombres.join(', ')}).`, accion: () => irAlCiclo?.(c.id) });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, ciclos, protagonistas]);

  const cicloActual = ciclos.find((c) => c.inicio <= hoy && (!c.fin || c.fin >= hoy))
    || ciclos[ciclos.length - 1];
  const ultima = [...reuniones].reverse()[0];

  // Puntos de cada patrulla, desglosados, en el ciclo actual o en la última reunión
  const datos = useMemo(() => {
    const rs = alcance === 'ultima'
      ? (ultima ? [ultima] : [])
      : (cicloActual ? reuniones.filter((r) => r.cicloId === cicloActual.id) : []);
    const es = alcance === 'ciclo' && cicloActual ? extras.filter((e) => e.cicloId === cicloActual.id) : [];
    return patrullas.map((pa) => {
      const acc = { crit: Object.fromEntries(CRITERIOS.map((c) => [c.key, 0])), lugar: 0, asistencia: 0, inspeccion: 0, general: Object.fromEntries(CATEGORIAS.map((c) => [c.key, 0])), total: 0 };
      for (const r of rs) {
        const d = desglosePatrulla(r, pa.id, config);
        CRITERIOS.forEach((c) => { acc.crit[c.key] += d.crit[c.key]; });
        CATEGORIAS.forEach((c) => { acc.general[c.key] += d.general[c.key]; });
        acc.lugar += d.lugar; acc.asistencia += d.asistencia; acc.inspeccion += d.inspeccion; acc.total += d.total;
      }
      const extra = es.filter((e) => e.patrullaId === pa.id).reduce((s, e) => s + (Number(e.puntos) || 0), 0);
      return { ...pa, ...acc, extra, total: acc.total + extra, reuniones: rs.length };
    });
  }, [alcance, ultima, cicloActual, reuniones, extras, patrullas, config]);

  const ranking = [...datos].sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...ranking.map((r) => r.total));
  const nReuniones = datos[0]?.reuniones ?? 0;
  const titulo = alcance === 'ultima'
    ? (ultima ? `Última reunión (${formatoFecha(ultima.fecha)})` : 'Última reunión')
    : (cicloActual ? etiquetaCiclo(cicloActual) : 'Ciclo actual');

  return (
    <>
      <div className="grid stats">
        <div className="card stat"><div className="n">{activos.length}</div><div className="l">Protagonistas activos</div></div>
        <div className="card stat"><div className="n">{patrullas.length}</div><div className="l">Patrullas</div></div>
        <div className="card stat"><div className="n">{alertas.filter((a) => a.tipo === 'etapa').length}</div><div className="l">Cambios de etapa</div></div>
        <div className="card stat"><div className="n">{ultima ? formatoFecha(ultima.fecha) : '—'}</div><div className="l">Última reunión</div></div>
      </div>

      <div className="seg" style={{ maxWidth: 360, margin: '0 0 1rem' }} role="group" aria-label="Alcance de los puntajes">
        <button type="button" className={alcance === 'ciclo' ? 'on' : ''} onClick={() => setAlcance('ciclo')}>Ciclo actual</button>
        <button type="button" className={alcance === 'ultima' ? 'on' : ''} onClick={() => setAlcance('ultima')}>Última reunión</button>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Puntaje general</h2>
          <p className="muted">{titulo} · {nReuniones} {nReuniones === 1 ? 'reunión' : 'reuniones'}</p>
          {!cicloActual && alcance === 'ciclo' && <p className="empty">Creá un ciclo en «Ciclos» para empezar a sumar.</p>}
          {ranking.map((r, i) => (
            <div className="rank" key={r.id}>
              <div className="pos">{i === 0 && r.total > 0 ? '🏆' : i + 1}</div>
              <div style={{ flex: 1 }}>
                <div className="row between"><strong>{r.nombre}</strong><span className="pts">{r.total}</span></div>
                <div className="bar"><span style={{ width: `${(Math.max(0, r.total) / max) * 100}%`, background: r.color || undefined }} /></div>
                {r.extra !== 0 && <div className="muted">Incluye {r.extra > 0 ? '+' : ''}{r.extra} de puntos extra</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>Recordatorios</h2>
          {alertas.length + alertasCiclo.length === 0 && <p className="empty">Sin pendientes. Todo al día.</p>}
          {[...alertasCiclo, ...alertas].map((a, i) => (
            <div key={i} className={`alert ${a.nivel} clickable`} onClick={() => (a.accion ? a.accion() : irAExpediente(a.id))}>
              {a.tipo === 'ciclo' && <span className="tag-ciclo">Ciclo de programa</span>} <strong>{a.nombre}</strong> — {a.texto}
            </div>
          ))}
        </div>
      </div>

      <h2 className="sec-dash">Puntajes por criterio</h2>
      {patrullas.length === 0 ? <p className="empty">Creá las patrullas para ver sus puntajes.</p> : (
        <div className="grid criterios">
          {TARJETAS.map((t) => (
            <div key={t.key} className={t.destacado ? 'card criterio destacado' : 'card criterio'}>
              <h3>{t.titulo}</h3>
              <p className="muted">{t.ayuda}</p>
              <Barras datos={datos} valor={t.valor} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
