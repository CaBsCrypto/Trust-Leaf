import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const hooks = registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.endsWith('/dispensary-commerce.ts') && specifier.endsWith('.js') ? specifier.slice(0, -3) + '.ts' : specifier, context);
} });
const { executeDispensaryCommerce, dispensaryCommerceHandler } = await import('../api/_lib/dispensary-commerce.ts');
hooks.deregister();
const env = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'synthetic-only',
  TRUSTLEAF_OPERATIONS_PILOT_ENABLED: 'true', TRUSTLEAF_COMMERCE_CATALOG_ENABLED: 'true' };
const verifier = { async verify() { return { subject: 'did:privy:commerce-fixture', emails: [] }; } };
const binding = [{ actor_ref: '11111111-1111-4111-8111-111111111111', role: 'dispensary', actor_state: 'active' }];
test('commerce requires both flags and does not contact the database when disabled', async () => {
  for (const disabled of [{}, { ...env, TRUSTLEAF_COMMERCE_CATALOG_ENABLED: 'false' }, { ...env, TRUSTLEAF_OPERATIONS_PILOT_ENABLED: 'false' }]) {
    await assert.rejects(executeDispensaryCommerce({ token: 'fixture', command: { action: 'products', input: {} }, env: disabled, verifier,
      fetcher: async () => { throw new Error('must not fetch'); } }), { code: 'COMMERCE_DISABLED' });
  }
});
test('RPC derives identity from verified token; only one action is executed', async () => {
  let writes = 0;
  await executeDispensaryCommerce({ token: 'fixture', command: { action: 'receive', input: { subject: 'forged', organizationRef: 'forged' } }, env, verifier,
    fetcher: async (url, init) => {
      if (String(url).includes('resolve_privy')) return Response.json(binding);
      writes++; assert.match(String(url), /trustleaf_dispensary_commerce$/);
      assert.equal(JSON.parse(String(init?.body)).p_subject, 'did:privy:commerce-fixture');
      return Response.json({ synthetic: true });
    } });
  assert.equal(writes, 1);
});
test('invalid envelopes are rejected before authorization', async () => {
  for (const command of [null, { action: 'dispense', input: {} }, { action: 'products', input: [] }, { action: 'receive', input: { oversized: 'a'.repeat(13000) } }]) {
    await assert.rejects(executeDispensaryCommerce({ token: 'fixture', command, env, verifier,
      fetcher: async () => { throw new Error('must not fetch'); } }), { statusCode: 400 });
  }
});
test('private upstream errors stay private and uncertain writes are not automatically retried', async () => {
  for (const [code, statusCode] of [['42501', 403], ['PT409', 409], ['23514', 400], ['XX000', 503]] as const) {
    let requests = 0;
    await assert.rejects(executeDispensaryCommerce({ token: 'fixture', command: { action: 'receive', input: {} }, env, verifier,
      fetcher: async url => { if (String(url).includes('resolve_privy')) return Response.json(binding);
        requests++; return Response.json({ code, message: 'PRIVATE' }, { status: 400 }); } }),
      (error: unknown) => error instanceof Error && 'statusCode' in error && error.statusCode === statusCode && !error.message.includes('PRIVATE'));
    assert.equal(requests, 1);
  }
});
test('HTTP separates read and write methods, denies missing identity, and disables caching', async () => {
  for (const [method, token, query, body, expected] of [
    ['GET', undefined, {}, undefined, 401], ['DELETE', 'fixture', {}, undefined, 405],
    ['GET', 'fixture', { collection: 'receive' }, undefined, 400],
    ['POST', 'fixture', {}, { action: 'products', input: {} }, 400],
    ['POST', 'fixture', {}, '{bad', 400],
  ] as const) {
    let status = 0; const headers: Record<string, string> = {};
    const response = { setHeader(k: string, v: string) { headers[k] = v; }, status(n: number) { status = n; return this; }, json() {} };
    await dispensaryCommerceHandler({ method, headers: { 'privy-id-token': token }, query, body }, response, env, verifier);
    assert.equal(status, expected); assert.equal(headers['Cache-Control'], 'no-store, private');
  }
});
