import type { TrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import type { OnboardingCommand } from './contracts';

export async function onboardingRequest<T>(identity: TrustLeafPrivyIdentity, command: OnboardingCommand, signal: AbortSignal): Promise<T> {
  let token = await identity.getIdentityToken(); signal.throwIfAborted();
  if (!token) token = await identity.refreshIdentityToken?.() ?? null;
  signal.throwIfAborted();
  if (!token) throw Object.assign(new Error('Inicia sesion nuevamente.'), { status: 401 });
  const response = await fetch('/api/dispensary-onboarding', { method: 'POST', cache: 'no-store', signal,
    headers: { 'content-type': 'application/json', 'privy-id-token': token }, body: JSON.stringify(command) });
  const data: unknown = await response.json();
  if (!response.ok) throw Object.assign(new Error(response.status === 403 ? 'Esta cuenta o invitacion no tiene acceso a esta incorporacion. Verifica el correo conectado.'
    : response.status === 409 ? 'El proceso cambio o ya no permite esta accion. Actualiza antes de continuar.'
    : response.status === 429 ? 'Limite de envios alcanzado. Espera antes de volver a enviar.'
    : response.status === 400 ? 'Revisa los datos y la aceptacion de participacion.'
    : 'No se pudo confirmar el resultado. Reintenta sin cambiar la operacion.'), { status: response.status });
  return data as T;
}

const key = 'trustleaf-dispensary-invitation';
export function captureOnboardingInvitation(): string | null {
  if (window.location.pathname !== '/dispensario') return null;
  const token = new URLSearchParams(window.location.hash.slice(1)).get('dispensary-invite');
  if (token !== null) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    try { sessionStorage.setItem(key, JSON.stringify({ token, until: Date.now() + 7 * 86400000 })); } catch { /* Keep the current in-memory token. */ }
    return token;
  }
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (saved && typeof saved === 'object' && 'token' in saved && 'until' in saved && typeof saved.token === 'string'
      && typeof saved.until === 'number' && saved.until > Date.now() && /^[A-Za-z0-9_-]{43}$/.test(saved.token)) return saved.token;
    sessionStorage.removeItem(key);
  } catch { /* Storage is optional; profiles are never stored here. */ }
  return null;
}
export function clearOnboardingInvitation() { try { sessionStorage.removeItem(key); } catch { /* Storage unavailable. */ } }
