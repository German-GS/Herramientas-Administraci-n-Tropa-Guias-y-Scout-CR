import { useState } from 'react';

export const CARGOS = ['Coordinador de sección', 'Dirigente'];

// Formulario único de registro: datos del dirigente + grupo.
// Se usa al crear cuenta (con contraseña) y al completar el perfil tras entrar con Google.
export default function FormDirigente({ inicial = {}, conClave = false, emailFijo = false, boton, ocupado, error, onSubmit }) {
  const [v, setV] = useState({
    nombre: '', apellidos: '', telefono: '', email: '', cargo: CARGOS[0],
    grupoModo: 'nuevo', numero: '', localidad: '', codigo: '', clave: '', clave2: '', ...inicial,
  });
  const [errorLocal, setErrorLocal] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const enviar = (e) => {
    e.preventDefault();
    setErrorLocal('');
    if (conClave) {
      if (v.clave.length < 8) return setErrorLocal('La contraseña debe tener al menos 8 caracteres.');
      if (v.clave !== v.clave2) return setErrorLocal('Las contraseñas no coinciden.');
    }
    onSubmit({ ...v, email: v.email.trim().toLowerCase(), codigo: v.codigo.trim().toUpperCase() });
  };

  return (
    <form className="login-form" onSubmit={enviar}>
      <div className="dos">
        <label>Nombre<input value={v.nombre} onChange={set('nombre')} autoComplete="given-name" required /></label>
        <label>Apellidos<input value={v.apellidos} onChange={set('apellidos')} autoComplete="family-name" required /></label>
      </div>
      <label>Teléfono<input type="tel" value={v.telefono} onChange={set('telefono')} autoComplete="tel" required /></label>
      <label>Cargo
        <select value={v.cargo} onChange={set('cargo')}>{CARGOS.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label>Correo electrónico
        <input type="email" value={v.email} onChange={set('email')} autoComplete="email" required readOnly={emailFijo} />
      </label>
      {conClave && (
        <div className="dos">
          <label>Contraseña<input type="password" value={v.clave} onChange={set('clave')} autoComplete="new-password" required minLength={8} /></label>
          <label>Repetir contraseña<input type="password" value={v.clave2} onChange={set('clave2')} autoComplete="new-password" required /></label>
        </div>
      )}

      <p className="sec-titulo">Grupo Guía y Scout</p>
      <div className="seg" style={{ margin: 0 }}>
        <button type="button" className={v.grupoModo === 'nuevo' ? 'on' : ''} onClick={() => setV({ ...v, grupoModo: 'nuevo' })}>Registrar mi grupo</button>
        <button type="button" className={v.grupoModo === 'unirse' ? 'on' : ''} onClick={() => setV({ ...v, grupoModo: 'unirse' })}>Ya existe (código)</button>
      </div>
      {v.grupoModo === 'nuevo' ? (
        <div className="dos">
          <label>Número de grupo<input value={v.numero} onChange={set('numero')} inputMode="numeric" placeholder="307" required /></label>
          <label>Localidad<input value={v.localidad} onChange={set('localidad')} placeholder="San Pedro" required /></label>
        </div>
      ) : (
        <label>Código del grupo
          <input value={v.codigo} onChange={set('codigo')} maxLength={8} required placeholder="Lo da el Jefe de Grupo"
            style={{ textTransform: 'uppercase', letterSpacing: '.15em' }} />
        </label>
      )}
      <p className="muted">
        {v.grupoModo === 'nuevo'
          ? 'Serás el administrador del grupo y aprobarás a los demás dirigentes.'
          : 'El administrador del grupo debe aprobar tu solicitud.'}
      </p>

      {(errorLocal || error) && <p className="error" role="alert">{errorLocal || error}</p>}
      <button className="btn primary block" disabled={ocupado}>{ocupado ? 'Un momento…' : boton}</button>
    </form>
  );
}
