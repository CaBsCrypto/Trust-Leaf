import { policyFromEnv } from './admin-readiness.ts';
import { createRemoteJwksProvider, createRs256JwksTokenVerifier } from './jwks-token-verifier.ts';
import { createServerAuthorizer, type AuthorizedPrincipal, type ServerRole } from './server-authorization.ts';

export type LegacyRouteRequirement = {
  access: 'public' | 'protected';
  roles?: readonly ServerRole[];
  scopes?: readonly string[];
};

type RouteRule = {
  method: string;
  path: RegExp;
  roles: readonly ServerRole[];
  scopes: readonly string[];
};

const PUBLIC_ROUTES = [
  ['GET', /^\/api\/stellar\/(?:health|contracts|readiness)$/],
  ['GET', /^\/api\/passkeys\/health$/],
] as const;

const PROTECTED_ROUTES: readonly RouteRule[] = [
  { method: 'POST', path: /^\/api\/stellar\/faucet$/, roles: ['admin'], scopes: ['testnet:faucet'] },
  { method: 'POST', path: /^\/api\/stellar\/derive-wallet$/, roles: ['patient'], scopes: ['wallet:derive'] },
  { method: 'GET', path: /^\/api\/stellar\/patient\/[^/]+\/dashboard$/, roles: ['patient', 'doctor', 'admin'], scopes: ['receipt:read'] },
  { method: 'POST', path: /^\/api\/stellar\/doctor\/(?:issue-prescription|build-issue-prescription)$/, roles: ['doctor'], scopes: ['receipt:issue'] },
  { method: 'POST', path: /^\/api\/stellar\/dispensary\/(?:dispense-prescription|build-dispense-prescription)$/, roles: ['dispensary'], scopes: ['receipt:dispense'] },
  { method: 'POST', path: /^\/api\/stellar\/dispensary\/(?:retain-prescription|build-retain-prescription)$/, roles: ['dispensary'], scopes: ['receipt:retain'] },
  { method: 'POST', path: /^\/api\/stellar\/dispensary\/(?:release-prescription|build-release-prescription)$/, roles: ['dispensary'], scopes: ['receipt:release'] },
  { method: 'POST', path: /^\/api\/stellar\/dispensary\/validate-prescription$/, roles: ['dispensary'], scopes: ['receipt:read'] },
  { method: 'POST', path: /^\/api\/stellar\/submit$/, roles: ['relayer'], scopes: ['receipt:submit'] },
  { method: 'POST', path: /^\/api\/stellar\/admin\/verify-sis$/, roles: ['admin'], scopes: ['actor:verify'] },
  { method: 'POST', path: /^\/api\/stellar\/admin\/(?:register|revoke)-(?:doctor|dispensary)$/, roles: ['admin'], scopes: ['actor:manage'] },
  { method: 'GET', path: /^\/api\/stellar\/(?:verify-passport\/[^/]+|prescription\/[^/]+\/verify)$/, roles: ['patient', 'doctor', 'dispensary', 'admin'], scopes: ['receipt:read'] },
  { method: 'POST', path: /^\/api\/passkeys\/send$/, roles: ['patient'], scopes: ['wallet:send'] },
  { method: 'GET', path: /^\/api\/passkeys\/contract\/[^/]+$/, roles: ['patient'], scopes: ['wallet:read'] },
  { method: 'GET', path: /^\/api\/defindex\/(?:vaults|balance\/[^/]+\/[^/]+)$/, roles: ['patient', 'admin'], scopes: ['finance:read'] },
  { method: 'POST', path: /^\/api\/defindex\/(?:build-deposit|build-withdraw|build-withdraw-shares|custodial-deposit|custodial-withdraw)$/, roles: ['patient', 'admin'], scopes: ['finance:write'] },
  { method: 'POST', path: /^\/api\/defindex\/submit$/, roles: ['admin'], scopes: ['finance:write'] },
];

const LEGACY_NAMESPACES = /^\/api\/(?:stellar|passkeys|defindex)(?:\/|$)/;

export function resolveLegacyRouteRequirement(method: string, path: string): LegacyRouteRequirement | null {
  const normalizedMethod = method.toUpperCase();
  if (PUBLIC_ROUTES.some(([candidateMethod, candidatePath]) => candidateMethod === normalizedMethod && candidatePath.test(path))) {
    return { access: 'public' };
  }
  const rule = PROTECTED_ROUTES.find(candidate => candidate.method === normalizedMethod && candidate.path.test(path));
  if (rule) return { access: 'protected', roles: rule.roles, scopes: rule.scopes };
  if (LEGACY_NAMESPACES.test(path)) throw authError('ROUTE_DENIED_BY_DEFAULT', 403);
  return null;
}

export function createLegacyRouteAuthorizer(
  env: Record<string, string | undefined>,
  dependencies: { fetcher?: typeof fetch; now?: () => number } = {},
) {
  const verifier = createRs256JwksTokenVerifier(createRemoteJwksProvider({
    url: required(env.TRUSTLEAF_AUTH_JWKS_URL),
    fetcher: dependencies.fetcher,
  }));
  const authorizer = createServerAuthorizer({ verifier, policy: policyFromEnv(env), now: dependencies.now });
  return async (headers: Record<string, string | string[] | undefined>, method: string, path: string): Promise<AuthorizedPrincipal | null> => {
    const requirement = resolveLegacyRouteRequirement(method, path);
    if (!requirement || requirement.access === 'public') return null;
    return authorizer.authorize(headers, { roles: requirement.roles ?? [], scopes: requirement.scopes ?? [] });
  };
}

export function createLegacyAuthorizationMiddleware(
  env: Record<string, string | undefined>,
  dependencies: { fetcher?: typeof fetch; now?: () => number } = {},
) {
  let authorizeRoute: ReturnType<typeof createLegacyRouteAuthorizer> | null = null;
  let setupError: { code?: string; statusCode?: number } | null = null;
  try {
    authorizeRoute = createLegacyRouteAuthorizer(env, dependencies);
  } catch (error) {
    setupError = error as { code?: string; statusCode?: number };
  }
  return async (
    req: { method: string; path: string; headers: Record<string, string | string[] | undefined> },
    res: { locals: Record<string, unknown>; status(code: number): { json(body: unknown): unknown } },
    next: () => unknown,
  ) => {
    try {
      const requirement = resolveLegacyRouteRequirement(req.method, req.path);
      if (!requirement || requirement.access === 'public') return next();
      if (!authorizeRoute) return res.status(setupError?.statusCode ?? 503).json({ code: setupError?.code ?? 'AUTH_CONFIGURATION_MISSING' });
      res.locals.authPrincipal = await authorizeRoute(req.headers, req.method, req.path);
      return next();
    } catch (error) {
      const candidate = error as { code?: string; statusCode?: number };
      return res.status(candidate.statusCode ?? 503).json({ code: candidate.code ?? 'AUTH_UNAVAILABLE' });
    }
  };
}

function required(value: string | undefined) {
  if (!value?.trim()) throw authError('AUTH_CONFIGURATION_MISSING', 503);
  return value.trim();
}

function authError(code: string, statusCode: number) {
  return Object.assign(new Error('Authorization unavailable.'), { code, statusCode });
}
