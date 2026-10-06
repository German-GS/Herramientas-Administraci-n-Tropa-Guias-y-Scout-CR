import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { useGrupo } from './grupo.jsx';

// Suscripción en tiempo real a una colección completa del grupo.
export function useCollection(nombre, campoOrden) {
  const { col } = useGrupo();
  const [docs, setDocs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ref = col(nombre);
    const q = campoOrden ? query(ref, orderBy(campoOrden)) : ref;
    return onSnapshot(
      q,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setCargando(false);
      },
      (err) => {
        setError(err);
        setCargando(false);
      }
    );
  }, [col, nombre, campoOrden]);

  return { docs, cargando, error };
}
