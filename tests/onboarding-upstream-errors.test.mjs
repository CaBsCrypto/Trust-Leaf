import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { inspect } from 'node:util';

const hook = registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.endsWith('/dispensary-onboarding.ts') && specifier === './team-invitations.js'
    ? './team-invitations.ts' : specifier, context);
} });
let handler;
try { ({ dispensaryOnboardingHandler: handler } = await import('../api/_lib/dispensary-onboarding.ts')); }
finally { hook.deregister(); }
const env = { TRUSTLEAF_DISPENSARY_ONBOARDING_ENABLED: 'true', TEAM_INVITATION_ENCRYPTION_KEY: '12'.repeat(32),
  SUPABASE_URL: 'https://synthetic.supabase.test', SUPABASE_SECRET_KEY: 'SYNTHETIC_SUPABASE_KEY',
  PRIVY_APP_ID: 'synthetic-app', PRIVY_APP_SECRET: 'SYNTHETIC_PRIVY_SECRET' };
const marker = 'SYNTHETIC_PRIVATE_UPSTREAM_BODY', token = 'SYNTHETIC_ID_TOKEN';
const subject = 'did:privy:onboarding-json-fixture';
const profile = { managerName: 'Synthetic manager', phone: '000000000', businessName: 'Synthetic demo',
  commune: 'Synthetic commune', address: 'Synthetic address', activity: marker, contactEmail: 'manager@example.test' };
const applicationRef = randomUUID();
const sqlUrl = `${env.SUPABASE_URL}/rest/v1/rpc/trustleaf_dispensary_onboarding`;
const privyUrl = `https://api.privy.io/v1/users/${encodeURIComponent(subject)}`;

async function invoke(body, options = {}) {
  const headers = {}, calls = [], fixtureFailures = [], logs = [];
  const originalFetch = globalThis.fetch, originals = new Map();
  let status, result, verified = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push(url);
    try {
      assert.ok([sqlUrl, privyUrl].includes(url), 'unintercepted network must not be used');
      if (url === sqlUrl) {
        const rpc = JSON.parse(String(init?.body));
        assert.equal(rpc.p_subject, subject);
        if (options.source === 'SQL') return new Response(`${marker} ${JSON.stringify(profile)}`, { status: 200 });
        if (options.source === 'Privy') return Response.json({ application: { applicationRef, state: 'draft', version: 1, profile } });
        return Response.json({ invitations: [], applications: [] });
      }
      assert.equal(options.source, 'Privy');
      return new Response(`${marker} ${token} manager@example.test`, { status: 200 });
    } catch (error) { fixtureFailures.push(error); throw error; }
  };
  for (const method of ['debug','info','log','warn','error']) {
    originals.set(method, console[method]); console[method] = (...args) => { logs.push(args); };
  }
  try {
    await handler({ method: options.method ?? 'POST', headers: options.headers ?? { 'privy-id-token': token }, body }, {
      setHeader(key, value) { headers[key] = value; },
      status(value) { status = value; return { json(value) { result = value; return value; } }; },
    }, options.disabled ? { ...env, TRUSTLEAF_DISPENSARY_ONBOARDING_ENABLED: 'false' } : env, {
      async verify(value) {
        verified++; assert.equal(value, token);
        if (options.reject) throw options.rejection;
        return { subject, emails: ['cached@example.test'] };
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [method, original] of originals) console[method] = original;
  }
  assert.equal(fixtureFailures.length, 0, 'caught errors cannot hide a failed fixture');
  assert.deepEqual(headers, { 'Cache-Control': 'no-store, private', Vary: 'privy-id-token' });
  const serialized = inspect({ result, headers, logs }, { depth: null, maxArrayLength: null, maxStringLength: null });
  for (const value of [marker, token, subject, profile.managerName, profile.phone, profile.address,
    profile.contactEmail, env.SUPABASE_SECRET_KEY, env.PRIVY_APP_SECRET, env.TEAM_INVITATION_ENCRYPTION_KEY]) {
    assert.equal(serialized.includes(value), false, 'private marker must not escape error/success projection or logs');
  }
  return { status, result, calls, verified };
}

for (const source of ['SQL','Privy']) test(`invalid successful ${source} JSON is503, not client400`, async () => {
  const body = source === 'SQL' ? { action: 'save-draft', applicationRef, version: 1, profile, operationId: randomUUID() }
    : { action: 'read-draft' };
  const result = await invoke(body, { source });
  assert.equal(result.status, 503); assert.deepEqual(result.result, { code: 'ONBOARDING_UNAVAILABLE' });
  assert.equal(result.verified, 1);
  assert.deepEqual(result.calls, source === 'SQL' ? [sqlUrl] : [sqlUrl, privyUrl]);
});
for (const body of [`{"profile":${marker}}`, '{', '']) test('invalid request JSON is400 before identity/network', async () => {
  const result = await invoke(body);
  assert.equal(result.status, 400); assert.deepEqual(result.result, { code: 'ONBOARDING_UNAVAILABLE' });
  assert.equal(result.verified, 0); assert.deepEqual(result.calls, []);
});
for (const statusCode of [400,401,403,409,429]) test(`explicit known status ${statusCode} is preserved`, async () => {
  const result = await invoke({ action: 'list' }, { reject: true, rejection: { statusCode, code: marker, message: marker } });
  assert.equal(result.status, statusCode); assert.deepEqual(result.result, { code: 'ONBOARDING_UNAVAILABLE' });
  assert.equal(result.verified, 1); assert.deepEqual(result.calls, []);
});
for (const rejection of [new SyntaxError(marker), new Error(marker), null, undefined, marker]) test('unclassified upstream failures are503', async () => {
  const result = await invoke({ action: 'list' }, { reject: true, rejection });
  assert.equal(result.status, 503); assert.deepEqual(result.result, { code: 'ONBOARDING_UNAVAILABLE' });
  assert.deepEqual(result.calls, []);
});
test('method/auth precede parsing, disabled module and valid reads retain contracts', async () => {
  const method = await invoke('{', { method: 'PUT' });
  assert.equal(method.status, 405); assert.deepEqual(method.result, { code: 'METHOD_NOT_ALLOWED' });
  const auth = await invoke('{', { headers: {} });
  assert.equal(auth.status, 401); assert.deepEqual(auth.result, { code: 'AUTH_REQUIRED' });
  const disabled = await invoke({ action: 'list' }, { disabled: true });
  assert.equal(disabled.status, 503); assert.deepEqual(disabled.result, { code: 'ONBOARDING_DISABLED' });
  const good = await invoke('ignored invalid body on GET', { method: 'GET' });
  assert.equal(good.status, 200); assert.deepEqual(good.result, { invitations: [], applications: [] });
  assert.deepEqual(good.calls, [sqlUrl]);
});
