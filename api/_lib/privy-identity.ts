import { PrivyClient, verifyAccessToken, verifyIdentityToken } from '@privy-io/node';

export interface PrivyIdentity {
  subject: string;
  emails: readonly string[];
}

export interface PrivyUserReader {
  users(): { get(input: { id_token: string }): Promise<{ id: string; linked_accounts?: unknown[] }> };
}

/**
 * Verifies a Privy identity token on the server. The client never submits a
 * role: the resulting DID is only an input for the private role binding.
 */
export function createPrivyIdentityVerifier(
  env: Record<string, string | undefined>,
  client?: PrivyUserReader,
) {
  if (!client && env.TRUSTLEAF_FICHA_LINK_PILOT_ENABLED === 'true'
    && env.TRUSTLEAF_FICHA_LINK_SHARED_ENROLLMENT_ENABLED === 'true' && env.TRUSTLEAF_FICHA_LINK_MODE === 'synthetic'
    && env.STELLAR_NETWORK === 'testnet' && env.VERCEL_ENV !== 'production'
    && (env.VERCEL_ENV === 'preview' || env.NODE_ENV !== 'production')) {
    const appId = required(env.TRUSTLEAF_SHARED_PRIVY_APP_ID);
    const key = required(env.TRUSTLEAF_SHARED_PRIVY_VERIFICATION_KEY).replaceAll('\\n', '\n');
    return { async verify(identityToken: string) {
      if (!identityToken?.trim() || identityToken.length > 12_000) throw identityError('PRIVY_IDENTITY_TOKEN_INVALID', 401);
      try {
        const user = await verifyIdentityToken({ identity_token: identityToken, app_id: appId, verification_key: key });
        if (!isPrivyDid(user.id)) throw identityError('PRIVY_IDENTITY_SUBJECT_INVALID', 401);
        return { subject: user.id, emails: linkedAccountEmails(user.linked_accounts) };
      } catch { throw identityError('PRIVY_IDENTITY_TOKEN_INVALID', 401); }
    } };
  }
  return createLegacyPrivyIdentityVerifier(env, client);
}

export function createLegacyPrivyIdentityVerifier(env: Record<string, string | undefined>, client?: PrivyUserReader) {
  const appId = required(env.PRIVY_APP_ID);
  const appSecret = required(env.PRIVY_APP_SECRET);
  const reader = client ?? new PrivyClient({ appId, appSecret });
  return {
    async verify(identityToken: string): Promise<PrivyIdentity> {
      if (!identityToken?.trim() || identityToken.length > 12_000) throw identityError('PRIVY_IDENTITY_TOKEN_INVALID', 401);
      try {
        const user = await reader.users().get({ id_token: identityToken });
        if (!isPrivyDid(user?.id)) throw identityError('PRIVY_IDENTITY_SUBJECT_INVALID', 401);
        return { subject: user.id, emails: linkedAccountEmails(user.linked_accounts) };
      } catch (error) {
        if (isIdentityError(error)) throw error;
        throw identityError('PRIVY_IDENTITY_TOKEN_INVALID', 401);
      }
    },
  };
}

export async function verifySharedPrivyAccessToken(token: string, env: Record<string, string | undefined>) {
  const appId = required(env.TRUSTLEAF_SHARED_PRIVY_APP_ID);
  const clientId = required(env.TRUSTLEAF_SHARED_PRIVY_CLIENT_ID);
  const key = required(env.TRUSTLEAF_SHARED_PRIVY_VERIFICATION_KEY).replaceAll('\\n', '\n');
  if (token.length > 12_000) throw identityError('PRIVY_ACCESS_TOKEN_INVALID', 401);
  try {
    const verified = await verifyAccessToken({ access_token: token, app_id: appId, verification_key: key });
    // The SDK verifies the signature first and omits additional claims from its projection.
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (!isPrivyDid(verified.user_id) || claims.app_client_id !== clientId
      || !Number.isInteger(verified.issued_at) || verified.issued_at > Math.floor(Date.now() / 1000) + 30
      || !Number.isInteger(verified.expiration) || verified.expiration <= verified.issued_at) {
      throw identityError('PRIVY_ACCESS_TOKEN_INVALID', 401);
    }
    return verified.user_id;
  } catch { throw identityError('PRIVY_ACCESS_TOKEN_INVALID', 401); }
}

function linkedAccountEmails(accounts: unknown): readonly string[] {
  if (!Array.isArray(accounts)) return [];
  const unique = new Set<string>();
  for (const account of accounts) {
    if (!account || typeof account !== 'object') continue;
    const record = account as Record<string, unknown>;
    // Privy returns `address` for email login and `email` for Google OAuth.
    for (const candidate of [record.address, record.email]) {
      if (typeof candidate !== 'string') continue;
      const email = candidate.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) unique.add(email);
    }
  }
  return [...unique];
}

function required(value: string | undefined) {
  if (!value?.trim()) throw identityError('PRIVY_SERVER_CONFIGURATION_MISSING', 503);
  return value.trim();
}

function isPrivyDid(value: unknown): value is string {
  return typeof value === 'string' && /^did:privy:[A-Za-z0-9._:-]{6,500}$/.test(value);
}

function isIdentityError(error: unknown): error is Error & { code: string; statusCode: number } {
  return Boolean(error && typeof error === 'object' && 'code' in error && 'statusCode' in error);
}

function identityError(code: string, statusCode: number) {
  return Object.assign(new Error('Privy identity verification failed.'), { code, statusCode });
}
