export type ServerRole = 'doctor' | 'patient' | 'dispensary' | 'admin' | 'relayer';

export interface VerifiedTokenClaims {
  subject: string;
  issuer: string;
  audience: string;
  expiresAt: number;
  roles: readonly string[];
  scopes: readonly string[];
}

export interface TokenVerifier {
  readonly kind: string;
  verify(token: string): Promise<VerifiedTokenClaims>;
}

export interface AuthorizationPolicy {
  issuer: string;
  audience: string;
  allowedSubjects: Readonly<Record<string, readonly ServerRole[]>>;
  roleScopes: Readonly<Record<ServerRole, readonly string[]>>;
}

export interface AuthorizedPrincipal {
  subject: string;
  roles: ServerRole[];
  scopes: string[];
}

export function createServerAuthorizer(input: {
  verifier: TokenVerifier;
  policy: AuthorizationPolicy;
  now?: () => number;
}) {
  validatePolicy(input.policy);
  const now = input.now ?? (() => Math.floor(Date.now() / 1_000));

  return {
    async authorize(headers: Record<string, string | string[] | undefined>, required: {
      roles: readonly ServerRole[];
      scopes: readonly string[];
    }): Promise<AuthorizedPrincipal> {
      const token = bearerToken(headers.authorization);
      if (!token) throw authError('AUTH_REQUIRED', 401);

      let claims: VerifiedTokenClaims;
      try {
        claims = await input.verifier.verify(token);
      } catch {
        throw authError('TOKEN_INVALID', 401);
      }
      if (!claims?.subject || claims.issuer !== input.policy.issuer || claims.audience !== input.policy.audience || claims.expiresAt <= now()) {
        throw authError('TOKEN_INVALID', 401);
      }

      const allowedRoles = input.policy.allowedSubjects[claims.subject];
      if (!allowedRoles?.length) throw authError('SUBJECT_NOT_ALLOWLISTED', 403);
      const roles = unique(claims.roles.filter((role): role is ServerRole => allowedRoles.includes(role as ServerRole)));
      if (!required.roles.length || !required.roles.some(role => roles.includes(role))) throw authError('ROLE_FORBIDDEN', 403);

      const effectiveScopes = unique(roles.flatMap(role => input.policy.roleScopes[role]).filter(scope => claims.scopes.includes(scope)));
      if (!required.scopes.length || !required.scopes.every(scope => effectiveScopes.includes(scope))) throw authError('SCOPE_FORBIDDEN', 403);
      return { subject: claims.subject, roles, scopes: effectiveScopes };
    },
  };
}

function validatePolicy(policy: AuthorizationPolicy) {
  if (!policy.issuer?.trim() || !policy.audience?.trim()) throw authError('AUTH_POLICY_INVALID', 503);
  for (const [subject, roles] of Object.entries(policy.allowedSubjects)) {
    if (!subject.trim() || !roles.length || roles.some(role => !policy.roleScopes[role])) throw authError('AUTH_POLICY_INVALID', 503);
  }
}

function bearerToken(value: string | string[] | undefined) {
  if (Array.isArray(value) || typeof value !== 'string' || !value.startsWith('Bearer ')) return null;
  const token = value.slice(7).trim();
  return token && !/\s/.test(token) ? token : null;
}

function unique<T>(values: readonly T[]) { return [...new Set(values)]; }
function authError(code: string, statusCode: number) {
  return Object.assign(new Error('Authorization unavailable.'), { code, statusCode });
}
