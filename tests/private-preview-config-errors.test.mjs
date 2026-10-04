import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

let outbound = 0, stellar = 0;
globalThis.__previewStellarCall = () => { stellar++; throw new Error('SYNTHETIC_STELLAR_FORBIDDEN'); };
const stellarModule = new URL('../api/_lib/stellar.js', import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/api/') && specifier.startsWith('.')) {
      if (new URL(specifier, context.parentURL).href === stellarModule) return {
        url: 'data:text/javascript,' + encodeURIComponent(`
          export const fundTestnetAccount = globalThis.__previewStellarCall;
          export const getContractsStatus = globalThis.__previewStellarCall;
          export const getDeterministicKeypair = globalThis.__previewStellarCall;
          export const getRuntimeReadiness = globalThis.__previewStellarCall;
        `), shortCircuit: true,
      };
      if (specifier.endsWith('.js')) return next(specifier.replace(/\.js$/, '.ts'), context);
    }
    return next(specifier, context);
  },
});
const savedFetch = globalThis.fetch;
globalThis.fetch = async () => { outbound++; throw new Error('SYNTHETIC_NETWORK_FORBIDDEN'); };
const keys = ['PRIVY_APP_ID', 'PRIVY_APP_SECRET', 'TRUSTLEAF_OPERATIONS_PILOT_ENABLED',
  'TRUSTLEAF_COMMERCE_CATALOG_ENABLED', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
delete process.env.PRIVY_APP_ID; delete process.env.PRIVY_APP_SECRET;
process.env.TRUSTLEAF_OPERATIONS_PILOT_ENABLED = 'true';
process.env.TRUSTLEAF_COMMERCE_CATALOG_ENABLED = 'true';
process.env.SUPABASE_URL = 'https://fixture.invalid';
process.env.SUPABASE_SECRET_KEY = 'synthetic-only';
const { default: handler } = await import('../api/stellar/readiness.ts');

function response() {
  const output = { headers: {} };
  const res = { setHeader(name, value) { output.headers[name.toLowerCase()] = value; },
    status(status) { output.status = status; return this; },
    json(body) { output.body = body; return this; } };
  return { res, output };
}

try {
  for (const route of ['operations-pilot', 'dispensary-commerce']) {
    for (const scenario of [
      { name: 'anonymous', method: 'GET', headers: {}, expected: 401, code: 'AUTH_REQUIRED' },
      { name: 'wrong method', method: 'DELETE', headers: {}, expected: 405, code: 'METHOD_NOT_ALLOWED' },
      { name: 'blank token', method: 'GET', headers: { 'privy-id-token': ' ' }, expected: 401, code: 'AUTH_REQUIRED' },
      { name: 'missing server configuration', method: 'GET', headers: { 'privy-id-token': 'synthetic-token' },
        expected: 503, code: route === 'operations-pilot' ? 'PILOT_UNAVAILABLE' : 'COMMERCE_UNAVAILABLE' },
      { name: 'invalid JSON', method: 'POST', headers: { 'privy-id-token': 'synthetic-token' },
        body: '{SYNTHETIC_PRIVATE_BODY', expected: 400, code: route === 'operations-pilot' ? 'PILOT_UNAVAILABLE' : 'COMMERCE_UNAVAILABLE' },
    ]) {
      await test(`${route}: ${scenario.name} is bounded with no configured provider`, async () => {
        const { res, output } = response();
        await handler({ method: scenario.method, headers: scenario.headers, body: scenario.body,
          query: { __trustleaf_route: route, collection: 'products' } }, res);
        assert.equal(output.status, scenario.expected);
        assert.deepEqual(output.body, { code: scenario.code });
        assert.equal(output.headers['cache-control'], 'no-store, private');
        assert.equal(output.headers.vary, 'privy-id-token');
        assert.equal(JSON.stringify(output).includes('SYNTHETIC_PRIVATE_BODY'), false);
        assert.equal(outbound, 0);
        assert.equal(stellar, 0);
      });
    }
    await test(`${route}: disabled capability stays disabled without configured Privy`, async () => {
      process.env.TRUSTLEAF_OPERATIONS_PILOT_ENABLED = 'false';
      try {
        const { res, output } = response();
        await handler({ method: 'GET', headers: { 'privy-id-token': 'synthetic-token' },
          query: { __trustleaf_route: route, collection: 'products' } }, res);
        assert.equal(output.status, 503);
        assert.deepEqual(output.body, { code: route === 'operations-pilot' ? 'PILOT_DISABLED' : 'COMMERCE_DISABLED' });
        assert.equal(output.headers['cache-control'], 'no-store, private');
        assert.equal(outbound, 0); assert.equal(stellar, 0);
      } finally { process.env.TRUSTLEAF_OPERATIONS_PILOT_ENABLED = 'true'; }
    });
  }
} finally {
  for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  globalThis.fetch = savedFetch;
  delete globalThis.__previewStellarCall;
}
