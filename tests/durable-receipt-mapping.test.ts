import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDurableReceiptMappingPort } from '../api/_lib/durable-receipt-mapping.ts';
import type { AuthorizedPrincipal, ServerRole } from '../api/_lib/server-authorization.ts';

const memoryConfig = { mode: 'memory-fixture' as const, retentionDays: 30 };
const dependencies = {
  namespaceKey: Buffer.alloc(32, 11),
  idempotencyKey: Buffer.alloc(32, 12),
  fixtureKek: Buffer.alloc(32, 13),
  random: (size: number) => Buffer.alloc(size, 14),
  now: () => new Date('2026-08-24T12:00:00Z'),
};

const principal = (subject: string, role: ServerRole, scopes: string[]): AuthorizedPrincipal => ({ subject, roles: [role], scopes });
const doctor = principal('fixture-subject-doctor-0001', 'doctor', ['receipt:issue', 'receipt:read']);
const patient = principal('fixture-subject-owner-0001', 'patient', ['receipt:read']);
const otherPatient = principal('fixture-subject-owner-0002', 'patient', ['receipt:read']);
const dispensary = principal('fixture-subject-operator-0001', 'dispensary', ['receipt:read', 'receipt:dispense']);
const otherDispensary = principal('fixture-subject-operator-0002', 'dispensary', ['receipt:read', 'receipt:dispense']);
const admin = principal('fixture-subject-admin-0001', 'admin', ['receipt:read', 'actor:manage']);

assert.throws(
  () => createDurableReceiptMappingPort({ mode: 'postgres', retentionDays: 30, databaseUrl: 'postgres://fixture.invalid', kmsKeyId: 'fixture' }, dependencies),
  error => (error as { code?: string }).code === 'DURABLE_MAPPING_ADAPTER_UNAVAILABLE',
);
assert.throws(
  () => createDurableReceiptMappingPort(memoryConfig, { ...dependencies, fixtureKek: Buffer.alloc(16) }),
  error => (error as { code?: string }).code === 'MAPPING_FIXTURE_KEK_INVALID',
);

const mapping = createDurableReceiptMappingPort(memoryConfig, dependencies);
await mapping.bindSubjectActor(doctor, { role: 'doctor', trustedSyntheticActorId: 'fixture-actor-doctor-0001', idempotencyKey: 'fixture-op-bind-doctor-0001' });
await mapping.bindSubjectActor(patient, { role: 'patient', trustedSyntheticActorId: 'fixture-actor-owner-0001', idempotencyKey: 'fixture-op-bind-owner-0001' });
await mapping.bindSubjectActor(otherPatient, { role: 'patient', trustedSyntheticActorId: 'fixture-actor-owner-0002', idempotencyKey: 'fixture-op-bind-owner-0002' });
await mapping.bindSubjectActor(dispensary, { role: 'dispensary', trustedSyntheticActorId: 'fixture-actor-operator-0001', idempotencyKey: 'fixture-op-bind-operator-0001' });
await mapping.bindSubjectActor(otherDispensary, { role: 'dispensary', trustedSyntheticActorId: 'fixture-actor-operator-0002', idempotencyKey: 'fixture-op-bind-operator-0002' });
await mapping.bindSubjectActor(admin, { role: 'admin', trustedSyntheticActorId: 'fixture-actor-admin-0001', idempotencyKey: 'fixture-op-bind-admin-0001' });

const actorReplay = await mapping.bindSubjectActor(doctor, {
  role: 'doctor',
  trustedSyntheticActorId: 'fixture-actor-doctor-0001',
  idempotencyKey: 'fixture-op-bind-doctor-0001',
});
assert.equal(actorReplay.replayed, true);
assert.doesNotMatch(actorReplay.actorRef, /doctor|fixture/);
assert.doesNotMatch(actorReplay.subjectRef, /doctor|fixture/);

