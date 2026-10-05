import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CONFIG_DEFAULT } from './etapas';

const ref = doc(db, 'config', 'app');

export function useConfig() {
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  useEffect(
    () => onSnapshot(ref, (snap) => setConfig({ ...CONFIG_DEFAULT, ...(snap.data() || {}) })),
    []
  );
  const guardar = (cambios) => setDoc(ref, cambios, { merge: true });
  return [config, guardar];
}
