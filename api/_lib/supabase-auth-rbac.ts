import type { TokenVerifier, VerifiedTokenClaims } from './server-authorization.ts';
import { createAsymmetricJwksTokenVerifier, createRemoteJwksProvider } from './jwks-token-verifier.ts';

export type SupabaseActorRole = 'doctor' | 'patient' | 'dispensary' | 'admin';
export type SupabaseActorState = 'pending' | 'active' | 'suspended' | 'revoked' | 'expired';
export type SupabasePermission =
  | 'actor:self:read'
  | 'actor:review'
  | 'envelope:read'
  | 'entitlement:read'
  | 'receipt:read'
  | 'audit:read';

export interface SupabaseActorBinding {
  subject: string;
  actorRef: string;
  role: SupabaseActorRole;
  state: SupabaseActorState;
  validUntil?: string;
}

export interface SupabaseRbacResource {
  kind: 'actor' | 'envelope' | 'entitlement' | 'receipt' | 'audit';
  ownerActorRef?: string;
  doctorActorRef?: string;
  patientActorRef?: string;
  authorizedActorRefs?: readonly string[];
}

export interface SupabaseRbacStore {
  actorBySubject(subject: string): Promise<SupabaseActorBinding | null>;
}

export interface SupabaseAuthorizedActor {
  subject: string;
  actorRef: string;
  role: SupabaseActorRole;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Supabase JWT claims prove identity only. Operational roles and object access
 * are resolved from the durable actor binding, never from user metadata/claims.
 */
export function createSupabaseRbacAuthorizer(input: {
  verifier: TokenVerifier;
  store: SupabaseRbacStore;
  issuer: string;
  audience?: string;
  now?: () => number;
}) {
  validateIssuer(input.issuer);
  const audience = input.audience ?? 'authenticated';
  const now = input.now ?? (() => Math.floor(Date.now() / 1_000));
  return {
    async authorize(
      headers: Record<string, string | string[] | undefined>,
      permission: SupabasePermission,
      resource: SupabaseRbacResource,
    ): Promise<SupabaseAuthorizedActor> {
      const claims = await verifyIdentity(input.verifier, headers, input.issuer, audience, now());
      const actor = await input.store.actorBySubject(claims.subject);
      if (!actor || actor.state !== 'active' || isExpired(actor.validUntil, now())) throw rbacError('ACTOR_NOT_ACTIVE', 403);
      if (!UUID.test(actor.actorRef) || actor.subject !== claims.subject) throw rbacError('ACTOR_BINDING_INVALID', 503);
      assertPermission(actor, permission, resource);
      return { subject: actor.subject, actorRef: actor.actorRef, role: actor.role };
    },
  };
}

export function createSupabaseTokenVerifier(projectUrl: string, fetcher?: typeof fetch): TokenVerifier {
  let url: URL;
  try { url = new URL(projectUrl); } catch { throw rbacError('SUPABASE_AUTH_POLICY_INVALID', 503); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw rbacError('SUPABASE_AUTH_POLICY_INVALID', 503);
  }
  const jwksUrl = new URL('/auth/v1/.well-known/jwks.json', url.origin).toString();
  return createAsymmetricJwksTokenVerifier(createRemoteJwksProvider({ url: jwksUrl, fetcher }), ['RS256', 'ES256']);
}

export function createSyntheticSupabaseRbacStore(bindings: readonly SupabaseActorBinding[]): SupabaseRbacStore {
  const subjects = new Set<string>();
  const actorRefs = new Set<string>();
  const actors = new Map<string, SupabaseActorBinding>();
  for (const binding of bindings) {
    if (!UUID.test(binding.subject) || !UUID.test(binding.actorRef) || subjects.has(binding.subject) || actorRefs.has(binding.actorRef)) {
      throw rbacError('RBAC_FIXTURE_INVALID', 503);
    }
    subjects.add(binding.subject);
    actorRefs.add(binding.actorRef);
    actors.set(binding.subject, Object.freeze(structuredClone(binding)));
  }
  return { async actorBySubject(subject) { return actors.get(subject) ?? null; } };
}

async function verifyIdentity(
  verifier: TokenVerifier,
  headers: Record<string, string | string[] | undefined>,
  issuer: string,
  audience: string,
  now: number,
): Promise<VerifiedTokenClaims> {
  const token = bearerToken(headers.authorization);
  if (!token) throw rbacError('AUTH_REQUIRED', 401);
  let claims: VerifiedTokenClaims;
  try { claims = await verifier.verify(token); } catch { throw rbacError('TOKEN_INVALID', 401); }
  if (!UUID.test(claims.subject) || claims.issuer !== issuer || claims.audience !== audience || claims.expiresAt <= now) {
    throw rbacError('TOKEN_INVALID', 401);
  }
  return claims;
}

function assertPermission(actor: SupabaseActorBinding, permission: SupabasePermission, resource: SupabaseRbacResource) {
  const ownActor = resource.kind === 'actor' && resource.ownerActorRef === actor.actorRef;
  const owner = resource.ownerActorRef === actor.actorRef;
  const assignedDoctor = resource.doctorActorRef === actor.actorRef;
  const assignedPatient = resource.patientActorRef === actor.actorRef;
  const explicitlyAuthorized = resource.authorizedActorRefs?.includes(actor.actorRef) ?? false;
  const admin = actor.role === 'admin';

  const allowed = permission === 'actor:self:read' ? ownActor
    : permission === 'actor:review' ? admin
      : permission === 'envelope:read' ? owner || explicitlyAuthorized
        : permission === 'entitlement:read' ? admin || assignedDoctor || assignedPatient
          : permission === 'receipt:read' ? admin || assignedDoctor || assignedPatient || (actor.role === 'dispensary' && explicitlyAuthorized)
            : permission === 'audit:read' ? admin || owner
              : false;
  if (!allowed) throw rbacError('OBJECT_ACCESS_FORBIDDEN', 403);
}

function bearerToken(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return null;
  const token = value.slice(7).trim();
  return token && !/\s/.test(token) ? token : null;
}

function isExpired(validUntil: string | undefined, now: number) {
  if (!validUntil) return false;
  const parsed = Date.parse(validUntil);
  return !Number.isFinite(parsed) || parsed <= now * 1_000;
}

function validateIssuer(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw rbacError('SUPABASE_AUTH_POLICY_INVALID', 503); }
  if (url.protocol !== 'https:' || !url.pathname.endsWith('/auth/v1')) throw rbacError('SUPABASE_AUTH_POLICY_INVALID', 503);
}

function rbacError(code: string, statusCode: number) {
  return Object.assign(new Error('Supabase authorization denied.'), { code, statusCode });
}
