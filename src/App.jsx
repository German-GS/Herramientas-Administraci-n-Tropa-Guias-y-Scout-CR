import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, ALLOWED_EMAIL } from './firebase';
import Dashboard from './pages/Dashboard.jsx';
import Patrullas from './pages/Patrullas.jsx';
import Protagonistas from './pages/Protagonistas.jsx';
import Reuniones from './pages/Reuniones.jsx';
import PuntosExtra from './pages/PuntosExtra.jsx';
import Ciclos from './pages/Ciclos.jsx';
import Ajustes from './pages/Ajustes.jsx';

const TABS = [
  { key: 'inicio', label: 'Inicio', comp: Dashboard },
  { key: 'reuniones', label: 'Reuniones', comp: Reuniones },
  { key: 'puntos', label: 'Puntos extra', comp: PuntosExtra },
  { key: 'ciclos', label: 'Puntaje final', comp: Ciclos },
  { key: 'protagonistas', label: 'Expedientes', comp: Protagonistas },
  { key: 'patrullas', label: 'Patrullas', comp: Patrullas },
  { key: 'ajustes', label: 'Ajustes', comp: Ajustes },
];

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('inicio');
  const [abrirExpediente, setAbrirExpediente] = useState(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <div className="center">Cargando…</div>;

  if (!user) {
    return (
      <div className="login">
        <div className="login-card">
          <h1>Tropa 307</h1>
          <p>Puntajes por patrulla y expedientes de protagonistas</p>
          <button className="btn primary" onClick={() => signInWithPopup(auth, googleProvider)}>
            Entrar con Google
          </button>
        </div>
      </div>
    );
  }

  if (ALLOWED_EMAIL && user.email?.toLowerCase() !== ALLOWED_EMAIL) {
    return (
      <div className="login">
        <div className="login-card">
          <h1>Acceso restringido</h1>
          <p>La cuenta {user.email} no está autorizada.</p>
          <button className="btn" onClick={() => signOut(auth)}>Salir</button>
        </div>
      </div>
    );
  }

  const Actual = TABS.find((t) => t.key === tab).comp;
  const irAExpediente = (id) => {
    setAbrirExpediente(id);
    setTab('protagonistas');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Tropa 307</div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'tab active' : 'tab'}
              onClick={() => { setTab(t.key); if (t.key !== 'protagonistas') setAbrirExpediente(null); }}>
              {t.label}
            </button>
          ))}
        </nav>
        <button className="btn small ghost" onClick={() => signOut(auth)}>Salir</button>
      </header>
      <main className="content">
        <Actual irAExpediente={irAExpediente} abrirExpediente={abrirExpediente}
          limpiarExpediente={() => setAbrirExpediente(null)} />
      </main>
    </div>
  );
}
