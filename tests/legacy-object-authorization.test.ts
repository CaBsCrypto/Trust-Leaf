import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createInMemoryLegacyObjectAuthorizationPort,
  createLegacyObjectAuthorizationMiddleware,
  createLegacyObjectAuthorizer,
  objectAuthorizationPortFromEnv,
  type ActorBinding,
  type ReceiptBinding,
} from '../api/_lib/legacy-object-authorization.ts';
import type { AuthorizedPrincipal, ServerRole } from '../api/_lib/server-authorization.ts';

const account = (character: string) => `G${character.repeat(55)}`;
const actors: ActorBinding[] = [
  { subject: 'synthetic-doctor-a', actorId: 'tla_doctor_a01', roles: ['doctor'], stellarAccountId: account('A') },
  { subject: 'synthetic-doctor-b', actorId: 'tla_doctor_b02', roles: ['doctor'], stellarAccountId: account('B') },
  { subject: 'synthetic-patient-a', actorId: 'tla_patient_a01', roles: ['patient'], stellarAccountId: account('C'), passkeyKeyId: 'fixture-passkey-a' },
  { subject: 'synthetic-patient-b', actorId: 'tla_patient_b02', roles: ['patient'], stellarAccountId: account('D'), passkeyKeyId: 'fixture-passkey-b' },
  { subject: 'synthetic-dispensary-a', actorId: 'tla_dispensary_a01', roles: ['dispensary'], stellarAccountId: account('E') },
  { subject: 'synthetic-dispensary-b', actorId: 'tla_dispensary_b02', roles: ['dispensary'], stellarAccountId: account('F') },
  { subject: 'synthetic-admin-a', actorId: 'tla_admin_a001', roles: ['admin'], stellarAccountId: account('G') },
];
const receipts: ReceiptBinding[] = [
  {
    receiptId: '101', receiptHandle: 'tlr_receipt_fixture_101',
    doctorActorId: 'tla_doctor_a01', patientActorId: 'tla_patient_a01', dispensaryActorIds: ['tla_dispensary_a01'],
  },
  {
    receiptId: '202', receiptHandle: 'tlr_receipt_fixture_202',
    doctorActorId: 'tla_doctor_b02', patientActorId: 'tla_patient_b02', dispensaryActorIds: ['tla_dispensary_b02'],
  },
];
const port = createInMemoryLegacyObjectAuthorizationPort({ actors, receipts });
const authorize = createLegacyObjectAuthorizer(port, () => new Date('2026-08-24T12:00:00.000Z'));
const principal = (role: ServerRole, suffix = 'a'): AuthorizedPrincipal => ({
  subject: `synthetic-${role}-${suffix}`,
  roles: [role],
  scopes: ['fixture:scope'],
});
const request = (path: string, body: Record<string, unknown> = {}, operationId = 'tlo_operation_fixture_0001') => ({
  method: path.includes('/dashboard') || path.includes('/verify') || path.includes('/contract/') || path.includes('/balance/') ? 'GET' : 'POST',
  path,
  headers: { 'idempotency-key': operationId },
  body,
});

const doctorIssue = await authorize(principal('doctor'), request(
  '/api/stellar/doctor/issue-prescription',
  { targetActorId: 'tla_patient_a01', treatment: 'synthetic', dosage: 'synthetic', durationDays: 1 },
));
assert.equal(doctorIssue.actor.actorId, 'tla_doctor_a01');
assert.equal(doctorIssue.targetActor?.actorId, 'tla_patient_a01');
assert.equal(doctorIssue.trusted.actorAccountId, account('A'));
assert.equal(doctorIssue.trusted.targetAccountId, account('C'));

await assert.rejects(
  () => authorize(principal('doctor'), request('/api/stellar/doctor/issue-prescription', {
    targetActorId: 'tla_patient_a01', patientAddress: account('D'), treatment: 'synthetic', dosage: 'synthetic', durationDays: 1,
  }, 'tlo_operation_fixture_0002')),
  (error: any) => error.code === 'CLIENT_IDENTITY_FIELD_REJECTED',
);
await assert.rejects(
  () => authorize(principal('admin'), request('/api/stellar/admin/verify-sis', { rut: 'synthetic-forbidden-id' })),
  (error: any) => error.code === 'CLIENT_IDENTITY_FIELD_REJECTED',
);
await assert.rejects(
  () => authorize(principal('doctor'), request('/api/stellar/doctor/issue-prescription', {
    targetActorId: 'tla_patient_a01', metadata: { doctorAddress: account('B') }, treatment: 'synthetic', dosage: 'synthetic', durationDays: 1,
  }, 'tlo_operation_fixture_0007')),
  (error: any) => error.code === 'CLIENT_IDENTITY_FIELD_REJECTED',
);
await assert.rejects(
  () => authorize(principal('doctor'), request('/api/stellar/doctor/issue-prescription', {
    targetActorId: 'tla_patient_a01', doctorEmail: 'forged@example.invalid', treatment: 'synthetic', dosage: 'synthetic', durationDays: 1,
  }, 'tlo_operation_fixture_0003')),
  (error: any) => error.code === 'CLIENT_IDENTITY_FIELD_REJECTED',
);
await assert.rejects(
  () => authorize(principal('doctor'), request('/api/stellar/doctor/issue-prescription', {
    targetActorId: 'tla_doctor_b02', treatment: 'synthetic', dosage: 'synthetic', durationDays: 1,
  }, 'tlo_operation_fixture_0004')),
  (error: any) => error.code === 'TARGET_ACTOR_ROLE_MISMATCH',
);

