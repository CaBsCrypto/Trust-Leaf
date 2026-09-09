import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { invitationInput } from './team-fixtures.mjs';
import { teamRpc } from '../../api/_lib/team-invitations.ts';

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

const team = async (action, input = {}) => {
  const response = await fetch(`${base}/rpc/trustleaf_team_invitations`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ p_subject: 'did:privy:concurrency-a', p_action: action, p_input: input }),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200);
  return response.json();
};
const invitation = invitationInput();
await team('create', invitation);
const job = await team('claim-send', { invitationRef: invitation.invitationRef });
assert.ok(job.lease_ref);
const providerRef = `synthetic-postgrest-${randomUUID()}`;
await team('finish-send', { invitationRef: invitation.invitationRef, leaseRef: job.lease_ref, state: 'sent', providerRef });
const delivery = { p_event_id: `synthetic-event-${randomUUID()}`, p_provider_ref: providerRef, p_state: 'delivered' };
const transport = async (url, init) => {
  const response = await fetch(url, init);
  assert.equal(response.status, 204, 'void RPC must really use HTTP 204');
  assert.equal(await response.clone().text(), '', 'HTTP 204 has no JSON to parse');
  return response;
};
const env = { SUPABASE_URL: base, SUPABASE_SECRET_KEY: 'synthetic-ci-only' };
for (let attempt = 0; attempt < 2; attempt++) {
  assert.equal(await teamRpc(env, transport, 'trustleaf_team_mail_event', delivery), null);
}
const teamSnapshot = await team('list');
const persisted = teamSnapshot.invitations.find(item => item.invitationRef === invitation.invitationRef);
assert.equal(persisted.deliveryState, 'delivered');
console.log('PASS: real isolated void RPC returns empty HTTP 204; server acknowledges delivery and duplicate event without JSON parsing errors.');
