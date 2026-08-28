import { inspectAuthCustodyReadiness } from './auth-custody-readiness.ts';
import { createRemoteJwksProvider, createRs256JwksTokenVerifier } from './jwks-token-verifier.ts';
import { createServerAuthorizer, type AuthorizationPolicy, type ServerRole } from './server-authorization.ts';

export const ROLE_SCOPES: AuthorizationPolicy['roleScopes'] = {
  admin: ['admin:readiness:read', 'receipt:read', 'actor:manage', 'actor:verify', 'testnet:faucet', 'finance:read', 'finance:write'],
  doctor: ['receipt:read', 'receipt:issue'],
  patient: ['receipt:read', 'patient:dashboard:read', 'wallet:derive', 'wallet:read', 'wallet:send', 'finance:read', 'finance:write'],
  dispensary: ['receipt:read', 'receipt:dispense', 'receipt:retain', 'receipt:release'],
  relayer: ['receipt:submit'],
};

export function createAdminReadinessController(env: Record<string, string | undefined>, dependencies: { fetcher?: typeof fetch; now?: () => number } = {}) {
  const policy = policyFromEnv(env);
  const verifier = createRs256JwksTokenVerifier(createRemoteJwksProvider({ url: required(env.TRUSTLEAF_AUTH_JWKS_URL), fetcher: dependencies.fetcher }));
  const authorizer = createServerAuthorizer({ verifier, policy, now: dependencies.now });
  return async (headers: Record<string, string | string[] | undefined>) => {
    const principal = await authorizer.authorize(headers, { roles: ['admin'], scopes: ['admin:readiness:read'] });
    const readiness = inspectAuthCustodyReadiness(env);
    return {
      mode: 'read-only' as const,
      subject: principal.subject,
      submissionEnabled: false,
      mutationsAvailable: false,
      readiness,
    };
  };
}

export function policyFromEnv(env: Record<string, string | undefined>): AuthorizationPolicy {
  const raw = required(env.TRUSTLEAF_AUTH_SUBJECT_ALLOWLIST_JSON);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw unavailable('AUTH_ALLOWLIST_INVALID'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw unavailable('AUTH_ALLOWLIST_INVALID');
  const allowedSubjects: Record<string, ServerRole[]> = {};
  for (const [subject, roles] of Object.entries(parsed)) {
    if (!subject.trim() || !Array.isArray(roles) || !roles.length || roles.some(role => typeof role !== 'string' || !(role in ROLE_SCOPES))) throw unavailable('AUTH_ALLOWLIST_INVALID');
    allowedSubjects[subject] = roles as ServerRole[];
  }
  if (!Object.keys(allowedSubjects).length) throw unavailable('AUTH_ALLOWLIST_MISSING');
  return { issuer: required(env.TRUSTLEAF_AUTH_ISSUER), audience: required(env.TRUSTLEAF_AUTH_AUDIENCE), allowedSubjects, roleScopes: ROLE_SCOPES };
}

function required(value: string | undefined) { if (!value?.trim()) throw unavailable('AUTH_CONFIGURATION_MISSING'); return value.trim(); }
function unavailable(code: string) { return Object.assign(new Error('Authorization unavailable.'), { code, statusCode: 503 }); }
