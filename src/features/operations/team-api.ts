import type { TrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { captureDispensaryInvitation, clearDispensaryInvitation } from '../../lib/dispensaryInvitation';
import { teamErrorMessage, type TeamCommand } from './team-contracts';

export async function teamRequest<T>(identity: TrustLeafPrivyIdentity, command: TeamCommand, signal: AbortSignal, beforeSend?: () => void): Promise<T> {
  let token = await identity.getIdentityToken();
  signal.throwIfAborted();
  if (!token) token = await identity.refreshIdentityToken?.() ?? null;
  signal.throwIfAborted();
  if (!token) throw Object.assign(new Error(teamErrorMessage(401)), { status: 401 });
  beforeSend?.();
  const response = await fetch('/api/team-invitations', { method: 'POST', cache: 'no-store', signal,
    headers: { 'content-type': 'application/json', 'privy-id-token': token }, body: JSON.stringify(command) });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(teamErrorMessage(response.status, payload.code)), { status: response.status });
  return payload as T;
}

export function captureTeamInvitation(): string | null {
  const entry = captureDispensaryInvitation();
  return entry?.kind === 'worker' ? entry.token : null;
}
export const clearTeamInvitation = clearDispensaryInvitation;
