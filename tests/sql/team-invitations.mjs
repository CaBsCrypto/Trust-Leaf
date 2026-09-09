import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { operationsDatabase } from './operations-db.mjs';
import { acceptanceInput, digest, invitationInput, teamCall } from './team-fixtures.mjs';

const { db, subjects, actors, call } = await operationsDatabase();
const team = (who, action, input) => teamCall(db, subjects[who] ?? who, action, input);
const mutation = (who, action, input = {}) => call(who, action, { operationId: randomUUID(), ...input });
async function owner(sql, args = []) { await db.exec('reset role'); try { return await db.query(sql, args); } finally { await db.exec('set role service_role'); } }
const forbidden = promise => assert.rejects(promise, { code: '42501' });
const conflict = promise => assert.rejects(promise, { code: 'PT409' });
const create = async (who = 'dispensary', data = invitationInput()) => { await team(who, 'create', data); return data; };
try {
  for (const who of ['dispensary', 'dispensaryB']) { await mutation(who, 'join', { acceptSyntheticOnly: true }); await mutation(who, 'create-organization', { name: who }); }
  await forbidden(mutation('dispensary', 'add-operator', { resourceRef: actors.operator }));
  await forbidden(team('patient', 'list'));
  const existing = await create();
  assert.deepEqual(await team('dispensary', 'create', existing), { invitationRef: existing.invitationRef }, 'lost create response reuses one invitation');
  await conflict(team('dispensary', 'create', { ...existing, intent: digest('changed') }));
  await forbidden(team('operator', 'inspect', { ...acceptanceInput(existing), emailHashes: [digest('wrong')] }));
  assert.equal((await team('operator', 'inspect', acceptanceInput(existing))).accepted, false);
  assert.equal((await call('operator', 'snapshot')).joined, false, 'opening does not join');
  await assert.rejects(team('operator', 'accept', { ...acceptanceInput(existing), acceptSyntheticOnly: false }), { code: '22023' });
  assert.equal((await team('operator', 'accept', acceptanceInput(existing))).accepted, true);
  assert.equal((await team('operator', 'accept', acceptanceInput(existing))).accepted, true, 'lost accept response is recoverable');
  const snapshot = await call('operator', 'snapshot');
  assert.equal(snapshot.staffOnly, true); assert.equal(snapshot.membership.role, 'operator');
  for (const action of ['create-organization', 'receive-batch', 'adjust-stock', 'set-batch-state', 'remove-operator']) await forbidden(mutation('operator', action, { name: 'Forbidden', resourceRef: actors.dispensary }));
  await forbidden(team('operator', 'create', invitationInput()));
  await forbidden(team('dispensaryB', 'cancel', { invitationRef: existing.invitationRef, operationId: randomUUID(), intent: 'cancel' }));
  const another = await create('dispensaryB');
  await conflict(team('operator', 'accept', acceptanceInput(another)));
  await mutation('dispensary', 'remove-operator', { resourceRef: actors.operator });
  const removed = await call('operator', 'snapshot');
  assert.equal(removed.staffOnly, true); assert.equal(removed.membership.organization_ref, null);
  assert.equal(removed.batches.length, 0); assert.equal(removed.deliveries.length, 0);
  await forbidden(team('operator', 'accept', acceptanceInput(existing)));
  await forbidden(mutation('operator', 'create-organization', { name: 'Escalation' }));
  await forbidden(owner('insert into trustleaf_private.pilot_memberships(actor_ref,organization_ref,role) values($1,$2,\'manager\')', [actors.operator, snapshot.membership.organization_ref]));

  const newcomer = 'did:privy:invitation-new-worker';
  const fresh = await create();
  assert.equal((await team(newcomer, 'accept', acceptanceInput(fresh))).accepted, true);
  const newRole = (await db.query('select * from public.trustleaf_resolve_privy_actor($1)', [newcomer])).rows[0];
  assert.equal(newRole.role, 'dispensary'); assert.equal(newRole.actor_state, 'active');
  for (const who of ['admin', 'patient', 'doctor']) await forbidden(team(who, 'accept', acceptanceInput(await create())));
  await owner("update trustleaf_private.actor_bindings set state='suspended' where actor_ref=$1", [actors.operator]);
  await forbidden(team('operator', 'accept', acceptanceInput(await create())));
  await owner("update trustleaf_private.actor_bindings set state='active',valid_until=statement_timestamp()-interval '1 day' where actor_ref=$1", [actors.operator]);
  await forbidden(team('operator', 'accept', acceptanceInput(await create())));

  const expired = await create();
  await owner("update trustleaf_private.pilot_team_invitations set expires_at=statement_timestamp()-interval '1 second' where invitation_ref=$1", [expired.invitationRef]);
  await forbidden(team(newcomer, 'inspect', acceptanceInput(expired)));
  const cancelled = await create();
  const cancellation = { invitationRef: cancelled.invitationRef, operationId: randomUUID(), intent: 'cancel' };
  await team('dispensary', 'cancel', cancellation); await team('dispensary', 'cancel', cancellation);
  await forbidden(team(newcomer, 'inspect', acceptanceInput(cancelled)));

  const resend = await create();
  await assert.rejects(team('dispensary', 'resend', { ...resend, operationId: randomUUID() }), { code: 'PT429' });
  await owner("update trustleaf_private.pilot_team_mail set created_at=statement_timestamp()-interval '2 minutes' where invitation_ref=$1", [resend.invitationRef]);
  const replacement = { ...resend, tokenHash: digest('replacement'), operationId: randomUUID(), intent: 'resend' };
  await team('dispensary', 'resend', replacement);
  await forbidden(team(newcomer, 'inspect', acceptanceInput(resend)));
  assert.equal((await team(newcomer, 'inspect', acceptanceInput(replacement))).accepted, false);
  const job = await team('dispensary', 'claim-send', { invitationRef: resend.invitationRef });
  assert.equal(job.attempts, 1);
  assert.deepEqual(await team('dispensary', 'claim-send', { invitationRef: resend.invitationRef }), {});
  await assert.rejects(db.query('select public.trustleaf_team_mail_event($1,$2,$3)', ['event-before-send', 'provider-1', 'delivered']), { code: 'PT409' });
  await team('dispensary', 'finish-send', { invitationRef: resend.invitationRef, leaseRef: job.lease_ref, providerRef: 'provider-1', state: 'sent' });
  await db.query('select public.trustleaf_team_mail_event($1,$2,$3)', ['event-before-send', 'provider-1', 'delivered']);
  await db.query('select public.trustleaf_team_mail_event($1,$2,$3)', ['event-before-send', 'provider-1', 'delivered']);
  await db.query('select public.trustleaf_team_mail_event($1,$2,$3)', ['event-out-of-order', 'provider-1', 'sent']);
  assert.equal((await team('dispensary', 'list')).invitations.find(i => i.invitationRef === resend.invitationRef).deliveryState, 'delivered');

  const uncertain = await create();
  const lease = await team('dispensary', 'claim-send', { invitationRef: uncertain.invitationRef });
  await team('dispensary', 'finish-send', { invitationRef: uncertain.invitationRef, leaseRef: lease.lease_ref, state: 'uncertain' });
  await assert.rejects(team('dispensary', 'claim-send', { invitationRef: uncertain.invitationRef }), { code: 'PT429' });
  await owner("update trustleaf_private.pilot_team_mail set last_attempt_at=statement_timestamp()-interval '2 minutes' where invitation_ref=$1", [uncertain.invitationRef]);
  const recovered = await team('dispensary', 'claim-send', { invitationRef: uncertain.invitationRef });
  assert.equal(recovered.mail_ref, lease.mail_ref, 'same durable provider idempotency key');
  await team('dispensary', 'finish-send', { invitationRef: uncertain.invitationRef, leaseRef: recovered.lease_ref, state: 'uncertain' });
  await owner("update trustleaf_private.pilot_team_mail set first_attempt_at=statement_timestamp()-interval '25 hours' where invitation_ref=$1", [uncertain.invitationRef]);
  await conflict(team('dispensary', 'claim-send', { invitationRef: uncertain.invitationRef }));
  const staleManager = await create('dispensaryB');
  await owner("update trustleaf_private.actor_bindings set state='suspended' where actor_ref=$1", [actors.dispensaryB]);
  await forbidden(team(newcomer, 'inspect', acceptanceInput(staleManager)));
  await assert.rejects(team('dispensary', 'create', invitationInput('limit@example.test', { orgLimit: 1 })), { code: 'PT429' });
  await forbidden(db.query('select * from trustleaf_private.pilot_team_invitations'));
  console.log('PASS: team invitations: existing/new identities, consent, replay, conflicts, removed staff, role restrictions, expiry, cancellation, rotation, leases, webhook race/dedup/order, uncertain send and limits.');
} finally { await db.close(); }
