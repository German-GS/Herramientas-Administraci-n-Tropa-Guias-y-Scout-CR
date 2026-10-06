import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import { CONFIG_DEFAULT } from './etapas';
import { useGrupo } from './grupo.jsx';

export function useConfig() {
  const { ref } = useGrupo();
  const docRef = useMemo(() => ref('config', 'app'), [ref]);
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  useEffect(
    () => onSnapshot(docRef, (snap) => setConfig({ ...CONFIG_DEFAULT, ...(snap.data() || {}) })),
    [docRef]
  );
  const guardar = (cambios) => setDoc(docRef, cambios, { merge: true });
  return [config, guardar];
}
