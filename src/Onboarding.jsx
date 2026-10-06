import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { REGISTRO_KEY } from './Login.jsx';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const codigoNuevo = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => ALFABETO[x % ALFABETO.length]).join('');

function leerRegistro(email) {
  try {
    const r = JSON.parse(localStorage.getItem(REGISTRO_KEY) || 'null');
    return r && r.email === email ? r : null;
  } catch { return null; }
}
const borrarRegistro = () => { try { localStorage.removeItem(REGISTRO_KEY); } catch { /* nada */ } };

// Escrituras del alta (requieren correo verificado)
async function crearGrupo(user, persona, { numero, localidad }) {
  const gid = codigoNuevo();
  await setDoc(doc(db, 'grupos', gid), { numero, localidad, creadoPor: user.uid, creado: serverTimestamp() });
  await setDoc(doc(db, 'grupos', gid, 'miembros', user.uid), { ...persona, rol: 'jefe', estado: 'activo', creado: serverTimestamp() });
  await setDoc(doc(db, 'usuarios', user.uid), { ...persona, grupoId: gid });
}
async function pedirIngreso(user, persona, gid) {
  await setDoc(doc(db, 'grupos', gid, 'miembros', user.uid), { ...persona, rol: 'dirigente', estado: 'pendiente', creado: serverTimestamp() });
  await setDoc(doc(db, 'usuarios', user.uid), { ...persona, grupoId: gid });
}

let altaEnCurso = false; // evita duplicar el alta automática (StrictMode / recargas)

export default function Onboarding({ user }) {
  const email = user.email.toLowerCase();
  const registro = leerRegistro(email);
  const persona = {
    email, nombre: registro?.nombre || user.displayName || user.email,
    telefono: registro?.telefono || '', cargo: registro?.cargo || 'Dirigente',
  };
  const [auto, setAuto] = useState(!!registro);
  const [modo, setModo] = useState(registro?.grupo?.modo === 'unirse' ? 'unirse' : 'crear');
  const [f, setF] = useState({
    numero: registro?.grupo?.numero || '', localidad: registro?.grupo?.localidad || '', codigo: registro?.grupo?.codigo || '',
  });
  const [encontrado, setEncontrado] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const cambiar = (m) => { setModo(m); setError(''); setEncontrado(null); };

  // Alta automática con los datos del formulario de registro
  useEffect(() => {
    if (!registro || altaEnCurso) return;
    altaEnCurso = true;
    (async () => {
      try {
        if (registro.grupo.modo === 'nuevo') {
          await crearGrupo(user, persona, registro.grupo);
        } else {
          const snap = await getDoc(doc(db, 'grupos', registro.grupo.codigo));
          if (!snap.exists()) throw new Error('No encontramos un grupo con el código que escribiste.');
          await pedirIngreso(user, persona, registro.grupo.codigo);
        }
        borrarRegistro();
      } catch (err) {
        setError(err.code ? `No se pudo completar el registro (${err.code}).` : err.message);
        setAuto(false);
      } finally { altaEnCurso = false; }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ejecutar = async (fn, fallo) => {
    setError(''); setOcupado(true);
    try { await fn(); borrarRegistro(); } catch (err) { setError(`${fallo} (${err.code || err.message}).`); } finally { setOcupado(false); }
  };
  const crear = (e) => { e.preventDefault(); ejecutar(() => crearGrupo(user, persona, { numero: f.numero.trim(), localidad: f.localidad.trim() }), 'No se pudo registrar el grupo'); };
  const buscar = async (e) => {
    e.preventDefault();
    setError(''); setOcupado(true);
    try {
      const gid = f.codigo.trim().toUpperCase();
      const snap = await getDoc(doc(db, 'grupos', gid));
      if (!snap.exists()) setError('No encontramos un grupo con ese código.');
      else setEncontrado({ id: gid, ...snap.data() });
    } catch (err) { setError(`No se pudo buscar el grupo (${err.code || err.message}).`); } finally { setOcupado(false); }
  };
  const solicitar = () => ejecutar(() => pedirIngreso(user, persona, encontrado.id), 'No se pudo enviar la solicitud');

  if (auto) {
    return (
      <div className="login"><div className="login-card">
        <div className="login-logos"><img src="/img/agscr.png" alt="" /><img src="/img/tropa-circulo.png" alt="" /></div>
        <h1>Registrando tu grupo…</h1><p className="muted">Un momento, estamos guardando tus datos.</p>
      </div></div>
    );
  }

  return (
    <div className="login">
      <div className="login-card wide">
        <div className="login-logos">
          <img src="/img/agscr.png" alt="" />
          <img src="/img/tropa-circulo.png" alt="" />
        </div>
        <h1>Falta registrar tu grupo</h1>
        <p>Registrá tu Grupo Guía y Scout o unite al de tu equipo de dirigentes.</p>
        {error && <p className="error" role="alert">{error}</p>}

        <div className="seg">
          <button type="button" className={modo === 'crear' ? 'on' : ''} onClick={() => cambiar('crear')}>Registrar mi grupo</button>
          <button type="button" className={modo === 'unirse' ? 'on' : ''} onClick={() => cambiar('unirse')}>Unirme a un grupo</button>
        </div>

        {modo === 'crear' && (
          <form className="login-form" onSubmit={crear}>
            <div className="dos">
              <label>Número de grupo
                <input value={f.numero} onChange={set('numero')} inputMode="numeric" placeholder="Ej.: 307" required />
              </label>
              <label>Localidad
                <input value={f.localidad} onChange={set('localidad')} placeholder="Ej.: San Pedro" required />
              </label>
            </div>
            <p className="muted">Serás el Jefe de Grupo: autorizás a los demás dirigentes con un código de grupo.</p>
            <button className="btn primary block" disabled={ocupado}>{ocupado ? 'Registrando…' : 'Registrar grupo'}</button>
          </form>
        )}

        {modo === 'unirse' && !encontrado && (
          <form className="login-form" onSubmit={buscar}>
            <label>Código de grupo
              <input value={f.codigo} onChange={set('codigo')} placeholder="Te lo da el Jefe de Grupo"
                maxLength={8} style={{ textTransform: 'uppercase', letterSpacing: '.15em' }} required />
            </label>
            <button className="btn primary block" disabled={ocupado}>{ocupado ? 'Buscando…' : 'Buscar grupo'}</button>
          </form>
        )}

        {modo === 'unirse' && encontrado && (
          <div className="login-form">
            <div className="alert info"><strong>Grupo {encontrado.numero}</strong> — {encontrado.localidad}</div>
            <p className="muted">El Jefe de Grupo deberá aprobar tu solicitud antes de que puedas ver la información.</p>
            <button className="btn primary block" onClick={solicitar} disabled={ocupado}>{ocupado ? 'Enviando…' : 'Solicitar acceso'}</button>
            <button className="link" onClick={() => setEncontrado(null)}>← Cambiar código</button>
          </div>
        )}
      </div>
    </div>
  );
}
