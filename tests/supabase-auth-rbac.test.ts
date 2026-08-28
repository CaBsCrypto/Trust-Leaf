import assert from 'node:assert/strict';
import {
  createSupabaseRbacAuthorizer,
  createSyntheticSupabaseRbacStore,
  type SupabaseActorBinding,
} from '../api/_lib/supabase-auth-rbac.ts';
import type { TokenVerifier, VerifiedTokenClaims } from '../api/_lib/server-authorization.ts';

const now = 2_000;
const issuer = 'https://synthetic.supabase.invalid/auth/v1';
const subjects = {
  doctor: '00000000-0000-4000-8000-000000000001',
  patient: '00000000-0000-4000-8000-000000000002',
  dispensary: '00000000-0000-4000-8000-000000000003',
  admin: '00000000-0000-4000-8000-000000000004',
  outsider: '00000000-0000-4000-8000-000000000005',
  suspended: '00000000-0000-4000-8000-000000000006',
};
const actors = {
  doctor: '10000000-0000-4000-8000-000000000001',
  patient: '10000000-0000-4000-8000-000000000002',
  dispensary: '10000000-0000-4000-8000-000000000003',
  admin: '10000000-0000-4000-8000-000000000004',
  suspended: '10000000-0000-4000-8000-000000000006',
};
const bindings: SupabaseActorBinding[] = [
  { subject: subjects.doctor, actorRef: actors.doctor, role: 'doctor', state: 'active' },
  { subject: subjects.patient, actorRef: actors.patient, role: 'patient', state: 'active' },
  { subject: subjects.dispensary, actorRef: actors.dispensary, role: 'dispensary', state: 'active' },
  { subject: subjects.admin, actorRef: actors.admin, role: 'admin', state: 'active' },
  { subject: subjects.suspended, actorRef: actors.suspended, role: 'doctor', state: 'suspended' },
];
const claims = new Map<string, VerifiedTokenClaims>();
for (const [role, subject] of Object.entries(subjects)) {
  claims.set(`token-${role}`, {
    subject,
    issuer,
    audience: 'authenticated',
    expiresAt: 3_000,
    // These untrusted operational claims are intentionally wrong or elevated.
    roles: role === 'patient' ? ['admin'] : [role],
    scopes: ['*'],
  });
}
const verifier: TokenVerifier = {
  kind: 'synthetic-supabase-jwks',
  async verify(token) {
    const value = claims.get(token);
    if (!value) throw new Error('INVALID');
    return value;
  },
};
const authorize = createSupabaseRbacAuthorizer({
  verifier,
  store: createSyntheticSupabaseRbacStore(bindings),
  issuer,
  now: () => now,
});
const headers = (role: keyof typeof subjects) => ({ authorization: `Bearer token-${role}` });
const receipt = {
  kind: 'receipt' as const,
  doctorActorRef: actors.doctor,
  patientActorRef: actors.patient,
  authorizedActorRefs: [actors.dispensary],
};

assert.equal((await authorize.authorize(headers('doctor'), 'receipt:read', receipt)).role, 'doctor');
assert.equal((await authorize.authorize(headers('patient'), 'receipt:read', receipt)).role, 'patient');
assert.equal((await authorize.authorize(headers('dispensary'), 'receipt:read', receipt)).role, 'dispensary');
assert.equal((await authorize.authorize(headers('admin'), 'receipt:read', receipt)).role, 'admin');
await assert.rejects(
  authorize.authorize(headers('patient'), 'actor:review', { kind: 'actor', ownerActorRef: actors.patient }),
  error => (error as { code?: string }).code === 'OBJECT_ACCESS_FORBIDDEN',
);
await assert.rejects(
  authorize.authorize(headers('doctor'), 'receipt:read', { ...receipt, doctorActorRef: actors.suspended }),
  error => (error as { code?: string }).code === 'OBJECT_ACCESS_FORBIDDEN',
);
await assert.rejects(
  authorize.authorize(headers('outsider'), 'receipt:read', receipt),
  error => (error as { code?: string }).code === 'ACTOR_NOT_ACTIVE',
);
await assert.rejects(
  authorize.authorize(headers('suspended'), 'receipt:read', receipt),
  error => (error as { code?: string }).code === 'ACTOR_NOT_ACTIVE',
);
await assert.rejects(
  authorize.authorize({}, 'receipt:read', receipt),
  error => (error as { code?: string }).code === 'AUTH_REQUIRED',
);
claims.set('token-expired', { ...claims.get('token-doctor')!, expiresAt: 1_999 });
await assert.rejects(
  authorize.authorize({ authorization: 'Bearer token-expired' }, 'receipt:read', receipt),
  error => (error as { code?: string }).code === 'TOKEN_INVALID',
);

console.log('supabase auth/RBAC: authorized roles, cross-tenant denial, suspended/unbound/expired/token negatives passed');
