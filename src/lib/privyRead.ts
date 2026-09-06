type ReadIdentity = {
  getIdentityToken(): Promise<string | null>;
  refreshIdentityToken?: () => Promise<string | null>;
};

// Only same-origin, read-only admin endpoints can use authentication recovery.
export async function readPrivyAdminJson<T>(path: string, identity: ReadIdentity, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<T> {
  if (!/^\/api\/auth\/privy\/admin\/(?:actors(?:\?offset=\d+)?|pending-actors)$/.test(path)) throw new Error('INVALID_READ_ROUTE');
  let token = await identity.getIdentityToken();
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    if (!token) {
      if (attempt === 0 && identity.refreshIdentityToken) { token = await identity.refreshIdentityToken(); continue; }
      throw new Error('SESSION_REQUIRED');
    }
    const response = await fetcher(path, { method: 'GET', cache: 'no-store', headers: { 'privy-id-token': token }, signal });
    if (response.status === 401 && attempt === 0 && identity.refreshIdentityToken) {
      token = await identity.refreshIdentityToken();
      continue;
    }
    if (!response.ok) throw new Error(response.status === 401 ? 'SESSION_REQUIRED' : 'READ_UNAVAILABLE');
    return await response.json() as T;
  }
  throw new Error('SESSION_REQUIRED');
}
