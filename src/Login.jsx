import { useState } from 'react';
import {
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import FormDirigente from './FormDirigente.jsx';

export const REGISTRO_KEY = 'tropa.registro';

const MENSAJES = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Ingresá, o usá «¿Olvidaste tu contraseña?».',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisá tu internet.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes e intentá de nuevo.',
  'auth/account-exists-with-different-credential': 'Ese correo ya tiene una cuenta con otro método de ingreso.',
};
const msg = (e) => MENSAJES[e.code] || `${e.code || 'Error'}: ${e.message}`;
const IGNORAR = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function Login({ onEntrar }) {
  const [vista, setVista] = useState('entrar'); // entrar | registro | recuperar
  const [f, setF] = useState({ email: '', clave: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cambiar = (v) => { setVista(v); setError(''); setInfo(''); };

  const conGoogle = async () => {
    setError(''); setOcupado(true);
    try { await signInWithPopup(auth, googleProvider); onEntrar?.(); }
    catch (e) { if (!IGNORAR.includes(e.code)) setError(msg(e)); }
    finally { setOcupado(false); }
  };

  const entrar = async (e) => {
    e.preventDefault();
    setError(''); setOcupado(true);
    try { await signInWithEmailAndPassword(auth, f.email.trim().toLowerCase(), f.clave); onEntrar?.(); }
    catch (err) { setError(msg(err)); }
    finally { setOcupado(false); }
  };

  const recuperar = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setOcupado(true);
    try {
      await sendPasswordResetEmail(auth, f.email.trim().toLowerCase());
      setInfo('Si el correo tiene cuenta, te enviamos un enlace para crear una contraseña nueva. Revisá también el spam.');
    } catch (err) { setError(msg(err)); }
    finally { setOcupado(false); }
  };

  const registrar = async (v) => {
    setError(''); setOcupado(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, v.email, v.clave);
      await updateProfile(user, { displayName: `${v.nombre.trim()} ${v.apellidos.trim()}` });
      await sendEmailVerification(user);
      // El grupo se guarda al confirmar el correo (las reglas exigen correo verificado)
      const { clave, clave2, ...datos } = v;
      try { localStorage.setItem(REGISTRO_KEY, JSON.stringify(datos)); } catch { /* se pedirá de nuevo */ }
      onEntrar?.();
    } catch (err) { setError(msg(err)); }
    finally { setOcupado(false); }
  };

  return (
    <div className="login">
      <div className={vista === 'registro' ? 'login-card wide' : 'login-card'}>
        <div className="login-logos">
          <img src="/img/agscr.png" alt="Asociación de Guías y Scouts de Costa Rica" />
          <img src="/img/tropa-circulo.png" alt="Sección Tropa" />
        </div>

        {vista === 'entrar' && (
          <>
            <h1>Iniciar sesión</h1>
            <p>Administración de dirigentes · Guías y Scouts de Costa Rica</p>
            <form className="login-form" onSubmit={entrar}>
              <label>Correo electrónico
                <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="username" required />
              </label>
              <label>Contraseña
                <input type="password" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} autoComplete="current-password" required />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <button className="btn primary block" disabled={ocupado}>{ocupado ? 'Un momento…' : 'Ingresar'}</button>
            </form>
            <button type="button" className="link" onClick={() => cambiar('recuperar')}>¿Olvidaste tu contraseña?</button>
            <div className="o"><span>o</span></div>
            <button type="button" className="btn block google" onClick={conGoogle} disabled={ocupado}><GoogleG /> Continuar con Google</button>
            <p className="muted" style={{ marginTop: 14 }}>
              ¿Eres nuevo? <button type="button" className="link inline" onClick={() => cambiar('registro')}>Registrarme</button>
            </p>
          </>
        )}

        {vista === 'recuperar' && (
          <>
            <h1>Recuperar contraseña</h1>
            <form className="login-form" onSubmit={recuperar}>
              <label>Correo electrónico
                <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              {info && <p className="ok" role="status">{info}</p>}
              <button className="btn primary block" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar enlace'}</button>
            </form>
            <button type="button" className="link" onClick={() => cambiar('entrar')}>← Volver a iniciar sesión</button>
          </>
        )}

        {vista === 'registro' && (
          <>
            <h1>Registro de dirigente</h1>
            <button type="button" className="btn block google" onClick={conGoogle} disabled={ocupado}><GoogleG /> Registrarme con Google</button>
            <div className="o"><span>o con tu correo</span></div>
            <FormDirigente conClave boton="Crear cuenta" ocupado={ocupado} error={error} onSubmit={registrar} />
            <button type="button" className="link" onClick={() => cambiar('entrar')}>← Ya tengo cuenta</button>
          </>
        )}
      </div>
    </div>
  );
}
