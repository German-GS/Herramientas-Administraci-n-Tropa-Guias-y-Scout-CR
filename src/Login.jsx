import { useState } from 'react';
import {
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, updateProfile,
} from 'firebase/auth';
import { auth } from './firebase';

const MENSAJES = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Entrá con «¿Olvidaste tu contraseña?» si no la recordás.',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisá tu internet.',
  'auth/operation-not-allowed': 'El acceso con correo y contraseña no está habilitado en Firebase.',
};
export const CARGOS_DIRIGENTE = ['Jefe de Grupo', 'Jefe de Sección Tropa', 'Subjefe de Sección', 'Dirigente', 'Asistente'];
export const REGISTRO_KEY = 'tropa.registro';
const msg = (e) => MENSAJES[e.code] || `${e.code || 'Error'}: ${e.message}`;

export default function Login() {
  const [modo, setModo] = useState('entrar'); // entrar | crear | recuperar
  const [f, setF] = useState({
    nombre: '', telefono: '', cargo: CARGOS_DIRIGENTE[0], email: '', clave: '', clave2: '',
    grupoModo: 'nuevo', numero: '', localidad: '', codigo: '',
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const cambiar = (m) => { setModo(m); setError(''); setInfo(''); };

  const enviar = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    const email = f.email.trim().toLowerCase();
    if (modo === 'crear') {
      if (f.clave.length < 8) return setError(MENSAJES['auth/weak-password']);
      if (f.clave !== f.clave2) return setError('Las contraseñas no coinciden.');
    }
    setOcupado(true);
    try {
      if (modo === 'entrar') {
        await signInWithEmailAndPassword(auth, email, f.clave);
      } else if (modo === 'crear') {
        const { user } = await createUserWithEmailAndPassword(auth, email, f.clave);
        if (f.nombre.trim()) await updateProfile(user, { displayName: f.nombre.trim() });
        await sendEmailVerification(user);
        // El grupo se crea (o se solicita) apenas confirme el correo: las reglas exigen correo verificado
        try {
          localStorage.setItem(REGISTRO_KEY, JSON.stringify({
            email, nombre: f.nombre.trim(), telefono: f.telefono.trim(), cargo: f.cargo,
            grupo: f.grupoModo === 'nuevo'
              ? { modo: 'nuevo', numero: f.numero.trim(), localidad: f.localidad.trim() }
              : { modo: 'unirse', codigo: f.codigo.trim().toUpperCase() },
          }));
        } catch { /* sin almacenamiento: se pedirá el grupo después */ }
      } else {
        await sendPasswordResetEmail(auth, email);
        setInfo('Si el correo tiene cuenta, te enviamos un enlace para crear una contraseña nueva. Revisá también el spam.');
      }
    } catch (err) {
      setError(msg(err));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logos">
          <img src="/img/agscr.png" alt="Asociación de Guías y Scouts de Costa Rica" />
          <img src="/img/tropa-circulo.png" alt="Sección Tropa" />
        </div>
        <h1>Tropa 307</h1>
        <p>Administración de dirigentes · Guías y Scouts de Costa Rica</p>

        {modo !== 'recuperar' && (
          <div className="seg">
            <button type="button" className={modo === 'entrar' ? 'on' : ''} onClick={() => cambiar('entrar')}>Ingresar</button>
            <button type="button" className={modo === 'crear' ? 'on' : ''} onClick={() => cambiar('crear')}>Crear cuenta</button>
          </div>
        )}
        {modo === 'recuperar' && <h2 style={{ fontSize: '1.05rem' }}>Recuperar contraseña</h2>}

        <form className="login-form" onSubmit={enviar}>
          {modo === 'crear' && (
            <>
              <p className="sec-titulo">Datos del dirigente</p>
              <label>Nombre completo
                <input value={f.nombre} onChange={set('nombre')} autoComplete="name" required />
              </label>
              <div className="dos">
                <label>Teléfono
                  <input type="tel" value={f.telefono} onChange={set('telefono')} autoComplete="tel" required />
                </label>
                <label>Cargo
                  <select value={f.cargo} onChange={set('cargo')}>
                    {CARGOS_DIRIGENTE.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}
          <label>Correo electrónico
            <input type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
          </label>
          {modo !== 'recuperar' && (
            <label>Contraseña
              <input type="password" value={f.clave} onChange={set('clave')} required minLength={modo === 'crear' ? 8 : undefined}
                autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} />
            </label>
          )}
          {modo === 'crear' && (
            <label>Repetir contraseña
              <input type="password" value={f.clave2} onChange={set('clave2')} autoComplete="new-password" required />
            </label>
          )}
          {modo === 'crear' && (
            <>
              <p className="sec-titulo">Grupo Guía y Scout</p>
              <div className="seg" style={{ margin: 0 }}>
                <button type="button" className={f.grupoModo === 'nuevo' ? 'on' : ''} onClick={() => setF({ ...f, grupoModo: 'nuevo' })}>Registrar mi grupo</button>
                <button type="button" className={f.grupoModo === 'unirse' ? 'on' : ''} onClick={() => setF({ ...f, grupoModo: 'unirse' })}>Ya existe (tengo código)</button>
              </div>
              {f.grupoModo === 'nuevo' ? (
                <div className="dos">
                  <label>Número de grupo
                    <input value={f.numero} onChange={set('numero')} inputMode="numeric" placeholder="Ej.: 307" required />
                  </label>
                  <label>Localidad
                    <input value={f.localidad} onChange={set('localidad')} placeholder="Ej.: San Pedro" required />
                  </label>
                </div>
              ) : (
                <label>Código del grupo
                  <input value={f.codigo} onChange={set('codigo')} maxLength={8} required placeholder="Te lo da el Jefe de Grupo"
                    style={{ textTransform: 'uppercase', letterSpacing: '.15em' }} />
                </label>
              )}
            </>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          {info && <p className="ok" role="status">{info}</p>}
          <button className="btn primary block" disabled={ocupado}>
            {ocupado ? 'Un momento…' : modo === 'entrar' ? 'Ingresar' : modo === 'crear' ? 'Crear cuenta' : 'Enviar enlace'}
          </button>
        </form>

        {modo === 'entrar' && <button type="button" className="link" onClick={() => cambiar('recuperar')}>¿Olvidaste tu contraseña?</button>}
        {modo === 'recuperar' && <button type="button" className="link" onClick={() => cambiar('entrar')}>← Volver a ingresar</button>}
        {modo === 'crear' && (
          <p className="muted" style={{ marginTop: 10 }}>
            Confirmás tu correo y se registra el grupo. Si te unís a un grupo existente, su Jefe de Grupo debe aprobarte.
          </p>
        )}
      </div>
    </div>
  );
}
