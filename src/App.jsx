import { useEffect, useState } from 'react';
import { onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useAcceso } from './lib/useAcceso';
import Login from './Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Patrullas from './pages/Patrullas.jsx';
import Protagonistas from './pages/Protagonistas.jsx';
import Reuniones from './pages/Reuniones.jsx';
import PuntosExtra from './pages/PuntosExtra.jsx';
import Ciclos from './pages/Ciclos.jsx';
import Dirigentes from './pages/Dirigentes.jsx';
import Ajustes from './pages/Ajustes.jsx';

const TABS = [
  { key: 'inicio', label: 'Inicio', comp: Dashboard },
  { key: 'reuniones', label: 'Reuniones', comp: Reuniones },
  { key: 'puntos', label: 'Puntos extra', comp: PuntosExtra },
  { key: 'ciclos', label: 'Puntaje final', comp: Ciclos },
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

export default function App() {
  const [user, setUser] = useState(undefined);
  const [, refrescar] = useState(0);
  const [tab, setTab] = useState('inicio');
  const [abrirExpediente, setAbrirExpediente] = useState(null);
  const [aviso, setAviso] = useState('');
  const acceso = useAcceso(user);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <div className="center">Cargando…</div>;
  if (!user) return <Login />;

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

  if (acceso === 'cargando') return <div className="center">Cargando…</div>;

  if (acceso === 'pendiente') {
    return (
      <Aviso titulo="Acceso pendiente">
        <p>Tu cuenta <strong>{user.email}</strong> está creada y verificada, pero el Jefe de Grupo todavía no autoriza tu acceso.</p>
        <p className="muted">Pedile que te agregue en la pestaña «Dirigentes» y luego recargá esta página.</p>
      </Aviso>
    );
  }

  const esJefe = acceso === 'jefe';
  const tabs = TABS.filter((t) => !t.soloJefe || esJefe);
  const Actual = (tabs.find((t) => t.key === tab) || tabs[0]).comp;
  const irAExpediente = (id) => {
    setAbrirExpediente(id);
    setTab('protagonistas');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/img/agscr-blanco.png" alt="AGSCR" />
          <div><b>Tropa 307</b><small>Guías y Scouts de Costa Rica</small></div>
        </div>
        <button className="btn small ghost salir" onClick={() => signOut(auth)} title={user.email}>Salir</button>
        <nav className="tabs">
          {tabs.map((t) => (
            <button key={t.key} className={tab === t.key ? 'tab active' : 'tab'}
              onClick={() => { setTab(t.key); if (t.key !== 'protagonistas') setAbrirExpediente(null); }}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="content">
        <Actual irAExpediente={irAExpediente} abrirExpediente={abrirExpediente}
          limpiarExpediente={() => setAbrirExpediente(null)} esJefe={esJefe} />
      </main>
    </div>
  );
}
