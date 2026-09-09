import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { executeTeamCommand, normalizeTeamEmail, teamCrypto, teamMailWebhook, verifiedTeamEmails, teamInvitationHandler } from '../api/_lib/team-invitations.ts';
const env = { TRUSTLEAF_TEAM_INVITATIONS_ENABLED: 'true', TRUSTLEAF_OPERATIONS_PILOT_ENABLED: 'true', TEAM_INVITATION_ENCRYPTION_KEY: '12'.repeat(32),
  SUPABASE_URL: 'https://synthetic.supabase.test', SUPABASE_SECRET_KEY: 'test-only', PRIVY_APP_ID: 'test', PRIVY_APP_SECRET: 'test-only', RESEND_API_KEY: 'test-only', RESEND_WEBHOOK_SECRET: 'whsec_' + Buffer.from('test-signature-key').toString('base64') };
const subject = 'did:privy:team-test-worker';
const verifier = { async verify() { return { subject, emails: ['stale@example.test'] }; } };
const crypto = teamCrypto(env);
const linked = (email: string) => ({ id: subject, linked_accounts: [{ type: 'email', address: email, latest_verified_at: 100 }] });
test('mail normalization does not collapse aliases; authenticated encryption binds context', () => {
  assert.equal(normalizeTeamEmail(' Worker+tag@Example.TEST '), 'worker+tag@example.test');
  assert.throws(() => normalizeTeamEmail('victim@example.test\r\nBcc: attacker@example.test'));
  const encrypted = crypto.seal('secret', 'one');
  assert.equal(crypto.open(encrypted, 'one'), 'secret'); assert.throws(() => crypto.open(encrypted, 'two'));
  assert.throws(() => crypto.open(encrypted.slice(0, -3), 'one'));
  assert.deepEqual(verifiedTeamEmails({ linked_accounts: [{ type: 'wallet', email: 'fake@example.test', latest_verified_at: 100 }, { type: 'email', address: 'unverified@example.test' }, { type: 'google_oauth', email: 'worker@example.test', latest_verified_at: 100 }] }), ['worker@example.test']);
});
test('acceptance uses fresh Privy verified email, never stale token email or client-supplied email', async () => {
  let calls = 0;
  const result = await executeTeamCommand({ env, verifier, token: 'id-token', command: { action: 'accept', token: 'a'.repeat(43), acceptSyntheticOnly: true }, fetcher: async (url, init) => {
    calls++;
    if (String(url).startsWith('https://api.privy.io/')) return Response.json(linked('worker@example.test'));
    const input = JSON.parse(String(init?.body)); assert.equal(input.p_subject, subject);
    assert.deepEqual(input.p_input.emailHashes, [crypto.hashEmail('worker@example.test')]);
    assert.equal(input.p_input.acceptSyntheticOnly, true); assert.equal(JSON.stringify(input).includes('@'), false);
    return Response.json({ accepted: true });
  } });
  assert.deepEqual(result, { accepted: true }); assert.equal(calls, 2);
});
test('feature disabled and invalid identity fail before external requests', async () => {
  const fetcher: typeof fetch = async () => { throw new Error('unexpected external request'); };
  await assert.rejects(executeTeamCommand({ env: {}, verifier, token: 'id', command: { action: 'inspect', token: 'a'.repeat(43) }, fetcher }), { code: 'TEAM_DISABLED' });
  await assert.rejects(executeTeamCommand({ env, verifier: { verify: async () => { throw new Error('bad identity'); } }, token: 'bad', command: { action: 'list' }, fetcher }));
});
test('switching invitations off preserves authorized history and cancellation', async () => {
  const disabled = { ...env, TRUSTLEAF_TEAM_INVITATIONS_ENABLED: 'false' };
  const fetcher: typeof fetch = async () => Response.json({ members: [], invitations: [], membership: { role: 'manager' }, organization: {} });
  const snapshot = await executeTeamCommand({ env: disabled, verifier, token: 'id', command: { action: 'list' }, fetcher });
  assert.equal(snapshot.invitationsEnabled, false);
  await executeTeamCommand({ env: disabled, verifier, token: 'id', command: { action: 'cancel', invitationRef: randomUUID(), operationId: randomUUID() }, fetcher });
  await assert.rejects(executeTeamCommand({ env: disabled, verifier, token: 'id', command: { action: 'create', email: 'worker@example.test', operationId: randomUUID() }, fetcher }), { code: 'TEAM_DISABLED' });
});
test('create persists encrypted recipient/token first; failure is recorded and stable-key retry recovers', async () => {
  let saved: Record<string, string> = {}, phase = 'failure', finish = '', idempotency = '', deliveredBody = '';
  const mail = randomUUID(), lease = randomUUID();
  const fetcher: typeof fetch = async (url, init) => {
    const payload = JSON.parse(String(init?.body));
    if (String(url) === 'https://api.resend.com/emails') {
      assert.ok(saved.emailCiphertext); assert.equal(payload.from, 'Trust Leaf <admin@trustleaf.org>');
      assert.deepEqual(payload.to, ['worker@example.test']); assert.equal(payload.text.includes('patient'), false);
      assert.match(payload.text, /\/dispensario#team-invite=/);
      const key = new Headers(init?.headers).get('Idempotency-Key')!;
      if (idempotency) assert.equal(key, idempotency); idempotency = key;
      if (deliveredBody) assert.equal(String(init?.body), deliveredBody); deliveredBody = String(init?.body);
      return phase === 'failure' ? new Response('', { status: 500 }) : Response.json({ id: 'provider-id' });
    }
    if (payload.p_action === 'create') {
      saved = payload.p_input;
      assert.equal(JSON.stringify(saved).includes('worker@example.test'), false);
      assert.equal(crypto.open(saved.emailCiphertext, `team:${saved.invitationRef}:email`), 'worker@example.test');
      return Response.json({ invitationRef: saved.invitationRef });
    }
    if (payload.p_action === 'claim-send') return Response.json({ mail_ref: mail, lease_ref: lease, payload_ciphertext: saved.payloadCiphertext, email_ciphertext: saved.emailCiphertext, organization_name: 'Test Dispensary', expires_at: '2026-09-16T12:00:00Z' });
    if (payload.p_action === 'finish-send') { finish = payload.p_input.state; return Response.json({}); }
    throw new Error('Unexpected request');
  };
  await executeTeamCommand({ env, verifier, token: 'id', command: { action: 'create', email: 'worker@example.test', operationId: randomUUID() }, fetcher });
  assert.equal(finish, 'uncertain'); phase = 'success';
  await executeTeamCommand({ env, verifier, token: 'id', command: { action: 'retry-send', invitationRef: saved.invitationRef }, fetcher });
  assert.equal(finish, 'sent');
});
test('manager list resolves only organization-scoped users and removes internal identity/encryption fields', async () => {
  const ref = randomUUID(); let reads = 0;
  const result = await executeTeamCommand({ env, verifier, token: 'id', command: { action: 'list' }, fetcher: async url => {
    if (String(url).includes('/v1/users/')) { reads++; return Response.json(linked('worker@example.test')); }
    return Response.json({ organization: {}, membership: {}, members: [{ actorRef: ref, subject, role: 'operator' }], invitations: [{ invitationRef: ref, emailCiphertext: crypto.seal('invite@example.test', `team:${ref}:email`) }] });
  } });
  assert.equal(reads, 1); assert.equal(JSON.stringify(result).includes('did:privy:'), false); assert.equal(JSON.stringify(result).includes('Ciphertext'), false);
});
function webhook(type = 'email.delivered', signatureValid = true) {
  const payload = JSON.stringify({ type, data: { email_id: 'provider-id' }, created_at: new Date().toISOString() });
  const id = 'msg_test_event', timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', Buffer.from('test-signature-key')).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return new Request('https://www.trustleaf.org/api/team-mail-webhook', { method: 'POST', headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signatureValid ? signature : 'forged'}` }, body: payload });
}
test('signed raw webhook only; forged events rejected and early delivery asks provider to retry', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (_url, init) => { calls++; const data = JSON.parse(String(init?.body)); assert.equal(data.p_state, 'delivered'); return Response.json(null); };
  assert.equal((await teamMailWebhook(webhook('email.delivered', false), env, fetcher)).status, 400); assert.equal(calls, 0);
  assert.equal((await teamMailWebhook(webhook(), env, fetcher)).status, 200); assert.equal(calls, 1);
  assert.equal((await teamMailWebhook(webhook(), env, async () => Response.json({ code: 'PT409' }, { status: 409 }))).status, 503);
});
test('HTTP endpoint is private and never returns provider or SQL details', async () => {
  let status = 0, body: unknown; const headers: Record<string, string> = {};
  const response = { setHeader(k: string, v: string) { headers[k] = v; }, status(s: number) { status = s; return { json(b: unknown) { body = b; } }; } };
  await teamInvitationHandler({ method: 'POST', headers: {} }, response, env, verifier);
  assert.equal(status, 401); assert.match(headers['Cache-Control'], /no-store/);
  await teamInvitationHandler({ method: 'POST', headers: { 'privy-id-token': 'bad' }, body: { action: 'list' } }, response, env, { verify: async () => { throw new Error('secret@example.test'); } });
  assert.equal(JSON.stringify(body).includes('@'), false);
});
