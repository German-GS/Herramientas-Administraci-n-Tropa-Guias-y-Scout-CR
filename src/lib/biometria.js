// Desbloqueo con huella / Face ID mediante WebAuthn (autenticador de la plataforma).
// La verificación ocurre en el dispositivo: protege el acceso a la sesión ya iniciada,
// no reemplaza el inicio de sesión con correo o Google.
const KEY = 'tropa.bio';
const aB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const reto = () => crypto.getRandomValues(new Uint8Array(32));

export async function bioDisponible() {
  try {
    return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

export function bioActivada(uid) {
  try {
    const b = JSON.parse(localStorage.getItem(KEY) || 'null');
    return b && b.uid === uid ? b : null;
  } catch { return null; }
}

export async function activarBio(user) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: reto(),
      rp: { name: 'Administración Tropa AGSCR', id: location.hostname },
      user: { id: new TextEncoder().encode(user.uid), name: user.email, displayName: user.displayName || user.email },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
    },
  });
  localStorage.setItem(KEY, JSON.stringify({ uid: user.uid, id: aB64(cred.rawId) }));
}

export async function verificarBio(b) {
  await navigator.credentials.get({
    publicKey: {
      challenge: reto(),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: deB64(b.id), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return true;
}

export const quitarBio = () => { try { localStorage.removeItem(KEY); } catch { /* nada */ } };
