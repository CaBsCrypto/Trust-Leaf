import type { PrivyIdentity } from './privy-identity.ts';

export type PrivyActorRole = 'doctor' | 'patient' | 'dispensary' | 'admin';
export type PrivyActorState = 'pending' | 'active' | 'suspended' | 'revoked' | 'expired';

export interface PrivyActorBinding {
  actorRef: string;
  role: PrivyActorRole;
  state: PrivyActorState;
  validUntil?: string;
}

export interface PrivyActorStore {
  resolve(subject: string): Promise<PrivyActorBinding | null>;
  bootstrapFirstAdmin(subject: string): Promise<PrivyActorBinding>;
}

export function createSupabasePrivyActorStore(
  env: Record<string, string | undefined>,
  fetcher: typeof fetch = fetch,
): PrivyActorStore {
  const projectUrl = requiredUrl(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL);
  const serviceKey = required(
    env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
    'SUPABASE_SERVER_KEY_MISSING',
  );
  const endpoint = new URL('/rest/v1/rpc/trustleaf_resolve_privy_actor', projectUrl).toString();
  const bootstrapEndpoint = new URL('/rest/v1/rpc/trustleaf_bootstrap_first_privy_admin', projectUrl).toString();

  return {
    async resolve(subject) {
      if (!isPrivyDid(subject)) return null;
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ subject }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        throw rbacError('PRIVY_ACTOR_STORE_UNAVAILABLE', 503);
      }
      if (!response.ok) throw rbacError('PRIVY_ACTOR_STORE_UNAVAILABLE', 503);
      const rows = await response.json() as unknown;
      if (!Array.isArray(rows) || rows.length === 0) return null;
      if (rows.length !== 1) throw rbacError('PRIVY_ACTOR_BINDING_AMBIGUOUS', 503);
      return parseBinding(rows[0]);
    },
    async bootstrapFirstAdmin(subject) {
      if (!isPrivyDid(subject)) throw rbacError('PRIVY_IDENTITY_SUBJECT_INVALID', 401);
      let response: Response;
      try {
        response = await fetcher(bootstrapEndpoint, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ subject }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        throw rbacError('PRIVY_ADMIN_BOOTSTRAP_UNAVAILABLE', 503);
      }
      if (!response.ok) {
        const diagnostic = await readSafeSupabaseDiagnostic(response);
        // Only diagnostic categories are logged. Tokens, subjects, emails and DB payloads stay private.
        console.error('Privy admin bootstrap rejected by Supabase.', diagnostic);
        throw rbacError(diagnostic.code, diagnostic.statusCode);
      }
      const rows = await response.json() as unknown;
      if (!Array.isArray(rows) || rows.length !== 1) throw rbacError('PRIVY_ADMIN_BOOTSTRAP_UNAVAILABLE', 503);
      return parseBinding(rows[0]);
    },
  };
}

async function readSafeSupabaseDiagnostic(response: Response) {
  const fallback = { code: 'PRIVY_ADMIN_BOOTSTRAP_UNAVAILABLE', statusCode: 503 } as const;
  let body: unknown;
  try { body = await response.json(); } catch { return fallback; }
  if (!body || typeof body !== 'object') return fallback;
  const code = (body as Record<string, unknown>).code;
  if (code === 'PGRST202' || code === '42883') {
    return { code: 'PRIVY_ADMIN_BOOTSTRAP_SCHEMA_UNAVAILABLE', statusCode: 503 } as const;
  }
  if (code === '42501') {
    return { code: 'PRIVY_ADMIN_BOOTSTRAP_PERMISSION_DENIED', statusCode: 503 } as const;
  }
  return fallback;
}

export function createPrivyRbacAuthorizer(input: {
  verifier: { verify(token: string): Promise<PrivyIdentity> };
  store: PrivyActorStore;
  now?: () => number;
}) {
  const now = input.now ?? (() => Math.floor(Date.now() / 1_000));
  return {
    async authorize(identityToken: string, allowedRoles: readonly PrivyActorRole[]) {
      const identity = await input.verifier.verify(identityToken);
      const actor = await input.store.resolve(identity.subject);
      if (!actor || actor.state !== 'active' || isExpired(actor.validUntil, now())) {
        throw rbacError('PRIVY_ACTOR_NOT_ACTIVE', 403);
      }
      if (!allowedRoles.includes(actor.role)) throw rbacError('PRIVY_ROLE_FORBIDDEN', 403);
      return { subject: identity.subject, ...actor };
    },
  };
}

function parseBinding(value: unknown): PrivyActorBinding {
  if (!value || typeof value !== 'object') throw rbacError('PRIVY_ACTOR_BINDING_INVALID', 503);
  const record = value as Record<string, unknown>;
  const actorRef = record.actor_ref;
  const role = record.role;
  const state = record.actor_state;
  const validUntil = record.valid_until;
  if (typeof actorRef !== 'string' || !UUID.test(actorRef) || !isRole(role) || !isState(state)
    || (validUntil !== null && validUntil !== undefined && (typeof validUntil !== 'string' || !Number.isFinite(Date.parse(validUntil))))) {
    throw rbacError('PRIVY_ACTOR_BINDING_INVALID', 503);
  }
  return { actorRef, role, state, ...(typeof validUntil === 'string' ? { validUntil } : {}) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set<PrivyActorRole>(['doctor', 'patient', 'dispensary', 'admin']);
const STATES = new Set<PrivyActorState>(['pending', 'active', 'suspended', 'revoked', 'expired']);
function isRole(value: unknown): value is PrivyActorRole { return typeof value === 'string' && ROLES.has(value as PrivyActorRole); }
function isState(value: unknown): value is PrivyActorState { return typeof value === 'string' && STATES.has(value as PrivyActorState); }
function isPrivyDid(value: string) { return /^did:privy:[A-Za-z0-9._:-]{6,500}$/.test(value); }
function isExpired(value: string | undefined, now: number) { return Boolean(value && Date.parse(value) <= now * 1_000); }
function required(value: string | undefined, code: string) { if (!value?.trim()) throw rbacError(code, 503); return value.trim(); }
function requiredUrl(value: string | undefined) {
  const raw = required(value, 'SUPABASE_URL_MISSING');
  let url: URL;
  try { url = new URL(raw); } catch { throw rbacError('SUPABASE_URL_INVALID', 503); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw rbacError('SUPABASE_URL_INVALID', 503);
  return url;
}
function rbacError(code: string, statusCode: number) { return Object.assign(new Error('Privy authorization denied.'), { code, statusCode }); }
