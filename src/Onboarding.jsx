import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { REGISTRO_KEY } from './Login.jsx';
import FormDirigente from './FormDirigente.jsx';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codigoNuevo = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => ALFABETO[x % ALFABETO.length]).join('');

function leerRegistro(email) {
  try {
    const r = JSON.parse(localStorage.getItem(REGISTRO_KEY) || 'null');
    return r && r.email === email ? r : null;
  } catch { return null; }
}
const borrarRegistro = () => { try { localStorage.removeItem(REGISTRO_KEY); } catch { /* nada */ } };

// Alta: crea el grupo (y queda como administrador) o solicita ingreso a uno existente.
// Requiere correo verificado (las reglas lo exigen).
async function altaCompleta(user, v) {
  const persona = {
    email: user.email.toLowerCase(), nombre: `${v.nombre} ${v.apellidos}`.trim(),
    apellidos: v.apellidos, telefono: v.telefono, cargo: v.cargo,
  };
  if (v.grupoModo === 'nuevo') {
    const gid = codigoNuevo();
    await setDoc(doc(db, 'grupos', gid), { numero: v.numero.trim(), localidad: v.localidad.trim(), creadoPor: user.uid, creado: serverTimestamp() });
    await setDoc(doc(db, 'grupos', gid, 'miembros', user.uid), { ...persona, rol: 'jefe', estado: 'activo', creado: serverTimestamp() });
    await setDoc(doc(db, 'usuarios', user.uid), { ...persona, grupoId: gid });
  } else {
    const gid = v.codigo.trim().toUpperCase();
    const snap = await getDoc(doc(db, 'grupos', gid));
    if (!snap.exists()) throw new Error('No encontramos un grupo con ese código.');
    await setDoc(doc(db, 'grupos', gid, 'miembros', user.uid), { ...persona, rol: 'dirigente', estado: 'pendiente', creado: serverTimestamp() });
    await setDoc(doc(db, 'usuarios', user.uid), { ...persona, grupoId: gid });
  }
  borrarRegistro();
}

let altaEnCurso = false; // evita duplicar el alta automática (StrictMode / recargas)

export default function Onboarding({ user }) {
  const email = user.email.toLowerCase();
  const registro = leerRegistro(email);
  const [auto, setAuto] = useState(!!registro);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const guardar = async (v) => {
    setError(''); setOcupado(true);
    try { await altaCompleta(user, v); }
    catch (err) { setError(err.code ? `No se pudo completar el registro (${err.code}).` : err.message); }
    finally { setOcupado(false); }
  };

  // Registro con correo: el formulario ya se llenó antes de confirmar el correo
  useEffect(() => {
    if (!registro || altaEnCurso) return;
    altaEnCurso = true;
    altaCompleta(user, registro)
      .catch((err) => { setError(err.code ? `No se pudo completar el registro (${err.code}).` : err.message); setAuto(false); })
      .finally(() => { altaEnCurso = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [nombre, ...resto] = (user.displayName || '').split(' ');
  const inicial = registro || { nombre: nombre || '', apellidos: resto.join(' '), email };

  return (
    <div className="login">
      <div className="login-card wide">
        <div className="login-logos">
          <img src="/img/agscr.png" alt="" />
          <img src="/img/tropa-circulo.png" alt="" />
        </div>
        {auto ? (
          <>
            <h1>Registrando tu grupo…</h1>
            <p className="muted">Un momento, estamos guardando tus datos.</p>
          </>
        ) : (
          <>
            <h1>Completá tu registro</h1>
            <p>Faltan unos datos para terminar de registrarte como dirigente.</p>
            <FormDirigente inicial={{ ...inicial, email }} emailFijo boton="Terminar registro" ocupado={ocupado} error={error} onSubmit={guardar} />
          </>
        )}
      </div>
    </div>
  );
}
