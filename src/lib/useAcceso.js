import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Estado del usuario con sesión iniciada y correo verificado:
//  cargando | sinGrupo | pendiente | suspendido | ok
// usuarios/{uid} apunta al grupo; el acceso real lo da grupos/{gid}/miembros/{uid}.
export function useAcceso(user) {
  const [s, setS] = useState({ estado: 'cargando' });
  const uid = user?.uid;
  const verificado = user?.emailVerified;

  useEffect(() => {
    if (!uid || !verificado) return undefined;
    setS({ estado: 'cargando' });
    let inner = [];
    const limpiar = () => { inner.forEach((f) => f()); inner = []; };

    const stop = onSnapshot(doc(db, 'usuarios', uid), (snap) => {
      limpiar();
      const gid = snap.data()?.grupoId;
      if (!gid) { setS({ estado: 'sinGrupo' }); return; }
      let miembro; let grupo; let m = false; let g = false;
      const emitir = () => {
        if (!m || !g) return;
        if (!miembro) return setS({ estado: 'sinGrupo' });
        const estado = miembro.estado === 'activo' ? 'ok' : miembro.estado === 'suspendido' ? 'suspendido' : 'pendiente';
        setS({ estado, gid, miembro: { id: uid, ...miembro }, grupo: grupo && { id: gid, ...grupo } });
      };
      inner.push(onSnapshot(doc(db, 'grupos', gid, 'miembros', uid),
        (d) => { miembro = d.data(); m = true; emitir(); },
        () => { miembro = undefined; m = true; emitir(); }));
      inner.push(onSnapshot(doc(db, 'grupos', gid),
        (d) => { grupo = d.data(); g = true; emitir(); },
        () => { grupo = undefined; g = true; emitir(); }));
    }, () => setS({ estado: 'sinGrupo' }));

    return () => { stop(); limpiar(); };
  }, [uid, verificado]);

  return s;
}
