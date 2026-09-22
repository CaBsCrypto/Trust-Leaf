import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { executeOnboarding, dispensaryOnboardingHandler } from '../api/_lib/dispensary-onboarding.ts';
import { teamCrypto, teamMailWebhook } from '../api/_lib/team-invitations.ts';

const env = { TRUSTLEAF_DISPENSARY_ONBOARDING_ENABLED: 'true', TEAM_INVITATION_ENCRYPTION_KEY: '12'.repeat(32),
  SUPABASE_URL: 'https://synthetic.supabase.test', SUPABASE_SECRET_KEY: 'test-only', PRIVY_APP_ID: 'test', PRIVY_APP_SECRET: 'test-only',
  RESEND_API_KEY: 'test-only', RESEND_WEBHOOK_SECRET: 'whsec_' + Buffer.from('test-signature-key').toString('base64') };
const subject = 'did:privy:onboarding-test-manager';
const verifier = { async verify() { return { subject, emails: ['stale@example.test'] }; } };
const crypto = teamCrypto(env);
test('disabled module and invalid commands perform no external requests', async () => {
  const fetcher: typeof fetch = async () => { throw new Error('unexpected request'); };
  await assert.rejects(executeOnboarding({ env: {}, verifier, token: 'id', command: { action: 'list' }, fetcher }), { code: 'ONBOARDING_DISABLED' });
  await assert.rejects(executeOnboarding({ env, verifier, token: 'id', command: { action: 'claim-send' }, fetcher }), { statusCode: 400 });
});
test('verified current email and subject cannot be supplied by browser', async () => {
  await executeOnboarding({ env, verifier, token: 'id', command: { action: 'accept', token: 'a'.repeat(43), consent: true, subject: 'forged', email: 'forged@example.test' },
    fetcher: async (url, init) => {
      if (String(url).startsWith('https://api.privy.io/')) return Response.json({ id: subject, linked_accounts: [{ type: 'email', address: 'actual@example.test', latest_verified_at: 100 }] });
      const body = JSON.parse(String(init?.body));
      assert.equal(body.p_subject, subject);
      assert.deepEqual(body.p_input.emailHashes, [crypto.hashEmail('actual@example.test')]);
      assert.equal(JSON.stringify(body).includes('forged'), false);
      return Response.json({ accepted: true });
    } });
});
test('mail persists encrypted secrets, uses separate category and stable retry key', async () => {
  let saved: Record<string,string> = {}, state = '', providerKey = '', mailBody = '', fail = true;
  const mailRef = randomUUID(), lease = randomUUID();
  const fetcher: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    if (String(url) === 'https://api.resend.com/emails') {
      assert.deepEqual(body.to, ['manager@example.test']);
      assert.equal(body.tags[1].value, 'dispensary_onboarding');
      assert.match(body.text, /#dispensary-invite=/);
      const key = new Headers(init?.headers).get('Idempotency-Key')!;
      if (providerKey) assert.equal(key, providerKey);
      if (mailBody) assert.equal(String(init?.body), mailBody);
      providerKey = key; mailBody = String(init?.body);
      return fail ? new Response('', { status: 500 }) : Response.json({ id: 'provider-ref' });
    }
    if (body.p_action === 'invite') {
      saved = body.p_input;
      assert.equal(JSON.stringify(saved).includes('manager@example.test'), false);
      assert.equal(crypto.open(saved.emailCiphertext, `onboarding:${saved.invitationRef}:email`), 'manager@example.test');
      return Response.json({ invitationRef: saved.invitationRef });
    }
    if (body.p_action === 'claim-send') return Response.json({ mail_ref: mailRef, lease_ref: lease, email_ciphertext: saved.emailCiphertext, payload_ciphertext: saved.payloadCiphertext, expires_at: '2099-01-01T00:00:00Z' });
    if (body.p_action === 'finish-send') { state = body.p_input.state; return Response.json({}); }
    throw new Error('unexpected RPC');
  };
  await executeOnboarding({ env, verifier, token: 'id', command: { action: 'invite', email: 'manager@example.test', operationId: randomUUID() }, fetcher });
  assert.equal(state, 'uncertain'); fail = false;
  await executeOnboarding({ env, verifier, token: 'id', command: { action: 'retry-send', invitationRef: saved.invitationRef }, fetcher });
  assert.equal(state, 'sent');
});
test('webhooks route separate category only after checking signature', async () => {
  const payload = JSON.stringify({ type: 'email.delivered', created_at: new Date().toISOString(), data: { email_id: 'provider-ref', from: 'Trust Leaf <admin@trustleaf.org>', tags: { app: 'trustleaf', category: 'dispensary_onboarding' } } });
  const timestamp = String(Math.floor(Date.now()/1000)), id = 'msg_test_onboarding';
  const signature = createHmac('sha256', Buffer.from('test-signature-key')).update(`${id}.${timestamp}.${payload}`).digest('base64');
  const request = (sig: string) => new Request('https://test/api/team-mail-webhook', { method: 'POST', headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${sig}` }, body: payload });
  let calls = 0;
  const fetcher: typeof fetch = async url => { calls++; assert.match(String(url), /trustleaf_onboarding_mail_event$/); return new Response(null, {status:204}); };
  assert.equal((await teamMailWebhook(request('forged'), env, fetcher)).status, 400);
  assert.equal(calls, 0);
  assert.equal((await teamMailWebhook(request(signature), env, fetcher)).status, 200);
  assert.equal(calls, 1);
});
test('HTTP boundary is no-store and requires session', async () => {
  const headers: Record<string,string> = {}; let status = 0;
  await dispensaryOnboardingHandler({method:'GET',headers:{}}, {setHeader(k,v){headers[k]=v;},status(s){status=s;return {json(body){return body;}};}}, env, verifier);
  assert.equal(status, 401); assert.equal(headers['Cache-Control'],'no-store, private');
});
