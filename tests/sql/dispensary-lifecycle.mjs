import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { operationsDatabase } from './operations-db.mjs';
import { acceptanceInput, joinTeam, teamCall } from './team-fixtures.mjs';

const { db, subjects, actors, call, agenda } = await operationsDatabase();
const mutate = (who, action, input = {}) => call(who, action, { ...input, operationId: randomUUID() });
const snapshot = who => call(who, 'snapshot');
const forbidden = promise => assert.rejects(promise, { code: '42501' });
const conflict = promise => assert.rejects(promise, { code: 'PT409' });
async function consultation(offset) {
  const slotRef = randomUUID(), bookingRef = randomUUID();
  const starts = Date.now() + offset * 86400000;
  await agenda('doctor', 'publish', { slotRef, startsAt: new Date(starts).toISOString(),
    endsAt: new Date(starts + 1800000).toISOString(), operationId: randomUUID() });
  await agenda('patient', 'reserve', { slotRef, bookingRef, version: 1, operationId: randomUUID() });
  await mutate('doctor', 'start-encounter', { resourceRef: bookingRef });
  return bookingRef;
}
const completion = bookingRef => ({ resourceRef: bookingRef, version: 1,
  issueTreatment: true, allowanceMg: 30000, periodCount: 3 });

try {
  for (const who of ['admin', 'doctor', 'otherDoctor', 'patient', 'dispensary', 'dispensaryB', 'operator']) {
    await mutate(who, 'join', { acceptSyntheticOnly: true });
  }
  const orgA = (await mutate('dispensary', 'create-organization', { name: 'Lifecycle A synthetic' })).resourceRef;
  const orgB = (await mutate('dispensaryB', 'create-organization', { name: 'Lifecycle B synthetic' })).resourceRef;
  const originalInvitation = await joinTeam(db, subjects.dispensaryB, subjects.operator);
  const lot = { lotCode: 'LIFECYCLE-001', product: 'Synthetic flower', sourceReference: 'QA ONLY',
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(), quantityMg: 100000 };
  const batchA = (await mutate('dispensary', 'receive-batch', lot)).resourceRef;
  const batchB = (await mutate('dispensaryB', 'receive-batch', lot)).resourceRef;

  await mutate('doctor', 'complete-encounter', completion(await consultation(1)));
  const old = (await snapshot('patient')).treatments[0];
  for (const organizationRef of [orgA, orgB]) {
    await mutate('patient', 'grant', { resourceRef: old.treatment_ref, organizationRef });
  }
  await mutate('dispensary', 'dispense', { resourceRef: old.treatment_ref, batchRef: batchA, quantityMg: 10000 });
  await mutate('dispensaryB', 'dispense', { resourceRef: old.treatment_ref, batchRef: batchB, quantityMg: 20000 });
  const before = await snapshot('patient');
  const oldDeliveries = before.deliveries;
  const oldPeriods = before.treatments[0].periods;
  assert.equal(oldPeriods[0].used_mg, 30000);

  // Exhaustion is not expiration: only the issuing doctor may revoke and replace.
  const newBooking = await consultation(2);
  await conflict(mutate('doctor', 'complete-encounter', completion(newBooking)));
  assert.equal((await snapshot('patient')).treatments.length, 1);
  await forbidden(mutate('otherDoctor', 'revoke-treatment', { resourceRef: old.treatment_ref, version: 1 }));
  await mutate('doctor', 'revoke-treatment', { resourceRef: old.treatment_ref, version: 1 });
  await conflict(mutate('dispensaryB', 'dispense', { resourceRef: old.treatment_ref, batchRef: batchB, quantityMg: 1 }));
  await mutate('doctor', 'complete-encounter', completion(newBooking));
  const patient = await snapshot('patient');
  const fresh = patient.treatments.find(t => t.treatment_ref !== old.treatment_ref);
  assert.ok(fresh);
  assert.equal(fresh.state, 'active');
  assert.equal(fresh.periods.length, 3);
  assert.ok(fresh.periods.every(p => p.used_mg === 0));
  assert.equal(patient.treatments.find(t => t.treatment_ref === old.treatment_ref).state, 'revoked');
  assert.deepEqual(patient.treatments.find(t => t.treatment_ref === old.treatment_ref).periods, oldPeriods);
  assert.deepEqual(patient.deliveries, oldDeliveries);
  assert.ok(!patient.grants.some(g => g.treatment_ref === fresh.treatment_ref));
  assert.equal((await snapshot('operator')).treatments.length, 0);
  const delivery = { resourceRef: fresh.treatment_ref, batchRef: batchB, quantityMg: 10000, operationId: randomUUID() };
  await forbidden(call('operator', 'dispense', delivery));
  await mutate('patient', 'grant', { resourceRef: fresh.treatment_ref, organizationRef: orgB });
  assert.equal((await snapshot('dispensary')).treatments.length, 0, 'A does not inherit the new permission either');
  await forbidden(mutate('operator', 'dispense', { ...delivery, batchRef: batchA }));
  for (const action of ['create-organization', 'receive-batch', 'adjust-stock', 'set-batch-state', 'remove-operator']) {
    await forbidden(mutate('operator', action, { name: 'Forbidden', resourceRef: batchB, quantityMg: 1, version: 2 }));
  }
  const receipt = await call('operator', 'dispense', delivery);
  const replay = await call('operator', 'dispense', delivery);
  assert.equal(replay.replayed, true);
  assert.equal(replay.resourceRef, receipt.resourceRef);
  const operator = await snapshot('operator');
  assert.equal(operator.batches[0].stock_mg, 70000);
  assert.equal(operator.treatments[0].periods[0].used_mg, 10000);
  assert.deepEqual(operator.notes, []);
  const receipts = operator.deliveries.filter(d => d.treatment_ref === fresh.treatment_ref);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].operator_ref, actors.operator);
  assert.equal(receipts[0].organization_ref, orgB);
  assert.equal(operator.movements.filter(m => m.delivery_ref === receipt.resourceRef).length, 1);

  await mutate('patient', 'revoke-grant', { resourceRef: fresh.treatment_ref, organizationRef: orgB });
  assert.equal((await snapshot('operator')).treatments.length, 0);
  await forbidden(mutate('operator', 'dispense', { ...delivery, quantityMg: 1000 }));
  await mutate('patient', 'grant', { resourceRef: fresh.treatment_ref, organizationRef: orgB });
  await mutate('dispensaryB', 'remove-operator', { resourceRef: actors.operator });
  const removed = await snapshot('operator');
  assert.equal(removed.membership?.organization_ref ?? null, null);
  assert.equal(removed.membership?.role ?? null, null);
  for (const field of ['treatments', 'batches', 'movements', 'deliveries', 'members']) {
    assert.equal(removed[field]?.length ?? 0, 0, `${field} must be removed with organization access`);
  }
  await forbidden(mutate('operator', 'dispense', { ...delivery, quantityMg: 1000 }));
  await forbidden(mutate('operator', 'create-organization', { name: 'Forbidden after removal' }));
  await assert.rejects(teamCall(db, subjects.operator, 'accept', acceptanceInput(originalInvitation)));
  const invitation = await joinTeam(db, subjects.dispensaryB, subjects.operator);
  assert.equal((await teamCall(db, subjects.operator, 'accept', acceptanceInput(invitation))).accepted, true);
  const restored = await snapshot('operator');
  assert.equal(restored.membership.organization_ref, orgB);
  assert.equal(restored.membership.role, 'operator');
  assert.equal(restored.members.filter(m => m.actor_ref === actors.operator).length, 1);
  assert.equal(restored.batches[0].stock_mg, 70000);
  assert.equal(restored.treatments[0].periods[0].used_mg, 10000);
  const after = await snapshot('patient');
  assert.deepEqual(after.deliveries.filter(d => d.treatment_ref === old.treatment_ref), oldDeliveries);
  assert.deepEqual(after.treatments.find(t => t.treatment_ref === old.treatment_ref).periods, oldPeriods);
  assert.equal((await snapshot('admin')).counts.deliveries, 3);
  console.log('PASS: isolated dispensary lifecycle: exhausted treatment preserved, explicit revocation/replacement, fresh patient permission, operator 10g, stock 80g->70g, replay, removal and explicit reinvitation.');
  console.log('NOT covered here: real Privy sessions, email delivery, hosted panels or independent PostgreSQL connections.');
} finally { await db.close(); }
