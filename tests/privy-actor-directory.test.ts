import assert from 'node:assert/strict';
import test from 'node:test';
import { readActorDirectory } from '../api/_lib/privy-actor-directory.ts';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'synthetic', PRIVY_APP_ID: 'test-app', PRIVY_APP_SECRET: 'test-secret' };
const subject = 'did:privy:admin-test';
const actorRef = '11111111-1111-4111-8111-111111111111';
const verifier = { async verify() { return { subject, emails: [] }; } };
const binding = (role = 'admin') => ({ actor_ref: actorRef, role, actor_state: 'active' });
const row = { ...binding('doctor'), external_subject: 'did:privy:doctor-test' };
test('directory checks admin before querying identities or contacts', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json([binding('patient')]); };
  await assert.rejects(readActorDirectory({ token: 'fixture', offset: 0, env, verifier, fetcher }), { code: 'PRIVY_ROLE_FORBIDDEN' });
  assert.equal(calls, 1);
});
test('directory returns only contact, role, state and actor reference', async () => {
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).includes('resolve_privy')) return Response.json([binding()]);
    if (String(url).includes('actor_directory')) {
      assert.deepEqual(JSON.parse(String(init?.body)), { admin_subject: subject, page_offset: 0 });
      return Response.json([row]);
    }
    return Response.json({ id: row.external_subject, linked_accounts: [{ type: 'google_oauth', email: 'Doctor@example.test' }], private_field: 'must-not-leak' });
  };
  assert.deepEqual(await readActorDirectory({ token: 'fixture', offset: 0, env, verifier, fetcher }), {
    actors: [{ actorRef, role: 'doctor', state: 'active', email: 'doctor@example.test' }], nextOffset: null,
  });
});
test('provider failure or mismatched identity does not fabricate contact information', async () => {
  for (const mismatch of [true, false]) {
    const fetcher: typeof fetch = async url => {
      if (String(url).includes('resolve_privy')) return Response.json([binding()]);
      if (String(url).includes('actor_directory')) return Response.json([row]);
      return mismatch ? Response.json({ id: 'did:privy:other-user', linked_accounts: [{ type: 'email', address: 'wrong@example.test' }] }) : new Response(null, { status: 503 });
    };
    assert.equal((await readActorDirectory({ token: 'fixture', offset: 0, env, verifier, fetcher })).actors[0].email, null);
  }
});
test('directory validates pagination before network access', async () => {
  await assert.rejects(readActorDirectory({ token: 'fixture', offset: -1, env, verifier, fetcher: async () => { assert.fail('must not fetch'); } }));
});

test('directory bounds provider lookups and supplies the next page offset', async () => {
  let lookups = 0;
  const fetcher: typeof fetch = async url => {
    if (String(url).includes('resolve_privy')) return Response.json([binding()]);
    if (String(url).includes('actor_directory')) return Response.json(Array.from({ length: 26 }, () => row));
    lookups++;
    return new Response(null, { status: 503 });
  };
  const result = await readActorDirectory({ token: 'fixture', offset: 25, env, verifier, fetcher });
  assert.equal(result.actors.length, 25);
  assert.equal(result.nextOffset, 50);
  assert.equal(lookups, 25);
});
