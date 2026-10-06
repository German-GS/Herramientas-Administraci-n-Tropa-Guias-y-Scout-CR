import { useEffect, useState } from 'react';
import { getRedirectResult, onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useAcceso } from './lib/useAcceso';
import { activarBio, bioActivada, bioDisponible, quitarBio, verificarBio } from './lib/biometria';
import { GrupoProvider } from './lib/grupo.jsx';
import Login from './Login.jsx';
import Onboarding from './Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Patrullas from './pages/Patrullas.jsx';
import Protagonistas from './pages/Protagonistas.jsx';
import Reuniones from './pages/Reuniones.jsx';
import PuntosExtra from './pages/PuntosExtra.jsx';
import Ciclos from './pages/Ciclos.jsx';
import Dirigentes from './pages/Dirigentes.jsx';
import Ajustes from './pages/Ajustes.jsx';

const ICONOS = {
  inicio: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  reuniones: 'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  puntos: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  ciclos: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  protagonistas: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  patrullas: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a7 7 0 0 1 4 6',
  dirigentes: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  ajustes: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4',
};

const TABS = [
  { key: 'inicio', label: 'Inicio', comp: Dashboard },
  { key: 'reuniones', label: 'Reuniones', comp: Reuniones },
  { key: 'puntos', label: 'Puntos extra', comp: PuntosExtra },
  { key: 'ciclos', label: 'Ciclos', comp: Ciclos },
  { key: 'protagonistas', label: 'Expedientes', comp: Protagonistas },
  { key: 'patrullas', label: 'Patrullas', comp: Patrullas },
  { key: 'dirigentes', label: 'Dirigentes', comp: Dirigentes, soloJefe: true },
  { key: 'ajustes', label: 'Ajustes', comp: Ajustes },
];

function Aviso({ titulo, children }) {
  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logos">
          <img src="/img/agscr.png" alt="" />
          <img src="/img/tropa-circulo.png" alt="" />
        </div>
        <h1>{titulo}</h1>
        {children}
        <button className="link" onClick={() => signOut(auth)}>Salir</button>
      </div>
    </div>
  );
}

function Bloqueo({ bio, onLibre }) {
  const [error, setError] = useState('');
  const abrir = async () => {
    setError('');
    try { await verificarBio(bio); onLibre(); }
    catch { setError('No se pudo verificar. Intentá de nuevo o usá tu contraseña.'); }
  };
  return (
    <Aviso titulo="Sesión bloqueada">
      <p className="muted">Verificá tu identidad para entrar.</p>
      <button className="btn primary block" onClick={abrir}>Desbloquear con huella / Face ID</button>
      {error && <p className="error" role="alert">{error}</p>}
    </Aviso>
  );
}

function Icono({ k }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONOS[k]} /></svg>
  );
}

