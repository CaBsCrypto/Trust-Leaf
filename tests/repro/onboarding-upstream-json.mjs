// Manual reproduction, not wired to package scripts/CI and deliberately not named *.test.*.
// Run from the repo root: node --experimental-strip-types tests/repro/onboarding-upstream-json.mjs
// Baseline 86e2016: two failures, actual HTTP 400 versus expected 503, exit 1.
// Preserve the 503 assertions for the separate functional classification fix; no SQL isolation claim.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';
import { inspect } from 'node:util';

const originalFetch = globalThis.fetch;
const blockedFetch = async () => { throw new Error('NETWORK_BLOCKED_BY_MANUAL_REPRODUCTION'); };
globalThis.fetch = blockedFetch;
after(() => { globalThis.fetch = originalFetch; });
const hooks = registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.endsWith('/dispensary-onboarding.ts') && specifier === './team-invitations.js'
    ? './team-invitations.ts' : specifier, context);
} });
let dispensaryOnboardingHandler;
try { ({ dispensaryOnboardingHandler } = await import('../../api/_lib/dispensary-onboarding.ts')); }
finally { hooks.deregister(); }

const env = {
  TRUSTLEAF_DISPENSARY_ONBOARDING_ENABLED: 'true', TEAM_INVITATION_ENCRYPTION_KEY: '12'.repeat(32),
  SUPABASE_URL: 'https://synthetic.supabase.test', SUPABASE_SECRET_KEY: 'SYNTHETIC_SUPABASE_KEY',
  PRIVY_APP_ID: 'synthetic-app', PRIVY_APP_SECRET: 'SYNTHETIC_PRIVY_SECRET', RESEND_API_KEY: 'SYNTHETIC_RESEND_KEY',
};
const subject = 'did:privy:onboarding-privacy-fixture';
const identityToken = 'SYNTHETIC_ID_TOKEN_DO_NOT_LOG';
const invitationToken = 'A'.repeat(43);
const email = 'manager@example.test';
const profile = {
  managerName: 'Synthetic manager', phone: '000000000', businessName: 'Synthetic dispensary',
  commune: 'Synthetic commune', address: 'Synthetic address 123', activity: 'SYNTHETIC_PROFILE_SENTINEL',
  contactEmail: email,
};
const application = {
  applicationRef: randomUUID(), state: 'draft', version: 2, profile, reason: null,
  organizationRef: null, updatedAt: '2026-10-01T00:00:00Z',
};
const privateDiagnostic = `${email} ${identityToken} ${invitationToken} ${JSON.stringify(profile)}`;
const markers = [email, identityToken, invitationToken, subject, profile.managerName, profile.phone,
  profile.address, profile.activity, env.SUPABASE_SECRET_KEY, env.PRIVY_APP_SECRET, env.RESEND_API_KEY,
  env.TEAM_INVITATION_ENCRYPTION_KEY];
const sqlUrl = `${env.SUPABASE_URL}/rest/v1/rpc/trustleaf_dispensary_onboarding`;
const privyUrl = `https://api.privy.io/v1/users/${encodeURIComponent(subject)}`;

for (const source of ['SQL mutation', 'Privy']) {
  test(`manual negative: invalid ${source} JSON is upstream unavailability, not client input`, { concurrency: false }, async () => {
    const command = source === 'SQL mutation'
      ? { action: 'save-draft', applicationRef: application.applicationRef, version: 1, profile, operationId: randomUUID() }
      : { action: 'read-draft' };
    const calls = [], fixtureFailures = [], logs = [];
    const methods = ['debug', 'info', 'log', 'warn', 'error'];
    const originalConsole = methods.map(method => console[method]);
    let status = 0, responseBody;
    const headers = {};
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      try {
        assert.ok([sqlUrl, privyUrl].includes(url), 'no unmocked network request is allowed');
        if (url === sqlUrl) {
          const rpc = JSON.parse(String(init?.body));
          assert.equal(rpc.p_subject, subject);
          assert.equal(rpc.p_action, command.action);
          if (source === 'Privy') return Response.json({ application });
        } else {
          assert.equal(source, 'Privy');
          assert.equal(url, privyUrl);
        }
        return new Response(privateDiagnostic, { status: 200, headers: { 'content-type': 'application/json' } });
      } catch (error) {
        fixtureFailures.push(error);
        throw error;
      }
    };
    for (const method of methods) console[method] = (...args) => { logs.push(args); };
    try {
      await dispensaryOnboardingHandler({ method: 'POST', headers: { 'privy-id-token': identityToken }, body: command }, {
        setHeader(key, value) { headers[key] = value; },
        status(value) { status = value; return { json(value) { responseBody = value; return value; } }; },
      }, env, { async verify(token) { assert.equal(token, identityToken); return { subject, emails: ['stale@example.test'] }; } });
    } finally {
      globalThis.fetch = blockedFetch;
      methods.forEach((method, index) => { console[method] = originalConsole[index]; });
    }
    assert.equal(fixtureFailures.length, 0, 'handler catches must not hide failed fixture assertions');
    assert.deepEqual(calls, source === 'SQL mutation' ? [sqlUrl] : [sqlUrl, privyUrl]);
    assert.equal(headers['Cache-Control'], 'no-store, private');
    assert.equal(headers.Vary, 'privy-id-token');
    const serialized = inspect({ body: responseBody, headers, logs }, {
      depth: null, breakLength: Infinity, maxArrayLength: null, maxStringLength: null,
    });
    for (const marker of markers) assert.equal(serialized.includes(marker), false, 'synthetic private marker must not escape');
    assert.deepEqual(responseBody, { code: 'ONBOARDING_UNAVAILABLE' });
    assert.equal(status, 503);
  });
}
