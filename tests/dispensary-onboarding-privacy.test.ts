import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { inspect } from 'node:util';

const hooks = registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.endsWith('/dispensary-onboarding.ts') && specifier === './team-invitations.js'
    ? './team-invitations.ts' : specifier, context);
} });
const { dispensaryOnboardingHandler, executeOnboarding } = await import('../api/_lib/dispensary-onboarding.ts');
const { teamCrypto } = await import('../api/_lib/team-invitations.ts');
hooks.deregister();

const env = {
  TRUSTLEAF_DISPENSARY_ONBOARDING_ENABLED: 'true', TEAM_INVITATION_ENCRYPTION_KEY: '12'.repeat(32),
  SUPABASE_URL: 'https://synthetic.supabase.test', SUPABASE_SECRET_KEY: 'SYNTHETIC_SUPABASE_KEY',
  PRIVY_APP_ID: 'synthetic-app', PRIVY_APP_SECRET: 'SYNTHETIC_PRIVY_SECRET', RESEND_API_KEY: 'SYNTHETIC_RESEND_KEY',
};
const subject = 'did:privy:onboarding-privacy-fixture';
const identityToken = 'SYNTHETIC_ID_TOKEN_DO_NOT_LOG';
const invitationToken = 'A'.repeat(43);
const email = 'manager@example.test';
const currentEmail = 'current@example.test';
const staleEmail = 'stale@example.test';
const sqlUrl = `${env.SUPABASE_URL}/rest/v1/rpc/trustleaf_dispensary_onboarding`;
const privyUrl = `https://api.privy.io/v1/users/${encodeURIComponent(subject)}`;
const mailUrl = 'https://api.resend.com/emails';
const crypto = teamCrypto(env);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const profile = {
  managerName: 'Synthetic manager', phone: '000000000', businessName: 'Synthetic dispensary',
  commune: 'Synthetic commune', address: 'Synthetic address 123', activity: 'SYNTHETIC_PROFILE_SENTINEL',
  contactEmail: email,
};
// Same application/list fields as the SQL view; no invented internal success fields.
const application = {
  applicationRef: randomUUID(), state: 'draft', version: 2, profile, reason: null,
  organizationRef: null, updatedAt: '2026-10-01T00:00:00Z',
};
const credentials = [identityToken, invitationToken, subject, env.SUPABASE_SECRET_KEY,
  env.PRIVY_APP_SECRET, env.RESEND_API_KEY, env.TEAM_INVITATION_ENCRYPTION_KEY];
const privateMarkers = [...credentials, email, currentEmail, staleEmail, profile.managerName,
  profile.phone, profile.address, profile.activity];
const privateDiagnostic = `${email} ${identityToken} ${invitationToken} ${JSON.stringify(profile)}`;
type Verifier = Parameters<typeof dispensaryOnboardingHandler>[3];
const verifier: Verifier = { async verify(token) {
  assert.equal(token, identityToken);
  return { subject, emails: [staleEmail] };
} };

function excludes(value: unknown, markers: readonly string[]) {
  const serialized = inspect(value, { depth: null, breakLength: Infinity, maxArrayLength: null, maxStringLength: null });
  for (const marker of markers) assert.equal(serialized.includes(marker), false, 'synthetic private marker must not escape');
}
function rpcInput(init?: RequestInit) {
  const body = JSON.parse(String(init?.body));
  assert.equal(body.p_subject, subject);
  return body as { p_subject: string; p_action: string; p_input: Record<string, unknown> };
}
async function http(body: unknown = { action: 'list' }, identityVerifier = verifier, method = 'POST') {
  let status = 0, responseBody: unknown;
  const headers: Record<string, string> = {};
  await dispensaryOnboardingHandler({ method, headers: { 'privy-id-token': identityToken }, body }, {
    setHeader(key, value) { headers[key] = value; },
    status(value) { status = value; return { json(value: unknown) { responseBody = value; return value; } }; },
  }, env, identityVerifier);
  assert.equal(headers['Cache-Control'], 'no-store, private');
  assert.equal(headers.Vary, 'privy-id-token');
  excludes(headers, privateMarkers);
  return { status, body: responseBody };
}
function safeError(result: Awaited<ReturnType<typeof http>>, status: number) {
  excludes(result.body, privateMarkers);
  assert.deepEqual(result.body, { code: 'ONBOARDING_UNAVAILABLE' });
  assert.equal(result.status, status);
}