await assert.rejects(
  mapping.bindSubjectActor(patient, { role: 'doctor', trustedSyntheticActorId: 'fixture-actor-tampered-0001', idempotencyKey: 'fixture-op-bind-tampered-0001' }),
  error => (error as { code?: string }).code === 'PRINCIPAL_BINDING_FORBIDDEN',
);
await assert.rejects(
  mapping.bindSubjectActor(doctor, { role: 'doctor', trustedSyntheticActorId: 'doctor@example.invalid', idempotencyKey: 'fixture-op-bind-email-0001' }),
  error => (error as { code?: string }).code === 'TRUSTED_SYNTHETIC_ACTOR_ID_REQUIRED',
);
await assert.rejects(
  mapping.bindSubjectActor(doctor, { role: 'doctor', trustedSyntheticActorId: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', idempotencyKey: 'fixture-op-bind-address-0001' }),
  error => (error as { code?: string }).code === 'TRUSTED_SYNTHETIC_ACTOR_ID_REQUIRED',
);

const issued = await mapping.createReceiptBinding(doctor, {
  trustedSyntheticReceiptId: 'fixture-receipt-case-0001',
  ownerSubject: patient.subject,
  operatorSubjects: [dispensary.subject],
  idempotencyKey: 'fixture-op-issue-case-0001',
});
assert.equal(issued.replayed, false);
assert.match(issued.publicHandle, /^tlq_[A-Za-z0-9_-]{43}$/);
assert.doesNotMatch(issued.receiptRef, /case|receipt|fixture/);

const issuedReplay = await mapping.createReceiptBinding(doctor, {
  trustedSyntheticReceiptId: 'fixture-receipt-case-0001',
  ownerSubject: patient.subject,
  operatorSubjects: [dispensary.subject],
  idempotencyKey: 'fixture-op-issue-case-0001',
});
assert.equal(issuedReplay.replayed, true);
assert.equal(issuedReplay.publicHandle, issued.publicHandle);
assert.equal(issuedReplay.receiptRef, issued.receiptRef);

await assert.rejects(
  mapping.createReceiptBinding(doctor, {
    trustedSyntheticReceiptId: 'fixture-receipt-case-0002',
    ownerSubject: patient.subject,
    operatorSubjects: [dispensary.subject],
    idempotencyKey: 'fixture-op-issue-case-0001',
  }),
  error => (error as { code?: string }).code === 'IDEMPOTENCY_REPLAY_MISMATCH',
);
await assert.rejects(
  mapping.createReceiptBinding(patient, {
    trustedSyntheticReceiptId: 'fixture-receipt-case-0003',
    ownerSubject: patient.subject,
    idempotencyKey: 'fixture-op-issue-case-0003',
  }),
  error => (error as { code?: string }).code === 'PRINCIPAL_BINDING_FORBIDDEN',
);
await assert.rejects(
  mapping.createReceiptBinding(doctor, {
    trustedSyntheticReceiptId: 'fixture-receipt-case-0004',
    ownerSubject: 'fixture-subject-not-bound-0001',
    idempotencyKey: 'fixture-op-issue-case-0004',
  }),
  error => (error as { code?: string }).code === 'OWNER_BINDING_REQUIRED',
);
await assert.rejects(
  mapping.createReceiptBinding(doctor, {
    trustedSyntheticReceiptId: 'eyJ4ZHIiOiJ0YW1wZXJlZCJ9',
    ownerSubject: patient.subject,
    idempotencyKey: 'fixture-op-issue-xdr-0001',
  }),
  error => (error as { code?: string }).code === 'TRUSTED_SYNTHETIC_RECEIPT_ID_REQUIRED',
);

assert.deepEqual(await mapping.authorizeReceipt(patient, 'fixture-receipt-case-0001', 'read'), { receiptRef: issued.receiptRef, role: 'patient', action: 'read' });
assert.deepEqual(await mapping.authorizeReceipt(doctor, 'fixture-receipt-case-0001', 'read'), { receiptRef: issued.receiptRef, role: 'doctor', action: 'read' });
assert.deepEqual(await mapping.authorizeReceipt(dispensary, 'fixture-receipt-case-0001', 'operate'), { receiptRef: issued.receiptRef, role: 'dispensary', action: 'operate' });
assert.deepEqual(await mapping.authorizeReceipt(admin, 'fixture-receipt-case-0001', 'admin'), { receiptRef: issued.receiptRef, role: 'admin', action: 'admin' });

for (const [candidate, action] of [
  [otherPatient, 'read'],
  [otherDispensary, 'read'],
  [doctor, 'operate'],
  [patient, 'operate'],
] as const) {
  await assert.rejects(
    mapping.authorizeReceipt(candidate, 'fixture-receipt-case-0001', action),
    error => (error as { code?: string }).code === 'RECEIPT_ACCESS_FORBIDDEN',
  );
}
const forgedDoctor = { ...doctor, subject: patient.subject };
await assert.rejects(
  mapping.authorizeReceipt(forgedDoctor, 'fixture-receipt-case-0001', 'read'),
  error => (error as { code?: string }).code === 'RECEIPT_ACCESS_FORBIDDEN',
);

assert.deepEqual(await mapping.resolvePublicHandle(issued.publicHandle), { receiptRef: issued.receiptRef });
const tamperedHandle = `${issued.publicHandle.slice(0, -1)}${issued.publicHandle.endsWith('A') ? 'B' : 'A'}`;
assert.equal(await mapping.resolvePublicHandle(tamperedHandle), null);
await assert.rejects(mapping.resolvePublicHandle('tlq_short'), error => (error as { code?: string }).code === 'PUBLIC_HANDLE_INVALID');

const implementation = await readFile(new URL('../api/_lib/durable-receipt-mapping.ts', import.meta.url), 'utf8');
assert.doesNotMatch(implementation, /submitTransaction|sendTransaction|prepareTransaction|invokeContract/);
const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
assert.match(envExample, /^TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false$/m);
assert.match(envExample, /^TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false$/m);

console.log('durable-receipt-mapping: encrypted opaque binding/ownership/idempotency/replay/cross-role gates passed');
