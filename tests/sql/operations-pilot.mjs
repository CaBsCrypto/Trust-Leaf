import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { operationsDatabase } from './operations-db.mjs';

const { db, subjects, actors, call, agenda } = await operationsDatabase();
const mutation = (key, action, input = {}) => call(key, action, { ...input, operationId: randomUUID() });
const snapshot = key => call(key, 'snapshot');
const forbidden = promise => assert.rejects(promise, { code: '42501' });
const conflict = promise => assert.rejects(promise, { code: '40001' });
async function owner(sql, args = []) { await db.exec('reset role'); try { return await db.query(sql, args); } finally { await db.exec('set role service_role'); } }
try {
  assert.equal((await snapshot('doctor')).joined, false);
  await forbidden(mutation('doctor', 'start-encounter', { resourceRef: randomUUID() }));
  for (const key of Object.keys(subjects)) await mutation(key, 'join', { acceptSyntheticOnly: true });
  assert.equal((await snapshot('doctor')).joined, true);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await forbidden(snapshot('admin'));
    await forbidden(db.query('select * from trustleaf_private.pilot_notes'));
    await db.exec('set role service_role');
  }
  const orgA = (await mutation('dispensary', 'create-organization', { name: 'Dispensario A simulado' })).resourceRef;
  const orgB = (await mutation('dispensaryB', 'create-organization', { name: 'Dispensario B simulado' })).resourceRef;
  await mutation('dispensary', 'add-operator', { resourceRef: actors.operator });
  await forbidden(mutation('operator', 'add-operator', { resourceRef: actors.patient }));
  await forbidden(mutation('patient', 'create-organization', { name: 'Escalamiento' }));
  await conflict(mutation('operator', 'create-organization', { name: 'Segunda sede' }));
  assert.deepEqual((await snapshot('patient')).organizations, [], 'no prescription means no directory');

  const slotRef = randomUUID(), bookingRef = randomUUID();
  const startsAt = new Date(Date.now() + 86400000).toISOString(), endsAt = new Date(Date.now() + 86400000 + 1800000).toISOString();
  await agenda('doctor', 'publish', { slotRef, startsAt, endsAt, operationId: randomUUID() });
  await agenda('patient', 'reserve', { slotRef, bookingRef, version: 1, operationId: randomUUID() });
  assert.equal((await snapshot('doctor')).bookings[0].booking_ref, bookingRef);
  await forbidden(mutation('otherDoctor', 'start-encounter', { resourceRef: bookingRef }));
  await forbidden(mutation('patient', 'start-encounter', { resourceRef: bookingRef }));
  await mutation('doctor', 'start-encounter', { resourceRef: bookingRef });
  await conflict(agenda('patient', 'cancel-booking', { slotRef, bookingRef, version: 2, operationId: randomUUID() }));
  await mutation('doctor', 'save-note', { resourceRef: bookingRef, version: 1, note: 'NOTA FICTICIA: evaluacion de prueba.' });
  await conflict(mutation('doctor', 'save-note', { resourceRef: bookingRef, version: 1, note: 'Stale overwrite' }));
  assert.deepEqual((await snapshot('patient')).notes, [], 'draft notes remain private until the consultation is completed');
  assert.equal((await snapshot('doctor')).notes[0].body, 'NOTA FICTICIA: evaluacion de prueba.');
  assert.equal((await snapshot('otherPatient')).notes.length, 0);
  await mutation('doctor', 'complete-encounter', { resourceRef: bookingRef, version: 2, issueTreatment: true, allowanceMg: 30000, periodCount: 3 });
  assert.equal((await snapshot('patient')).notes[0].body, 'NOTA FICTICIA: evaluacion de prueba.');
  const t = (await snapshot('patient')).treatments[0];
  assert.equal(t.periods.length, 3);
  for (const p of t.periods) assert.equal(Date.parse(p.ends_at) - Date.parse(p.starts_at), 30 * 86400000);
  assert.equal(t.periods[0].starts_at, t.issued_at);
  assert.equal((await snapshot('patient')).organizations.length, 2);
  await conflict(mutation('doctor', 'save-note', { resourceRef: bookingRef, version: 3, note: 'Cannot edit final encounter' }));
  assert.equal((await snapshot('admin')).notes, undefined);
  assert.equal((await snapshot('dispensary')).treatments.length, 0);
  await mutation('patient', 'grant', { resourceRef: t.treatment_ref, organizationRef: orgA });
  await mutation('patient', 'grant', { resourceRef: t.treatment_ref, organizationRef: orgB });
  const minimal = await snapshot('operator');
  assert.equal(minimal.treatments.length, 1);
  assert.deepEqual(minimal.notes, []);
  assert.equal(minimal.treatments[0].booking_ref, undefined);
  const batchInput = { lotCode: 'TEST-001', product: 'Flor ficticia', sourceReference: 'TEST-ORIGIN-001', expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(), quantityMg: 100000 };
  const batchA = (await mutation('dispensary', 'receive-batch', batchInput)).resourceRef;
  const batchB = (await mutation('dispensaryB', 'receive-batch', batchInput)).resourceRef;
  await forbidden(mutation('operator', 'receive-batch', { ...batchInput, lotCode: 'TEST-002' }));
  await forbidden(mutation('dispensaryB', 'dispense', { resourceRef: t.treatment_ref, batchRef: batchA, quantityMg: 10000 }));
  const first = { resourceRef: t.treatment_ref, batchRef: batchA, quantityMg: 10000, operationId: randomUUID() };
  const receipt = await call('operator', 'dispense', first);
  assert.equal((await call('operator', 'dispense', first)).replayed, true, 'lost response replay must not dispense twice');
  await conflict(call('operator', 'dispense', { ...first, quantityMg: 11000 }));
  await mutation('dispensaryB', 'dispense', { resourceRef: t.treatment_ref, batchRef: batchB, quantityMg: 20000 });
  for (const key of ['patient', 'dispensary', 'dispensaryB']) {
    const s = await snapshot(key);
    assert.equal(s.treatments[0].periods[0].used_mg, 30000);
    assert.equal(s.deliveries.length, 2, 'both dispensaries see permitted cross-dispensary history');
  }
  assert.equal((await snapshot('dispensary')).batches[0].stock_mg, 90000);
  assert.equal((await snapshot('dispensaryB')).batches[0].stock_mg, 80000);
  await conflict(mutation('operator', 'dispense', { resourceRef: t.treatment_ref, batchRef: batchA, quantityMg: 1 }));
  assert.equal((await snapshot('patient')).organizations.length, 0, 'exhausted quota closes directory');

  // Advance explicit boundaries only in this ephemeral DB, never the production clock.
  await owner("update trustleaf_private.pilot_periods set starts_at=starts_at-interval '720 hours', ends_at=ends_at-interval '720 hours' where treatment_ref=$1", [t.treatment_ref]);
  assert.equal((await snapshot('patient')).treatments[0].periods[1].used_mg, 0, 'no carryover');
  await mutation('patient', 'revoke-grant', { resourceRef: t.treatment_ref, organizationRef: orgA });
  await forbidden(mutation('operator', 'dispense', { resourceRef: t.treatment_ref, batchRef: batchA, quantityMg: 1000 }));
  assert.equal((await snapshot('operator')).treatments.length, 0);
  assert.equal((await snapshot('operator')).deliveries.length, 1, 'own immutable delivery remains, shared history disappears');
  await mutation('patient', 'grant', { resourceRef: t.treatment_ref, organizationRef: orgA });
  await owner("update trustleaf_private.pilot_grants set expires_at=statement_timestamp()-interval '1 second' where treatment_ref=$1 and organization_ref=$2", [t.treatment_ref, orgA]);
  await forbidden(mutation('operator', 'dispense', { resourceRef: t.treatment_ref, batchRef: batchA, quantityMg: 1000 }));
  await mutation('patient', 'grant', { resourceRef: t.treatment_ref, organizationRef: orgA });
  await mutation('dispensary', 'set-batch-state', { resourceRef: batchA, version: 2, state: 'quarantined' });
  await conflict(mutation('operator', 'dispense', { resourceRef: t.treatment_ref, batchRef: batchA, quantityMg: 1000 }));
  await mutation('dispensary', 'set-batch-state', { resourceRef: batchA, version: 3, state: 'active' });
  await forbidden(mutation('operator', 'adjust-stock', { resourceRef: batchA, version: 4, quantityMg: -1000, reason: 'No permission' }));
  await conflict(mutation('dispensary', 'adjust-stock', { resourceRef: batchA, version: 4, quantityMg: -999999, reason: 'Negative stock' }));
  await mutation('dispensary', 'adjust-stock', { resourceRef: batchA, version: 4, quantityMg: 1000, reason: 'Ajuste simulado de inventario' });
  assert.equal((await snapshot('patient')).treatments[0].periods[0].used_mg, 30000, 'stock adjustment never restores quota');
  await mutation('dispensary', 'remove-operator', { resourceRef: actors.operator });
  await forbidden(mutation('operator', 'dispense', { resourceRef: t.treatment_ref, batchRef: batchA, quantityMg: 1000 }));
  await owner("update trustleaf_private.pilot_batches set expires_at=statement_timestamp()-interval '1 hour' where batch_ref=$1", [batchA]);
  await conflict(mutation('dispensary', 'dispense', { resourceRef: t.treatment_ref, batchRef: batchA, quantityMg: 1000 }));
  await mutation('doctor', 'revoke-treatment', { resourceRef: t.treatment_ref, version: 1 });
  await conflict(mutation('dispensaryB', 'dispense', { resourceRef: t.treatment_ref, batchRef: batchB, quantityMg: 1000 }));
  assert.equal((await snapshot('patient')).treatments[0].state, 'revoked');
  assert.equal((await snapshot('admin')).counts.deliveries, 2);
  const slot2 = randomUUID(), booking2 = randomUUID();
  await agenda('otherDoctor', 'publish', { slotRef: slot2, startsAt, endsAt, operationId: randomUUID() });
  await agenda('otherPatient', 'reserve', { slotRef: slot2, bookingRef: booking2, version: 1, operationId: randomUUID() });
  await mutation('otherDoctor', 'start-encounter', { resourceRef: booking2 });
  await mutation('otherDoctor', 'complete-encounter', { resourceRef: booking2, version: 1, issueTreatment: false });
  assert.equal((await snapshot('otherPatient')).encounters[0].state, 'completed');
  assert.deepEqual((await snapshot('otherPatient')).treatments, [], 'consultation may finish without treatment');
  await owner("update trustleaf_private.actor_bindings set state='suspended' where actor_ref=$1", [actors.doctor]);
  await forbidden(snapshot('doctor'));
  assert.ok(receipt.resourceRef);
  console.log('PASS: isolated SQL pilot activation, private consultation, immutable notes, 30-day periods, team permissions, shared 10g + 20g balance, stock, replay, revocation and expired lots.');
  console.log('NOT covered here: hosted Privy/PostgREST or independent PostgreSQL connections (PGlite serializes queries).');
} finally { await db.close(); }
