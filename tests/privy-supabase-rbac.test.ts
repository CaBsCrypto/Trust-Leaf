import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrivyRbacAuthorizer, createSupabasePrivyActorStore } from '../api/_lib/privy-supabase-rbac.ts';

const subject = 'did:privy:patient-123456';
const actorRef = '11111111-1111-4111-8111-111111111111';

test('enrollment rejects runtime roles outside the public enrollment set', async () => {
  const store = createSupabasePrivyActorStore({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'synthetic-key' }, async () => {
    assert.fail('invalid enrollment must not call Supabase');
  });
  for (const role of ['admin', 'unknown', null]) {
    await assert.rejects(store.enroll(subject, role as 'doctor'), { code: 'PRIVY_ENROLLMENT_INVALID' });
  }
});

test('review queue requires a positive numeric version', async () => {
  for (const version of [1, '1', null, 0, -1, 1.5]) {
    const store = createSupabasePrivyActorStore({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'synthetic-key' }, async () =>
      new Response(JSON.stringify([{ actor_ref: actorRef, role: 'doctor', version, requested_at: '2026-09-05T12:00:00Z' }])));
    if (version === 1) assert.equal((await store.listPending(subject))[0].version, 1);
    else await assert.rejects(store.listPending(subject), { code: 'PRIVY_REVIEW_QUEUE_UNAVAILABLE' });
  }
});

test('resolves an active Privy actor through the server-only Supabase gateway', async () => {
  const calls: Array<{ url: string; request: RequestInit }> = [];
  const store = createSupabasePrivyActorStore({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only-key' }, async (url, request) => {
    calls.push({ url: String(url), request: request! });
    return new Response(JSON.stringify([{ actor_ref: actorRef, role: 'patient', actor_state: 'active', valid_until: null }]));
  });
  const authorizer = createPrivyRbacAuthorizer({
    verifier: { async verify() { return { subject, emails: [] }; } },
    store,
  });
  assert.deepEqual(await authorizer.authorize('identity-token', ['patient']), { subject, actorRef, role: 'patient', state: 'active' });
  assert.equal(calls[0].url.endsWith('/rest/v1/rpc/trustleaf_resolve_privy_actor'), true);
});

test('fails closed for an unbound actor or a forbidden role', async () => {
  const authorizer = createPrivyRbacAuthorizer({
    verifier: { async verify() { return { subject, emails: [] }; } },
    store: { async resolve() { return null; } },
  });
  await assert.rejects(authorizer.authorize('identity-token', ['patient']), { code: 'PRIVY_ACTOR_NOT_ACTIVE', statusCode: 403 });
});
