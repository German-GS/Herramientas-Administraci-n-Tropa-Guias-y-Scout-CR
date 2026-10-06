import { useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function codigoNuevo() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join('');
}

export default function Onboarding({ user }) {
  const [modo, setModo] = useState('crear'); // crear | unirse
  const [f, setF] = useState({ numero: '', localidad: '', codigo: '' });
  const [encontrado, setEncontrado] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const base = { email: user.email.toLowerCase(), nombre: user.displayName || user.email };
  const cambiar = (m) => { setModo(m); setError(''); setEncontrado(null); };

  const crear = async (e) => {
    e.preventDefault();
    setError(''); setOcupado(true);
    try {
      const gid = codigoNuevo();
      await setDoc(doc(db, 'grupos', gid), {
        numero: f.numero.trim(), localidad: f.localidad.trim(), creadoPor: user.uid, creado: serverTimestamp(),
      });
      await setDoc(doc(db, 'grupos', gid, 'miembros', user.uid), { ...base, rol: 'jefe', estado: 'activo', creado: serverTimestamp() });
      await setDoc(doc(db, 'usuarios', user.uid), { ...base, grupoId: gid });
    } catch (err) {
      setError(`No se pudo registrar el grupo (${err.code || err.message}). Intentá de nuevo.`);
    } finally { setOcupado(false); }
  };

  const buscar = async (e) => {
    e.preventDefault();
    setError(''); setOcupado(true);
    try {
      const gid = f.codigo.trim().toUpperCase();
      const snap = await getDoc(doc(db, 'grupos', gid));
      if (!snap.exists()) setError('No encontramos un grupo con ese código.');
      else setEncontrado({ id: gid, ...snap.data() });
    } catch (err) {
      setError(`No se pudo buscar el grupo (${err.code || err.message}).`);
    } finally { setOcupado(false); }
  };

  const solicitar = async () => {
    setError(''); setOcupado(true);
    try {
      await setDoc(doc(db, 'grupos', encontrado.id, 'miembros', user.uid), { ...base, rol: 'dirigente', estado: 'pendiente', creado: serverTimestamp() });
      await setDoc(doc(db, 'usuarios', user.uid), { ...base, grupoId: encontrado.id });
    } catch (err) {
      setError(`No se pudo enviar la solicitud (${err.code || err.message}).`);
    } finally { setOcupado(false); }
  };

  return (
    <div className="login">
      <div className="login-card wide">
        <div className="login-logos">
          <img src="/img/agscr.png" alt="" />
          <img src="/img/tropa-circulo.png" alt="" />
        </div>
        <h1>Bienvenido, {user.displayName || 'dirigente'}</h1>
        <p>Registrá tu Grupo Guía y Scout o unite al de tu equipo de dirigentes.</p>

        <div className="seg">
          <button type="button" className={modo === 'crear' ? 'on' : ''} onClick={() => cambiar('crear')}>Registrar mi grupo</button>
          <button type="button" className={modo === 'unirse' ? 'on' : ''} onClick={() => cambiar('unirse')}>Unirme a un grupo</button>
        </div>

        {modo === 'crear' && (
          <form className="login-form" onSubmit={crear}>
            <label>Número de grupo
              <input value={f.numero} onChange={set('numero')} inputMode="numeric" placeholder="Ej.: 307" required />
            </label>
            <label>Localidad
              <input value={f.localidad} onChange={set('localidad')} placeholder="Ej.: San Pedro, San José" required />
            </label>
            <p className="muted">Serás el Jefe de Grupo: podrás autorizar a los demás dirigentes con un código de grupo.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary block" disabled={ocupado}>{ocupado ? 'Registrando…' : 'Registrar grupo'}</button>
          </form>
        )}

        {modo === 'unirse' && !encontrado && (
          <form className="login-form" onSubmit={buscar}>
            <label>Código de grupo
              <input value={f.codigo} onChange={set('codigo')} placeholder="8 caracteres, te lo da el Jefe de Grupo"
                maxLength={8} style={{ textTransform: 'uppercase', letterSpacing: '.15em' }} required />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary block" disabled={ocupado}>{ocupado ? 'Buscando…' : 'Buscar grupo'}</button>
          </form>
        )}

        {modo === 'unirse' && encontrado && (
          <div className="login-form">
            <div className="alert info"><strong>Grupo {encontrado.numero}</strong> — {encontrado.localidad}</div>
            <p className="muted">El Jefe de Grupo deberá aprobar tu solicitud antes de que puedas ver la información.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary block" onClick={solicitar} disabled={ocupado}>{ocupado ? 'Enviando…' : 'Solicitar acceso'}</button>
            <button className="link" onClick={() => setEncontrado(null)}>← Cambiar código</button>
          </div>
        )}
      </div>
    </div>
  );
}
