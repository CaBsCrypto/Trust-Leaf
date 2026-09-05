import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrivyRbacAuthorizer, createSupabasePrivyActorStore, type PrivyActorRole, type PrivyActorState } from '../api/_lib/privy-supabase-rbac.ts';

const roles: PrivyActorRole[] = ['admin', 'doctor', 'dispensary', 'patient'];
// Test-only identities. Neither the tokens nor the mailboxes exist in Privy.
const identities = roles.map((role, index) => ({
  role,
  subject: `did:privy:synthetic-${role}`,
  email: `${role}@trustleaf.example`,
  token: `fixture-only-${role}`,
  actorRef: `00000000-0000-4000-8000-00000000000${index + 1}`,
}));

test('four synthetic identities exercise the real authorizer and RPC adapter without network', async () => {
  const states = new Map<PrivyActorRole, PrivyActorState>(roles.map(role => [role, 'active']));
  const now = Date.parse('2026-09-05T12:00:00Z');
  let validUntil: string | null = null;
  const store = createSupabasePrivyActorStore({
    SUPABASE_URL: 'https://supabase.invalid', SUPABASE_SECRET_KEY: 'fixture-only',
  }, async (url, request) => {
    assert.equal(String(url), 'https://supabase.invalid/rest/v1/rpc/trustleaf_resolve_privy_actor');
    const { subject } = JSON.parse(String(request?.body));
    const identity = identities.find(item => item.subject === subject);
    return new Response(JSON.stringify(identity ? [{
      actor_ref: identity.actorRef, role: identity.role,
      actor_state: states.get(identity.role), valid_until: validUntil,
    }] : []));
  });
  const authorizer = createPrivyRbacAuthorizer({
    now: () => now / 1000,
    store,
    verifier: { async verify(token) {
      const identity = identities.find(item => item.token === token);
      if (!identity) throw Object.assign(new Error('Invalid fixture token'), { code: 'FIXTURE_TOKEN_INVALID' });
      return { subject: identity.subject, emails: [identity.email] };
    } },
  });

  for (const identity of identities) {
    const principal = await authorizer.authorize(identity.token, [identity.role]);
    assert.equal(principal.actorRef, identity.actorRef);
    for (const other of roles.filter(role => role !== identity.role)) {
      await assert.rejects(authorizer.authorize(identity.token, [other]), { code: 'PRIVY_ROLE_FORBIDDEN' });
    }
    for (const state of ['pending', 'suspended', 'revoked', 'expired'] as const) {
      states.set(identity.role, state);
      await assert.rejects(authorizer.authorize(identity.token, [identity.role]), { code: 'PRIVY_ACTOR_NOT_ACTIVE' });
    }
    states.set(identity.role, 'active');
    validUntil = new Date(now).toISOString();
    await assert.rejects(authorizer.authorize(identity.token, [identity.role]), { code: 'PRIVY_ACTOR_NOT_ACTIVE' });
    validUntil = new Date(now + 60_000).toISOString();
    assert.equal((await authorizer.authorize(identity.token, [identity.role])).role, identity.role);
    validUntil = null;
  }
  await assert.rejects(authorizer.authorize('invented-token', ['admin']), { code: 'FIXTURE_TOKEN_INVALID' });
});
