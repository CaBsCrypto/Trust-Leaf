import { PrivyClient } from '@privy-io/node';

export interface PrivyIdentity {
  subject: string;
}

export interface PrivyUserReader {
  users(): { get(input: { id_token: string }): Promise<{ id: string }> };
}

/**
 * Verifies a Privy identity token on the server. The client never submits a
 * role: the resulting DID is only an input for the private role binding.
 */
export function createPrivyIdentityVerifier(
  env: Record<string, string | undefined>,
  client?: PrivyUserReader,
) {
  const appId = required(env.PRIVY_APP_ID);
  const appSecret = required(env.PRIVY_APP_SECRET);
  const reader = client ?? new PrivyClient({ appId, appSecret });
  return {
    async verify(identityToken: string): Promise<PrivyIdentity> {
      if (!identityToken?.trim() || identityToken.length > 12_000) throw identityError('PRIVY_IDENTITY_TOKEN_INVALID', 401);
      try {
        const user = await reader.users().get({ id_token: identityToken });
        if (!isPrivyDid(user?.id)) throw identityError('PRIVY_IDENTITY_SUBJECT_INVALID', 401);
        return { subject: user.id };
      } catch (error) {
        if (isIdentityError(error)) throw error;
        throw identityError('PRIVY_IDENTITY_TOKEN_INVALID', 401);
      }
    },
  };
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
