import type { TrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { captureDispensaryInvitation, clearDispensaryInvitation } from '../../lib/dispensaryInvitation';
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

export function captureOnboardingInvitation(): string | null {
  const entry = captureDispensaryInvitation();
  return entry?.kind === 'manager' ? entry.token : null;
}
export const clearOnboardingInvitation = clearDispensaryInvitation;
