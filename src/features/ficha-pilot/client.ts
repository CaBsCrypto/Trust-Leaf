import type { TrustLeafPrivyIdentity } from '../../components/privyIdentityContext';

export async function requestFichaPilot(identity: TrustLeafPrivyIdentity, action: string, data: object,
  options: { signal?: AbortSignal; previousIdentityToken?: string } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  const identityToken = await identity.getIdentityToken();
  if (!identityToken) throw new Error('AUTH_REQUIRED');
  headers.set('privy-id-token', identityToken);
  if (action === 'enroll-account' || action === 'rebind-identity'
    || (import.meta.env.VITE_TRUSTLEAF_FICHA_LINK_SHARED_ENROLLMENT_ENABLED === 'true' && ['issue', 'resend'].includes(action))) {
    const accessToken = await identity.getAccessToken?.();
    if (!accessToken) throw new Error('AUTH_REQUIRED');
    headers.set('privy-access-token', accessToken);
  }
  if (options.previousIdentityToken && action === 'rebind-identity') headers.set('legacy-privy-id-token', options.previousIdentityToken);
  const response = await fetch('/api/ficha-link-pilot', {
    method: 'POST', cache: 'no-store', signal: options.signal, headers, body: JSON.stringify({ action, data }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.code ?? 'PILOT_UNAVAILABLE');
  return response;
}
