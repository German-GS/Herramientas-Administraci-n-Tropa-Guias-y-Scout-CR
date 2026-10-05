import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, JEFE_EMAIL } from '../firebase';

// Estado de acceso del usuario con sesión iniciada:
// 'cargando' | 'jefe' | 'dirigente' | 'pendiente'
export function useAcceso(user) {
  const [estado, setEstado] = useState('cargando');
  const email = user?.email?.toLowerCase();

  useEffect(() => {
    if (!email || !user.emailVerified) return undefined;
    if (email === JEFE_EMAIL) { setEstado('jefe'); return undefined; }
    setEstado('cargando');
    return onSnapshot(
      doc(db, 'usuarios', email),
      (snap) => setEstado(snap.exists() && snap.data().activo !== false ? 'dirigente' : 'pendiente'),
      () => setEstado('pendiente')
    );
  }, [email, user?.emailVerified]);

  return estado;
}
