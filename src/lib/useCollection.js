import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// Suscripción en tiempo real a una colección completa.
export function useCollection(nombre, campoOrden) {
  const [docs, setDocs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ref = collection(db, nombre);
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
  }, [nombre, campoOrden]);

  return { docs, cargando, error };
}