function Panel({ user, acceso, onBloquear }) {
  const [tab, setTab] = useState('inicio');
  const [menu, setMenu] = useState(false);
  const [abrirExpediente, setAbrirExpediente] = useState(null);
  const [bio, setBio] = useState(() => !!bioActivada(user.uid));
  const [bioOk, setBioOk] = useState(false);
  const [bioMsg, setBioMsg] = useState('');
  useEffect(() => { bioDisponible().then(setBioOk); }, []);
  const esJefe = acceso.miembro.rol === 'jefe';
  const activar = async () => {
    setBioMsg('');
    try { await activarBio(user); setBio(true); setBioMsg('Listo: la próxima vez desbloqueás con huella o Face ID.'); }
    catch { setBioMsg('No se pudo activar. Revisá que el dispositivo tenga huella o Face ID configurado.'); }
  };
  const desactivar = () => { quitarBio(); setBio(false); setBioMsg(''); };
  const tabs = TABS.filter((t) => !t.soloJefe || esJefe);
  const actual = tabs.find((t) => t.key === tab) || tabs[0];
  const Actual = actual.comp;

  const ir = (key) => { setTab(key); setMenu(false); if (key !== 'protagonistas') setAbrirExpediente(null); };
  const irAExpediente = (id) => { setAbrirExpediente(id); setTab('protagonistas'); };

  return (
    <GrupoProvider gid={acceso.gid} grupo={acceso.grupo} miembro={acceso.miembro}>
      <div className={menu ? 'shell abierto' : 'shell'}>
        <div className="mobilebar">
          <button className="hamb" onClick={() => setMenu(true)} aria-label="Abrir menú">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <img src="/img/agscr-blanco.png" alt="" />
          <strong>{actual.label}</strong>
        </div>
        <div className="scrim" onClick={() => setMenu(false)} />
        <aside className="sidebar" aria-label="Menú principal">
          <div className="brand">
            <img src="/img/agscr-blanco.png" alt="AGSCR" />
            <div>
              <b>Grupo {acceso.grupo?.numero}</b>
              <small>{acceso.grupo?.localidad || 'Guías y Scouts de Costa Rica'}</small>
            </div>
          </div>
          <div className="seccion-chip"><img src="/img/tropa-mano-blanca.png" alt="" /> Sección Tropa</div>
          <nav className="nav">
            {tabs.map((t) => (
              <button key={t.key} className={t.key === actual.key ? 'navitem active' : 'navitem'} onClick={() => ir(t.key)}>
                <Icono k={t.key} /> <span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="usuario">
            <div className="quien">
              <strong>{acceso.miembro.nombre || user.email}</strong>
              <small>{acceso.miembro.cargo || (esJefe ? 'Administrador' : 'Dirigente')}</small>
            </div>
            <button className="btn small ghost" onClick={() => signOut(auth)}>Salir</button>
          </div>
          {(bioOk || bio) && (
            <div className="bio">
              {bio ? (
                <>
                  <button className="btn small ghost" onClick={onBloquear}>🔒 Bloquear</button>
                  <button className="link claro" onClick={desactivar}>Quitar huella / Face ID</button>
                </>
              ) : (
                <button className="btn small ghost" onClick={activar}>Activar huella / Face ID</button>
              )}
              {bioMsg && <small>{bioMsg}</small>}
            </div>
          )}
        </aside>
        <main className="content">
          <Actual irAExpediente={irAExpediente} abrirExpediente={abrirExpediente}
            limpiarExpediente={() => setAbrirExpediente(null)} esJefe={esJefe} />
        </main>
      </div>
    </GrupoProvider>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [, refrescar] = useState(0);
  const [aviso, setAviso] = useState('');
  const [errorRedir, setErrorRedir] = useState('');
  const [libre, setLibre] = useState(false); // false tras recargar: si hay huella activada, se pide
  const acceso = useAcceso(user);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Regreso del login de Google por redirección (celulares)
  useEffect(() => {
    getRedirectResult(auth)
      .then((r) => { if (r?.user) setLibre(true); })
      .catch((e) => setErrorRedir(`No se pudo completar el ingreso con Google (${e.code || e.message}). Probá con tu correo y contraseña.`));
  }, []);

  if (user === undefined) return <div className="center">Cargando…</div>;
  if (!user) return <Login onEntrar={() => setLibre(true)} errorInicial={errorRedir} />;

  const bio = bioActivada(user.uid);
  if (bio && !libre) return <Bloqueo bio={bio} onLibre={() => setLibre(true)} />;

  if (!user.emailVerified) {
    const yaVerifique = async () => {
      await user.reload();
      await user.getIdToken(true); // renueva el token para que las reglas vean el correo verificado
      refrescar((n) => n + 1);
    };
    const reenviar = async () => {
      try { await sendEmailVerification(user); setAviso('Te reenviamos el correo de verificación.'); }
      catch { setAviso('Esperá un momento antes de pedir otro correo.'); }
    };
    return (
      <Aviso titulo="Confirmá tu correo">
        <p>Enviamos un enlace de verificación a <strong>{user.email}</strong>. Abrilo (revisá también el spam) y luego tocá el botón.</p>
        <button className="btn primary block" onClick={yaVerifique}>Ya confirmé mi correo</button>
        <button className="btn block" style={{ marginTop: 8 }} onClick={reenviar}>Reenviar correo</button>
        {aviso && <p className="muted">{aviso}</p>}
      </Aviso>
    );
  }

  if (acceso.estado === 'cargando') return <div className="center">Cargando…</div>;
  if (acceso.estado === 'sinGrupo') return <Onboarding user={user} />;

  if (acceso.estado === 'pendiente') {
    return (
      <Aviso titulo="Solicitud enviada">
        <p>Pediste unirte al <strong>Grupo {acceso.grupo?.numero}</strong>{acceso.grupo?.localidad ? ` — ${acceso.grupo.localidad}` : ''}.</p>
        <p className="muted">El Jefe de Grupo debe aprobarte. Cuando lo haga, esta pantalla se actualiza sola.</p>
      </Aviso>
    );
  }
  if (acceso.estado === 'suspendido') {
    return (
      <Aviso titulo="Acceso suspendido">
        <p>El Jefe de Grupo suspendió tu acceso. Consultale si crees que es un error.</p>
      </Aviso>
    );
  }

  return <Panel user={user} acceso={acceso} onBloquear={() => setLibre(false)} />;
}
