import type { TrustLeafPrivyIdentity } from '../../components/privyIdentityContext';
import { teamErrorMessage, type TeamCommand } from './team-contracts';

export async function teamRequest<T>(identity: TrustLeafPrivyIdentity, command: TeamCommand, signal: AbortSignal): Promise<T> {
  let token = await identity.getIdentityToken();
  signal.throwIfAborted();
  if (!token) token = await identity.refreshIdentityToken?.() ?? null;
  signal.throwIfAborted();
  if (!token) throw Object.assign(new Error(teamErrorMessage(401)), { status: 401 });
  const response = await fetch('/api/team-invitations', { method: 'POST', cache: 'no-store', signal,
    headers: { 'content-type': 'application/json', 'privy-id-token': token }, body: JSON.stringify(command) });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(teamErrorMessage(response.status, payload.code)), { status: response.status });
  return payload as T;
}

const storageKey = 'trustleaf-team-invitation';
export function captureTeamInvitation(): string | null {
  if (window.location.pathname !== '/dispensario') return null;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const token = fragment.get('team-invite');
  if (token !== null) {
    // Fragments never go to the HTTP server; remove it before login/navigation.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ token, until: Date.now() + 7 * 86400000 })); } catch { /* Current page still retains the invitation. */ }
    return token;
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (saved && saved.until > Date.now() && /^[A-Za-z0-9_-]{43}$/.test(saved.token)) return saved.token;
    sessionStorage.removeItem(storageKey);
  } catch { /* Storage can be unavailable. */ }
  return null;
}
export function clearTeamInvitation() { try { sessionStorage.removeItem(storageKey); } catch { /* No stored invitation. */ } }
