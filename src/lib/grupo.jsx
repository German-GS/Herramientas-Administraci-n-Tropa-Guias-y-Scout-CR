import { createContext, useContext, useMemo } from 'react';
import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase';

const Ctx = createContext(null);

// Todo lo administrativo vive dentro del grupo: grupos/{gid}/{colección}/{id}
export function GrupoProvider({ gid, grupo, miembro, children }) {
  const valor = useMemo(() => ({
    gid, grupo, miembro,
    esJefe: miembro?.rol === 'jefe',
    col: (nombre) => collection(db, 'grupos', gid, nombre),
    ref: (nombre, id) => doc(db, 'grupos', gid, nombre, id),
  }), [gid, grupo, miembro]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useGrupo = () => useContext(Ctx);
