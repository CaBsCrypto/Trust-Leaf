import assert from 'node:assert/strict';
import { createClinicalPersistencePort, createOpaqueClinicalRef } from '../api/_lib/clinical-platform-readiness.ts';

const key = Buffer.alloc(32, 26);
const subjectRef = createOpaqueClinicalRef(key, 'subject', 'fixture-subject-patient-0001');
const actorRef = createOpaqueClinicalRef(key, 'actor', 'fixture-actor-patient-0001');
const objectRef = createOpaqueClinicalRef(key, 'object', 'fixture-clinical-object-0001');
const store = createClinicalPersistencePort({ mode: 'memory-fixture' });

await store.putActor({ fixture: true, subjectRef, actorRef, role: 'patient', status: 'active', version: 1 }, null);
assert.equal((await store.getActorForSubject(subjectRef))?.actorRef, actorRef);
await store.putActor({ fixture: true, subjectRef, actorRef, role: 'patient', status: 'suspended', version: 2 }, 1);
await assert.rejects(
  store.putActor({ fixture: true, subjectRef, actorRef, role: 'patient', status: 'active', version: 2 }, 1),
  error => (error as { code?: string }).code === 'ACTOR_VERSION_CONFLICT',
);
await store.putEnvelope({
  fixture: true,
  objectRef,
  ownerActorRef: actorRef,
  kind: 'clinical-note',
  ciphertextRef: 'fixture-ciphertext:AAAAAAAAAAAAAAAA',
  wrappedKeyRef: 'fixture-wrapped-key:BBBBBBBBBBBBBBBB',
  keyVersion: 1,
  retentionClass: 'clinical-review-required',
});
assert.equal((await store.getEnvelope(objectRef, actorRef))?.objectRef, objectRef);
assert.equal(await store.getEnvelope(objectRef, createOpaqueClinicalRef(key, 'actor', 'fixture-actor-patient-0002')), null);

assert.throws(() => createClinicalPersistencePort({ mode: 'supabase-postgres' }), error => (error as { code?: string }).code === 'SUPABASE_PROJECT_URL_REQUIRED');
assert.throws(() => createClinicalPersistencePort({
  mode: 'supabase-postgres',
  projectUrl: 'https://fixture.supabase.invalid',
  jwksUrl: 'https://fixture.supabase.invalid/auth/v1/.well-known/jwks.json',
    databaseUrl: 'postgresql://synthetic.invalid/postgres?sslmode=require',
    kmsKeyId: 'fixture-external-kms-key',
    backupVerifiedAt: '2026-08-26T12:00:00Z',
    rlsEvidenceDigest: `sha256:${'a'.repeat(64)}`,
    approvedRlsEvidenceDigest: `sha256:${'a'.repeat(64)}`,
    allowedHosts: ['fixture.supabase.invalid', 'synthetic.invalid'],
    authIssuer: 'https://fixture.supabase.invalid/auth/v1',
    authAudience: 'authenticated',
    now: new Date('2026-08-26T13:00:00Z'),
}), error => (error as { code?: string }).code === 'SUPABASE_ADAPTER_NOT_PROVISIONED');
assert.throws(() => createOpaqueClinicalRef(key, 'actor', 'patient@example.invalid'), error => (error as { code?: string }).code === 'SYNTHETIC_ID_REQUIRED');
assert.throws(() => createOpaqueClinicalRef(Buffer.alloc(8), 'actor', 'fixture-actor-patient-0001'), error => (error as { code?: string }).code === 'NAMESPACE_KEY_INVALID');

console.log('clinical platform readiness tests passed');
