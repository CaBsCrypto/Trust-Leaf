import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Only the isolated CI database populated by operations-concurrency.mjs is valid.
const base = process.env.PILOT_TEST_POSTGREST_URL;
assert.match(base ?? '', /^http:\/\/127\.0\.0\.1:\d+$/);
const rpc = (action, input = {}) => fetch(`${base}/rpc/trustleaf_operations_pilot`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ p_subject: 'did:privy:concurrency-a', p_action: action, p_input: input }),
  signal: AbortSignal.timeout(5000),
});
const snapshot = async () => {
  const response = await rpc('snapshot');
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.synthetic, true);
  assert.equal(value.role, 'dispensary');
  return value;
};
const before = await snapshot();
const batch = before.batches.find(value => value.stock_mg > 0);
assert.ok(batch, 'isolated concurrency fixture must contain a stocked batch');
const input = { resourceRef: batch.batch_ref, version: batch.version,
  operationId: randomUUID(), quantityMg: -1000000000, reason: 'Synthetic negative stock rejection' };
for (let attempt = 0; attempt < 2; attempt++) {
  const response = await rpc('adjust-stock', input);
  assert.equal(response.status, 409, 'business conflict must return promptly, not trigger transaction retries');
  const body = await response.json();
  assert.equal(body.code, 'PT409');
  assert.equal(body.message, 'PILOT_STOCK_CONFLICT');
}
const after = await snapshot();
assert.deepEqual(after.batches, before.batches);
assert.deepEqual(after.movements, before.movements);
assert.deepEqual(after.deliveries, before.deliveries);
console.log('PASS: real isolated PostgREST returns bounded HTTP 409 on negative stock and identical retry; no ledger or stock changes.');
