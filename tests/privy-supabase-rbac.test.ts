import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrivyRbacAuthorizer, createSupabasePrivyActorStore } from '../api/_lib/privy-supabase-rbac.ts';

const subject = 'did:privy:patient-123456';
const actorRef = '11111111-1111-4111-8111-111111111111';

test('resolves an active Privy actor through the private Supabase RPC', async () => {
  const calls: RequestInit[] = [];
  const store = createSupabasePrivyActorStore({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only-key' }, async (_url, request) => {
    calls.push(request!);
    return new Response(JSON.stringify([{ actor_ref: actorRef, role: 'patient', actor_state: 'active', valid_until: null }]));
  });
  const authorizer = createPrivyRbacAuthorizer({
    verifier: { async verify() { return { subject }; } },
    store,
  });
  assert.deepEqual(await authorizer.authorize('identity-token', ['patient']), { subject, actorRef, role: 'patient', state: 'active' });
  assert.equal(calls[0].headers && new Headers(calls[0].headers).get('content-profile'), 'trustleaf_private');
});

test('fails closed for an unbound actor or a forbidden role', async () => {
  const authorizer = createPrivyRbacAuthorizer({
    verifier: { async verify() { return { subject }; } },
    store: { async resolve() { return null; } },
  });
  await assert.rejects(authorizer.authorize('identity-token', ['patient']), { code: 'PRIVY_ACTOR_NOT_ACTIVE', statusCode: 403 });
});