describe('onboarding HTTP privacy boundary (synthetic upstreams, no SQL isolation claim)', { concurrency: false }, () => {
  const methods = ['debug', 'info', 'log', 'warn', 'error'] as const;
  let originalFetch: typeof fetch;
  let originalConsole: Array<typeof console.log>;
  let upstream: typeof fetch | undefined;
  let calls: Array<{ url: string; init?: RequestInit }>;
  let unexpected: string[];
  let fixtureFailures: unknown[];
  let logs: unknown[][];
  let logMarkers: string[];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalConsole = methods.map(method => console[method]);
    upstream = undefined; calls = []; unexpected = []; fixtureFailures = []; logs = [];
    logMarkers = [...privateMarkers];
    // Never delegate to native fetch: only explicitly installed synthetic responses can run.
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (!upstream || ![sqlUrl, privyUrl, mailUrl].includes(url)) {
        unexpected.push(url);
        throw new Error('NETWORK_BLOCKED_BY_PRIVACY_TEST');
      }
      try { return await upstream(input, init); }
      catch (error) {
        if (error instanceof assert.AssertionError) fixtureFailures.push(error);
        throw error;
      }
    };
    for (const method of methods) console[method] = (...args: unknown[]) => { logs.push(args); };
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    methods.forEach((method, index) => { console[method] = originalConsole[index]; });
    assert.equal(unexpected.length, 0, 'no unmocked network request is allowed');
    assert.equal(fixtureFailures.length, 0, 'handler catches must not hide failed fixture assertions');
    excludes(logs, logMarkers);
  });

  test('privacy matcher detects a marker beyond the default 100 array entries', () => {
    const entries = [...Array(150).fill('public entry'), identityToken];
    assert.throws(() => excludes({ logs: entries }, [identityToken]), assert.AssertionError);
  });

  test('privacy matcher detects a marker beyond the default 10000 string characters', () => {
    const diagnostic = `${'x'.repeat(10_001)}${identityToken}`;
    assert.throws(() => excludes({ diagnostic }, [identityToken]), assert.AssertionError);
  });

  for (const status of [401, 503]) test(`verifier ${status}: private diagnostics never reach HTTP or logs`, async () => {
    const rejecting: Verifier = { async verify() {
      throw Object.assign(new Error(privateDiagnostic), { statusCode: status, code: privateDiagnostic,
        details: profile, hint: identityToken });
    } };
    safeError(await http({ action: 'list' }, rejecting, 'GET'), status);
    assert.equal(calls.length, 0);
  });

  test('SQL transport failure: sanitized HTTP, one request, no automatic retry', async () => {
    upstream = async (url, init) => {
      assert.equal(String(url), sqlUrl); assert.equal(rpcInput(init).p_action, 'list');
      throw new Error(privateDiagnostic);
    };
    safeError(await http(undefined, verifier, 'GET'), 503);
    assert.equal(calls.length, 1);
  });

  for (const [code, status] of [['42501', 403], ['PT409', 409], ['PT429', 429], ['22023', 400], ['XX000', 503]] as const) {
    test(`SQL ${code}: only generic HTTP code, no diagnostic payload`, async () => {
      upstream = async (url, init) => {
        assert.equal(String(url), sqlUrl); assert.equal(rpcInput(init).p_action, 'save-draft');
        return Response.json({ code, message: privateDiagnostic, details: profile, hint: identityToken }, { status: 400 });
      };
      safeError(await http({ action: 'save-draft', applicationRef: application.applicationRef,
        version: 1, profile, operationId: randomUUID() }), status);
      assert.equal(calls.length, 1);
    });
  }

  test('invalid client JSON is 400 without reflecting private input or invoking upstreams', async () => {
    safeError(await http(`{"private":${JSON.stringify(privateDiagnostic)}`), 400);
    assert.equal(calls.length, 0);
  });

  // Upstream JSON status reproductions are separate: tests/repro/onboarding-upstream-json.mjs.

  test('list removes projected emailCiphertext but retains authorized email and application', async () => {
    const invitationRef = randomUUID();
    const emailCiphertext = crypto.seal(email, `onboarding:${invitationRef}:email`);
    const invitation = { invitationRef, state: 'pending', expiresAt: '2099-01-01T00:00:00Z', deliveryState: 'sent' };
    upstream = async (url, init) => {
      assert.equal(String(url), sqlUrl); assert.equal(rpcInput(init).p_action, 'list');
      return Response.json({ invitations: [{ ...invitation, emailCiphertext }], applications: [application] });
    };
    const result = await http(undefined, verifier, 'GET');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { invitations: [{ ...invitation, email }], applications: [application] });
    excludes(result.body, [...credentials, emailCiphertext, 'emailCiphertext', 'tokenHash', 'payloadCiphertext']);
    assert.equal(calls.length, 1);
  });

  test('read-draft preserves projected profile and obtains accessEmail from the current verified identity', async () => {
    upstream = async (url, init) => {
      if (String(url) === sqlUrl) {
        assert.equal(rpcInput(init).p_action, 'read-draft'); return Response.json({ application });
      }
      assert.equal(String(url), privyUrl);
      return Response.json({ id: subject, linked_accounts: [{ type: 'email', address: currentEmail, latest_verified_at: 100 }] });
    };
    const result = await http({ action: 'read-draft' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { application, accessEmail: currentEmail });
    excludes(result.body, [...credentials, staleEmail]);
    assert.equal(calls.length, 2);
  });

  test('read-draft mismatched provider identity does not return a previously fetched profile', async () => {
    upstream = async (url, init) => {
      if (String(url) === sqlUrl) {
        assert.equal(rpcInput(init).p_action, 'read-draft'); return Response.json({ application });
      }
      assert.equal(String(url), privyUrl);
      return Response.json({ id: 'did:privy:different-fixture', linked_accounts: [{ type: 'email', address: currentEmail, latest_verified_at: 100 }] });
    };
    safeError(await http({ action: 'read-draft' }), 503);
    assert.equal(calls.length, 2);
  });

  test('inspect export sends token digest and current email HMAC, never raw invitation or stale email', async () => {
    const preview = { accepted: false, expiresAt: '2099-01-01T00:00:00Z' };
    upstream = async (url, init) => {
      if (String(url) === privyUrl) return Response.json({ id: subject,
        linked_accounts: [{ type: 'email', address: currentEmail, latest_verified_at: 100 }] });
      assert.equal(String(url), sqlUrl);
      const rpc = rpcInput(init);
      assert.equal(rpc.p_action, 'inspect');
      assert.deepEqual(rpc.p_input, { tokenHash: hash(invitationToken), emailHashes: [crypto.hashEmail(currentEmail)], consent: false });
      excludes(rpc, [identityToken, invitationToken, currentEmail, staleEmail]);
      return Response.json(preview);
    };
    assert.deepEqual(await executeOnboarding({ env, verifier, token: identityToken,
      command: { action: 'inspect', token: invitationToken }, fetcher: globalThis.fetch }), preview);
    assert.equal(calls.length, 2);
  });

  test('invite persists encrypted email/token and hashes; uncertain mail sends once and returns no credentials', async () => {
    let saved: Record<string, unknown> = {}, finish: Record<string, unknown> = {}, mail: Record<string, unknown> = {};
    const mailRef = randomUUID(), leaseRef = randomUUID();
    const actions: string[] = [];
    upstream = async (url, init) => {
      if (String(url) === mailUrl) {
        mail = JSON.parse(String(init?.body));
        assert.deepEqual(mail.to, [email]);
        assert.equal(new Headers(init?.headers).get('Idempotency-Key'), `onboarding/${mailRef}`);
        throw new Error(privateDiagnostic);
      }
      assert.equal(String(url), sqlUrl);
      const rpc = rpcInput(init); actions.push(rpc.p_action);
      if (rpc.p_action === 'invite') {
        saved = rpc.p_input; return Response.json({ invitationRef: saved.invitationRef });
      }
      if (rpc.p_action === 'claim-send') return Response.json({ mail_ref: mailRef, lease_ref: leaseRef,
        email_ciphertext: saved.emailCiphertext, payload_ciphertext: saved.payloadCiphertext, expires_at: '2099-01-01T00:00:00Z' });
      assert.equal(rpc.p_action, 'finish-send'); finish = rpc.p_input; return Response.json({});
    };
    const result = await http({ action: 'invite', email, operationId: randomUUID() });
    const ref = String(saved.invitationRef);
    const secret = crypto.open(String(saved.payloadCiphertext), `onboarding:${ref}:token`);
    logMarkers.push(secret, String(saved.emailCiphertext), String(saved.payloadCiphertext));
    assert.equal(crypto.open(String(saved.emailCiphertext), `onboarding:${ref}:email`), email);
    assert.equal(saved.emailHash, crypto.hashEmail(email));
    assert.equal(saved.tokenHash, hash(secret));
    assert.match(secret, /^[A-Za-z0-9_-]{43}$/);
    excludes(saved, [email, secret, identityToken]);
    assert.ok(String(mail.text).includes(`#dispensary-invite=${secret}`));
    assert.deepEqual(finish, { invitationRef: ref, leaseRef, state: 'uncertain', providerRef: null });
    assert.deepEqual(actions, ['invite', 'claim-send', 'finish-send']);
    assert.equal(calls.filter(call => call.url === mailUrl).length, 1);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { invitationRef: ref });
    excludes(result.body, [...privateMarkers, secret, String(saved.emailHash), String(saved.tokenHash),
      String(saved.emailCiphertext), String(saved.payloadCiphertext)]);
  });

  test('list ciphertext with wrong authentication context fails without returning email, profile or ciphertext', async () => {
    const invitationRef = randomUUID();
    const emailCiphertext = crypto.seal(email, `onboarding:${randomUUID()}:email`);
    upstream = async (url, init) => {
      assert.equal(String(url), sqlUrl); assert.equal(rpcInput(init).p_action, 'list');
      return Response.json({ invitations: [{ invitationRef, emailCiphertext, state: 'pending',
        expiresAt: '2099-01-01T00:00:00Z', deliveryState: 'sent' }], applications: [application] });
    };
    const result = await http(undefined, verifier, 'GET');
    safeError(result, 503); excludes(result.body, [emailCiphertext]); logMarkers.push(emailCiphertext);
    assert.equal(calls.length, 1);
  });

  test('retry-send token ciphertext failure occurs before any mail or success record', async () => {
    const invitationRef = randomUUID();
    const payloadCiphertext = crypto.seal(invitationToken, `onboarding:${randomUUID()}:token`);
    upstream = async (url, init) => {
      assert.equal(String(url), sqlUrl); assert.equal(rpcInput(init).p_action, 'claim-send');
      return Response.json({ mail_ref: randomUUID(), lease_ref: randomUUID(),
        email_ciphertext: crypto.seal(email, `onboarding:${invitationRef}:email`), payload_ciphertext: payloadCiphertext,
        expires_at: '2099-01-01T00:00:00Z' });
    };
    const result = await http({ action: 'retry-send', invitationRef });
    safeError(result, 503); excludes(result.body, [payloadCiphertext]); logMarkers.push(payloadCiphertext);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, sqlUrl);
  });

  test('uncertain profile mutation makes one RPC; only an explicit retry sends the same intent again', async () => {
    const command = { action: 'save-draft', applicationRef: application.applicationRef,
      version: 1, profile, operationId: randomUUID() };
    const inputs: unknown[] = [];
    upstream = async (url, init) => {
      assert.equal(String(url), sqlUrl);
      const rpc = rpcInput(init); assert.equal(rpc.p_action, 'save-draft'); inputs.push(rpc.p_input);
      if (inputs.length === 1) throw new Error(privateDiagnostic);
      return Response.json({ application });
    };
    safeError(await http(command), 503);
    assert.equal(calls.length, 1);
    assert.equal(inputs.length, 1);
    const retried = await http(command);
    assert.equal(retried.status, 200);
    assert.deepEqual(retried.body, { application });
    excludes(retried.body, credentials);
    assert.equal(calls.length, 2);
    assert.deepEqual(inputs[1], inputs[0]);
    // This checks HTTP retry behavior, not SQL idempotency or authorization.
  });
});
