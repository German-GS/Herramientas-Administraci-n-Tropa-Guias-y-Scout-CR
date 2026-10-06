import { useEffect, useRef } from 'react';
import { updateDoc } from 'firebase/firestore';
import { useCollection } from '../lib/useCollection';
import { useConfig } from '../lib/useConfig';
import { useGrupo } from '../lib/grupo.jsx';
import { hoyISO } from '../lib/etapas.js';
import { resultadoCiclo } from '../lib/puntajes.js';

// Cuando un ciclo termina, guarda una foto fija de sus resultados dentro del propio ciclo (campo «historico»).
// Así el histórico no cambia aunque después se renombren patrullas o se modifique la escala de puntos.
export default function ArchivadorCiclos() {
  const { ref } = useGrupo();
  const [config] = useConfig();
  const ciclos = useCollection('ciclos', 'inicio');
  const reuniones = useCollection('reuniones');
  const extras = useCollection('puntosExtra');
  const patrullas = useCollection('patrullas', 'nombre');
  const protagonistas = useCollection('protagonistas');
  const enCurso = useRef(new Set());

  useEffect(() => {
    if ([ciclos, reuniones, extras, patrullas, protagonistas].some((x) => x.cargando || x.error)) return;
    const hoy = hoyISO();
    for (const c of ciclos.docs) {
      if (!c.fin || c.fin >= hoy || c.historico || enCurso.current.has(c.id)) continue;
      enCurso.current.add(c.id);
      const historico = JSON.parse(JSON.stringify({
        ...resultadoCiclo(c, { reuniones: reuniones.docs, extras: extras.docs, patrullas: patrullas.docs, protagonistas: protagonistas.docs, config }),
        archivado: new Date().toISOString(),
      }));
      updateDoc(ref('ciclos', c.id), { historico }).catch(() => enCurso.current.delete(c.id));
    }
  }, [ciclos, reuniones, extras, patrullas, protagonistas, config, ref]);

  return null;
}
