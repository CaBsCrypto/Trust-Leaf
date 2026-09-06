import assert from 'node:assert/strict';
import test from 'node:test';
import { readPrivyAdminJson } from '../src/lib/privyRead.ts';
const path = '/api/auth/privy/admin/actors?offset=0';
test('recovers once from a rejected identity token for a GET', async () => {
  let calls = 0;
  let refreshes = 0;
  const identity = { async getIdentityToken() { return 'old-fixture'; }, async refreshIdentityToken() { refreshes++; return 'fresh-fixture'; } };
  const result = await readPrivyAdminJson(path, identity, undefined, async (_url, init) => {
    calls++;
    assert.equal(init?.method, 'GET');
    assert.equal(init?.cache, 'no-store');
    if (calls === 1) return new Response(null, { status: 401 });
    assert.equal(new Headers(init?.headers).get('privy-id-token'), 'fresh-fixture');
    return Response.json({ actors: [] });
  });
  assert.deepEqual(result, { actors: [] });
  assert.equal(calls, 2); assert.equal(refreshes, 1);
});
test('does not retry permissions, server failures or mutations', async () => {
  for (const status of [403, 503]) {
    let calls = 0;
    await assert.rejects(readPrivyAdminJson(path, { async getIdentityToken() { return 'fixture'; }, async refreshIdentityToken() { assert.fail('must not refresh'); } }, undefined, async () => { calls++; return new Response(null, { status }); }));
    assert.equal(calls, 1);
  }
  await assert.rejects(readPrivyAdminJson('/api/auth/privy/admin/review-actor', { async getIdentityToken() { assert.fail('mutation route must not execute'); } }));
});
test('missing tokens can recover once; repeated rejection stops', async () => {
  let refreshes = 0;
  const identity = { async getIdentityToken() { return null; }, async refreshIdentityToken() { refreshes++; return 'fixture'; } };
  await assert.rejects(readPrivyAdminJson(path, identity, undefined, async () => new Response(null, { status: 401 })));
  assert.equal(refreshes, 1);
});
test('cancelled requests do not send identity tokens', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readPrivyAdminJson(path, { async getIdentityToken() { return 'fixture'; } }, controller.signal, async () => { assert.fail('aborted read must not fetch'); }));
});
