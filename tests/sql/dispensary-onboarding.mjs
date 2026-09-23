import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { operationsDatabase } from './operations-db.mjs';

const { db, subjects } = await operationsDatabase();
const subject = 'did:privy:onboarding-new-manager';
const hash = value => createHash('sha256').update(value).digest('hex');
const rpc = async (who, action, input = {}) => (await db.query(
  'select public.trustleaf_dispensary_onboarding($1,$2,$3) as result', [who, action, input])).rows[0].result;
const mutation = input => ({ ...input, operationId: randomUUID(), intent: hash(JSON.stringify(input)) });
const invitation = () => mutation({ invitationRef: randomUUID(), emailHash: hash(randomUUID()),
  emailCiphertext: 'encrypted-test-email', tokenHash: hash(randomUUID()), payloadCiphertext: 'encrypted-test-token' });
const profile = { managerName: 'Encargado ficticio', phone: '+56000000000', businessName: 'Dispensario aislado',
  commune: 'Comuna de prueba', address: 'Direccion ficticia 123', activity: 'Piloto de gestion con datos ficticios', contactEmail: 'contact@example.test' };
try {
  const inv = invitation();
  await assert.rejects(rpc(subjects.patient, 'invite', inv), /ONBOARDING_FORBIDDEN/);
  await rpc(subjects.admin, 'invite', inv);
  await assert.rejects(rpc(subject, 'accept', { tokenHash: inv.tokenHash, emailHashes: [hash('wrong')], consent: true }), /UNAVAILABLE/);
  await assert.rejects(rpc(subjects.patient, 'accept', { tokenHash: inv.tokenHash, emailHashes: [inv.emailHash], consent: true }), /ACCOUNT_CONFLICT/);
  const accept = { tokenHash: inv.tokenHash, emailHashes: [inv.emailHash], consent: true };
  let { application: app } = await rpc(subject, 'accept', accept);
  assert.equal(app.state, 'draft');
  assert.equal((await rpc(subject, 'accept', accept)).application.applicationRef, app.applicationRef);
  const actor = (await db.query('select * from public.trustleaf_resolve_privy_actor($1)', [subject])).rows[0];
  assert.equal(actor.actor_state, 'pending');
  assert.equal((await db.query('select * from public.trustleaf_list_pending_privy_actors($1)', [subjects.admin])).rows.some(r=>r.actor_ref===actor.actor_ref),false);
  await assert.rejects(db.query('select public.trustleaf_operations_pilot($1,$2,$3)', [subject, 'snapshot', {}]), /FORBIDDEN|ACTIVE|UNAVAILABLE/);
  await assert.rejects(db.query('select * from public.trustleaf_review_pending_privy_actor($1,$2,$3,$4,$5)',
    [subjects.admin, actor.actor_ref, 1, 'approve', new Uint8Array(32).fill(99)]), /ONBOARDING_REVIEW_REQUIRED/);
  const saved = mutation({ applicationRef: app.applicationRef, version: app.version, profile });
  app = (await rpc(subject, 'save-draft', saved)).application;
  assert.deepEqual((await rpc(subject, 'save-draft', saved)).application, app);
  await assert.rejects(rpc(subject, 'save-draft', mutation({ ...saved, profile: { ...profile, managerName: 'Otro' } })), /VERSION_CONFLICT/);
  assert.deepEqual((await rpc(subject, 'read-draft')).application.profile, profile);
  await assert.rejects(rpc(subjects.otherPatient, 'save-draft', mutation({ applicationRef: app.applicationRef, version: app.version, profile })), /FORBIDDEN/);
  app = (await rpc(subject, 'submit', mutation({ applicationRef: app.applicationRef, version: app.version, consent: true }))).application;
  await assert.rejects(rpc(subject, 'review', mutation({ applicationRef: app.applicationRef, version: app.version, decision: 'approve' })), /FORBIDDEN/);
  await assert.rejects(rpc(subjects.admin, 'review', mutation({ applicationRef: app.applicationRef, version: app.version, decision: 'changes', reason: '' })), /REASON_REQUIRED/);
  app = (await rpc(subjects.admin, 'review', mutation({ applicationRef: app.applicationRef, version: app.version, decision: 'changes', reason: 'Revisar direccion' }))).application;
  assert.equal(app.state, 'changes_requested');
  assert.equal((await rpc(subject, 'read-draft')).application.reason, 'Revisar direccion');
  app = (await rpc(subject, 'submit', mutation({ applicationRef: app.applicationRef, version: app.version, consent: true }))).application;
  const approval = mutation({ applicationRef: app.applicationRef, version: app.version, decision: 'approve', reason: '' });
  app = (await rpc(subjects.admin, 'review', approval)).application;
  assert.equal(app.state, 'approved');
  assert.ok(app.organizationRef);
  assert.deepEqual((await rpc(subjects.admin, 'review', approval)).application, app);
  const snapshot = (await db.query('select public.trustleaf_operations_pilot($1,$2,$3) as data', [subject, 'snapshot', {}])).rows[0].data;
  assert.equal(snapshot.membership.role, 'manager');
  assert.equal(snapshot.membership.organization_ref, app.organizationRef);
  await assert.rejects(rpc(subject, 'save-draft', mutation({ applicationRef: app.applicationRef, version: app.version, profile })), /READ_ONLY/);

  const rejectedSubject = 'did:privy:onboarding-rejected-manager';
  const rejectInv = invitation(); await rpc(subjects.admin, 'invite', rejectInv);
  let rejected = (await rpc(rejectedSubject, 'accept', { tokenHash: rejectInv.tokenHash, emailHashes: [rejectInv.emailHash], consent: true })).application;
  rejected = (await rpc(rejectedSubject, 'save-draft', mutation({ applicationRef: rejected.applicationRef, version: rejected.version, profile }))).application;
  rejected = (await rpc(rejectedSubject, 'submit', mutation({ applicationRef: rejected.applicationRef, version: rejected.version, consent: true }))).application;
  rejected = (await rpc(subjects.admin, 'review', mutation({ applicationRef: rejected.applicationRef, version: rejected.version, decision: 'reject', reason: 'Prueba de rechazo' }))).application;
  assert.equal(rejected.state, 'rejected');
  await assert.rejects(rpc(rejectedSubject, 'submit', mutation({ applicationRef: rejected.applicationRef, version: rejected.version, consent: true })), /READ_ONLY/);

  const cancelled = invitation(); await rpc(subjects.admin, 'invite', cancelled);
  await rpc(subjects.admin, 'cancel', mutation({ invitationRef: cancelled.invitationRef }));
  await assert.rejects(rpc('did:privy:onboarding-cancelled-manager', 'accept', { tokenHash: cancelled.tokenHash, emailHashes: [cancelled.emailHash], consent: true }), /UNAVAILABLE/);
  const rotating = invitation(); await rpc(subjects.admin, 'invite', rotating);
  await assert.rejects(rpc(subjects.admin, 'resend', mutation({ invitationRef: rotating.invitationRef, tokenHash: hash('next'), payloadCiphertext: 'next-encrypted' })), /SEND_LIMIT/);
  await db.exec('reset role');
  await db.query("update trustleaf_private.dispensary_onboarding_mail set created_at=clock_timestamp()-interval '61 seconds' where invitation_ref=$1", [rotating.invitationRef]);
  await db.exec('set role service_role');
  await rpc(subjects.admin, 'resend', mutation({ invitationRef: rotating.invitationRef, tokenHash: hash('next'), payloadCiphertext: 'next-encrypted' }));
  await assert.rejects(rpc('did:privy:onboarding-rotation-manager', 'inspect', { tokenHash: rotating.tokenHash, emailHashes: [rotating.emailHash] }), /UNAVAILABLE/);
  assert.equal((await rpc('did:privy:onboarding-rotation-manager', 'inspect', { tokenHash: hash('next'), emailHashes: [rotating.emailHash] })).accepted,false);
  await db.exec('reset role');
  await db.query("update trustleaf_private.dispensary_onboarding_invitations set expires_at=clock_timestamp()-interval '1 second' where invitation_ref=$1", [rotating.invitationRef]);
  await db.exec('set role service_role');
  await assert.rejects(rpc('did:privy:onboarding-rotation-manager', 'accept', { tokenHash: hash('next'), emailHashes: [rotating.emailHash], consent: true }), /UNAVAILABLE/);
  const pendingAccount = 'did:privy:onboarding-suspended-manager';
  await db.query('select public.trustleaf_enroll_privy_actor($1,$2)',[pendingAccount,'dispensary']);
  const suspendedInvite = invitation(); await rpc(subjects.admin,'invite',suspendedInvite);
  await db.exec('reset role');
  await db.query("update trustleaf_private.actor_bindings set state='suspended' where actor_ref=(select actor_ref from trustleaf_private.external_identity_bindings where external_subject=$1)",[pendingAccount]);
  await db.exec('set role service_role');
  await assert.rejects(rpc(pendingAccount,'accept',{tokenHash:suspendedInvite.tokenHash,emailHashes:[suspendedInvite.emailHash],consent:true}),/ACCOUNT_CONFLICT/);
  await db.exec('set role authenticated');
  await assert.rejects(rpc(subject, 'read-draft'), /permission denied/);
  await assert.rejects(db.query('select * from trustleaf_private.dispensary_onboarding_applications'), /permission denied/);
  console.log('PASS onboarding: private draft, current identity, legacy approval blocked, versions, corrections, rejection, approval, replay and cancellation.');
  console.log('NOT covered: independent PostgreSQL races, mail provider, browser or production.');
} finally { await db.close(); }
