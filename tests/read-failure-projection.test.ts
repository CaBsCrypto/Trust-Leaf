import assert from 'node:assert/strict';
import test from 'node:test';
import { readFailureProjection } from '../src/features/operations/readFailureProjection.ts';
import type { PilotSnapshot } from '../src/features/operations/contracts.ts';

const snapshot = {
  synthetic: true, joined: true, role: 'dispensary', actorRef: 'actor', asOf: '2026-10-02T00:00:00Z',
  membership: { organization_ref: 'own', actor_ref: 'actor', role: 'manager' },
  organizations: [{ organization_ref: 'own', name: 'Own' }, { organization_ref: 'foreign', name: 'Foreign' }],
  profile: { name: 'PRIVATE' }, patientProfiles: [{ name: 'PRIVATE' }], treatments: [{ patient_ref: 'PRIVATE' }],
  notes: [{ body: 'PRIVATE' }], bookings: [{ patient_ref: 'PRIVATE' }], encounters: [{ patient_ref: 'PRIVATE' }],
  grants: [{ treatment_ref: 'PRIVATE' }], members: [{ actor_ref: 'PRIVATE' }], counts: { participants: 9 },
  audit: [{ action: 'PRIVATE' }],
  batches: [{ batch_ref: 'batch-own', organization_ref: 'own' }, { batch_ref: 'batch-foreign', organization_ref: 'foreign' }],
  movements: [{ batch_ref: 'batch-own' }, { batch_ref: 'batch-foreign' }],
  deliveries: [{ delivery_ref: 'own-receipt', organization_ref: 'own' }, { delivery_ref: 'foreign-receipt', organization_ref: 'foreign' }],
} as unknown as PilotSnapshot;

test('failed dispensary read keeps only own operational records without mutating the original', () => {
  const original = JSON.stringify(snapshot);
  const projected = readFailureProjection(snapshot)!;
  assert.equal(JSON.stringify(snapshot), original);
  assert.equal(JSON.stringify(projected).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(projected).includes('foreign'), false);
  assert.deepEqual(projected.deliveries, [snapshot.deliveries![0]]);
  assert.deepEqual(projected.batches, [snapshot.batches![0]]);
  assert.deepEqual(projected.movements, [snapshot.movements![0]]);
  assert.equal(projected.membership, snapshot.membership);
  assert.equal(projected.asOf, snapshot.asOf);
  assert.deepEqual(readFailureProjection(projected), projected);
});

for (const role of ['doctor', 'patient', 'admin'] as const) test(`${role} ownership and drafts do not use dispensary redaction`, () => {
  const own = { ...snapshot, role };
  assert.equal(readFailureProjection(own), own);
});

test('missing scope never guesses which receipts are own', () => {
  assert.equal(readFailureProjection(null), null);
  assert.equal(readFailureProjection({ ...snapshot, membership: null }), null);
  assert.equal(readFailureProjection({ ...snapshot, joined: false }), null);
});
