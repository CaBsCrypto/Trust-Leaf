import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { operationsDatabase } from './operations-db.mjs';
import { joinTeam } from './team-fixtures.mjs';

const { db, subjects, actors, call } = await operationsDatabase();
const commerce = async (key, action, input = {}) => (await db.query(
  'select public.trustleaf_dispensary_commerce($1,$2,$3) as data', [subjects[key], action, input])).rows[0].data;
const mutate = (key, action, input) => commerce(key, action, { operationId: randomUUID(), ...input });
const pilot = (key, action, input) => call(key, action, { operationId: randomUUID(), ...input });
try {
  for (const key of Object.keys(subjects)) await call(key, 'join', { acceptSyntheticOnly: true });
  await pilot('dispensary', 'create-organization', { name: 'Commerce demo A - synthetic' });
  await pilot('dispensaryB', 'create-organization', { name: 'Commerce demo B - synthetic' });
  await joinTeam(db, subjects.dispensary, subjects.operator);
  const productInput = { code: 'demo-1', name: 'Synthetic flower', presentation: 'Grams', referencePriceClp: 1200, reorderMg: 10000, archived: false };
  const p = await mutate('dispensary', 'save-product', productInput);
  const s = await mutate('dispensary', 'save-supplier', { name: 'Synthetic supplier', internalReference: 'S1', contact: 'private@example.test', archived: false });
  assert.equal((await commerce('operator', 'products')).items[0].code, 'DEMO-1');
  assert.equal((await commerce('dispensaryB', 'products')).items.length, 0);
  await assert.rejects(commerce('operator', 'suppliers'), { code: '42501' });
  await assert.rejects(commerce('patient', 'products'), { code: '42501' });
  await assert.rejects(mutate('operator', 'save-product', productInput), { code: '42501' });
  await assert.rejects(mutate('dispensary', 'save-product', productInput), { code: '23505' });
  const receiptInput = { operationId: randomUUID(), productRef: p.resourceRef, supplierRef: s.resourceRef,
    lotCode: 'DEMO-LOT', sourceReference: 'Synthetic source', expiresAt: '2099-01-01T00:00:00Z', quantityMg: 100000, costClp: 5000 };
  await assert.rejects(commerce('dispensaryB', 'receive', receiptInput), { code: 'PT409' });
  await assert.rejects(commerce('operator', 'receive', receiptInput), { code: '42501' });
  const receipt = await commerce('dispensary', 'receive', receiptInput);
  assert.equal((await commerce('dispensary', 'receive', receiptInput)).replayed, true);
  await assert.rejects(commerce('dispensary', 'receive', { ...receiptInput, quantityMg: 200000 }), { code: 'PT409' });
  const snap = await call('operator', 'snapshot');
  assert.equal(snap.batches.length, 1); assert.equal(snap.batches[0].stock_mg, 100000);
  assert.equal(snap.movements.length, 1);
  assert.equal((await commerce('operator', 'receipts')).items[0].cost_clp, undefined);
  assert.equal((await commerce('dispensary', 'receipts')).items[0].cost_clp, 5000);
  assert.equal((await commerce('dispensaryB', 'receipts')).items.length, 0);
  // Failure after the existing receipt function executes rolls back its stock too.
  await assert.rejects(mutate('dispensary', 'receive', { ...receiptInput, operationId: randomUUID(), lotCode: 'ROLLBACK', costClp: -1 }), { code: '23514' });
  assert.equal((await call('dispensary', 'snapshot')).batches.length, 1);
  const linked = { resourceRef: receipt.batchRef, version: 1, productRef: p.resourceRef, supplierRef: null };
  await mutate('dispensary', 'link-batch', linked);
  await assert.rejects(mutate('dispensary', 'link-batch', linked), { code: 'PT409' });
  assert.equal((await call('dispensary', 'snapshot')).batches[0].stock_mg, 100000);
  await mutate('dispensary', 'save-product', { ...productInput, resourceRef: p.resourceRef, version: 1, archived: true });
  await assert.rejects(mutate('dispensary', 'receive', { ...receiptInput, operationId: randomUUID() }), { code: 'PT409' });
  await mutate('dispensary', 'save-product', { ...productInput, code: 'DEMO-2' });
  const page = await commerce('dispensary', 'products', { limit: 1 });
  assert.equal(page.items.length, 1); assert.equal(page.nextOffset, 1);
  assert.equal((await commerce('dispensary', 'products', { limit: 1, offset: 1 })).nextOffset, null);
  await assert.rejects(commerce('dispensary', 'products', { limit: 101 }), { code: '22023' });
  await assert.rejects(db.query('select * from trustleaf_private.commerce_receipts'), { code: '42501' });
  await pilot('dispensary', 'remove-operator', { resourceRef: actors.operator });
  await assert.rejects(commerce('operator', 'products'), { code: '42501' });
  await db.exec('set role authenticated');
  await assert.rejects(commerce('dispensary', 'products'), { code: '42501' });
  console.log('PASS commerce: isolation, roles, pagination, atomic receipt, rollback, replay, archive, linking, removal and private tables');
} finally { await db.close(); }