const dispensaryOwn = await authorize(principal('dispensary'), request(
  '/api/stellar/dispensary/dispense-prescription',
  { prescriptionId: 101, productLabel: 'fixture', batchLabel: 'fixture', quantity: 1 },
  'tlo_operation_fixture_0005',
));
assert.equal(dispensaryOwn.receipt?.receiptHandle, 'tlr_receipt_fixture_101');
await assert.rejects(
  () => authorize(principal('dispensary'), request('/api/stellar/dispensary/dispense-prescription', {
    prescriptionId: 202, productLabel: 'fixture', batchLabel: 'fixture', quantity: 1,
  }, 'tlo_operation_fixture_0006')),
  (error: any) => error.code === 'OBJECT_ACCESS_FORBIDDEN',
);
await assert.rejects(
  () => authorize(principal('doctor'), request('/api/stellar/prescription/202/verify')),
  (error: any) => error.code === 'OBJECT_ACCESS_FORBIDDEN',
);
assert.equal((await authorize(principal('patient'), request('/api/stellar/prescription/101/verify'))).receipt?.receiptId, '101');
assert.equal((await authorize(principal('admin'), request('/api/stellar/prescription/202/verify'))).receipt?.receiptId, '202');

await assert.rejects(
  () => authorize(principal('patient'), request(`/api/stellar/patient/${account('D')}/dashboard`)),
  (error: any) => error.code === 'OBJECT_ACCESS_FORBIDDEN',
);
assert.equal((await authorize(principal('patient'), request(`/api/stellar/patient/${account('C')}/dashboard`))).actor.actorId, 'tla_patient_a01');
await assert.rejects(
  () => authorize(principal('patient'), request('/api/passkeys/contract/fixture-passkey-b')),
  (error: any) => error.code === 'OBJECT_ACCESS_FORBIDDEN',
);

await assert.rejects(
  () => authorize(principal('dispensary'), request('/api/stellar/dispensary/dispense-prescription', {
    prescriptionId: 101, productLabel: 'fixture', batchLabel: 'fixture', quantity: 1,
  }, 'tlo_operation_fixture_0005')),
  (error: any) => error.code === 'REPLAY_REJECTED',
);
await assert.rejects(
  () => authorize(principal('dispensary'), request('/api/stellar/dispensary/dispense-prescription', {
    prescriptionId: 101, productLabel: 'fixture', batchLabel: 'fixture', quantity: 2,
  }, 'tlo_operation_fixture_0005')),
  (error: any) => error.code === 'IDEMPOTENCY_KEY_CONFLICT',
);
await assert.rejects(
  () => authorize(principal('dispensary'), { ...request('/api/stellar/dispensary/dispense-prescription', { prescriptionId: 101 }), headers: {} }),
  (error: any) => error.code === 'IDEMPOTENCY_KEY_REQUIRED',
);
await assert.rejects(
  () => authorize(principal('patient'), request('/api/passkeys/send', { xdr: 'forged-client-envelope' })),
  (error: any) => error.code === 'CLIENT_IDENTITY_FIELD_REJECTED',
);
await assert.rejects(
  () => authorize({ subject: 'synthetic-doctor-a', roles: ['admin'], scopes: [] }, request('/api/stellar/readiness')),
  (error: any) => error.code === 'ACTOR_ROLE_MISMATCH',
);

assert.throws(() => objectAuthorizationPortFromEnv({}), (error: any) => error.code === 'OBJECT_AUTH_CONFIGURATION_MISSING');
assert.throws(() => objectAuthorizationPortFromEnv({ TRUSTLEAF_OBJECT_AUTH_FIXTURES_JSON: JSON.stringify({ mode: 'real', actors, receipts }) }), (error: any) => error.code === 'OBJECT_AUTH_CONFIGURATION_INVALID');

const middleware = createLegacyObjectAuthorizationMiddleware({}, { port });
let nextCalls = 0; let statusCode = 0; let responseBody: any;
const res = { locals: { authPrincipal: principal('patient') } as Record<string, unknown>, status(code: number) { statusCode = code; return { json(body: unknown) { responseBody = body; } }; } };
await middleware(request(`/api/stellar/patient/${account('D')}/dashboard`), res, () => { nextCalls += 1; });
assert.equal(nextCalls, 0); assert.equal(statusCode, 403); assert.equal(responseBody.code, 'OBJECT_ACCESS_FORBIDDEN');

const serverSource = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
const authPosition = serverSource.indexOf('app.use(createLegacyAuthorizationMiddleware(process.env))');
const mutationPosition = serverSource.indexOf('const protectedMutation');
const objectPosition = serverSource.indexOf('app.use(createLegacyObjectAuthorizationMiddleware(process.env))');
assert.ok(authPosition > 0 && mutationPosition > authPosition && objectPosition > mutationPosition, 'auth then kill-switch then object authorization');
assert.doesNotMatch(serverSource, /const \{\s*email\s*\} = req\.body/);
assert.doesNotMatch(serverSource, /const \{\s*xdr\s*\} = req\.body/);
assert.match(serverSource, /CLIENT_SUBMISSION_DISABLED/);
const envSource = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
assert.match(envSource, /TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false/);
assert.match(envSource, /TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false/);

console.log('legacy-object-authorization: subject/actor/receipt ownership, tamper and replay controls passed');
