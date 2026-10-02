// Manual negative reproductions, not a green CI regression. Baseline 86e2016 fails both.
// node --experimental-strip-types tests/repro/privacy-diagnostics.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { inspect } from 'node:util';
import express from 'express';
import { createSupabasePrivyActorStore } from '../../api/_lib/privy-supabase-rbac.ts';

const marker = 'PII_DEMO';

test('manual negative: Express production JSON parser must not log body fragments', { concurrency: false }, async () => {
  const app = express();
  app.set('env', 'production');
  app.use(express.json());
  let handlerReached = false;
  app.post('/api/operations-pilot', (_req, res) => { handlerReached = true; res.json({ ok: true }); });
  const server = http.createServer(app);
  const originalWrite = process.stderr.write;
  let stderr = '';
  process.stderr.write = function(chunk, ...args) {
    stderr += String(chunk);
    args.find(value => typeof value === 'function')?.();
    return true;
  };
  let response;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const body = `{"x":${marker}}`;
    response = await new Promise((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port: server.address().port,
        path: '/api/operations-pilot', method: 'POST', headers: {
          'content-type': 'application/json', 'content-length': Buffer.byteLength(body),
        } }, res => {
        let text = '';
        res.on('data', chunk => { text += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
      });
      request.on('error', reject);
      request.setTimeout(5000, () => request.destroy(new Error('Synthetic loopback timeout')));
      request.end(body);
    });
    // Drain the deferred finalhandler callback without requiring a diagnostic to exist.
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    process.stderr.write = originalWrite;
    await new Promise(resolve => server.close(resolve));
  }
  assert.equal(response.status, 400);
  assert.equal(handlerReached, false);
  assert.equal(response.text.includes(marker), false, 'production response must remain generic');
  assert.equal(stderr.includes(marker), false, 'private JSON body fragment must not reach stderr');
});

test('manual negative: bootstrap must not log arbitrary provider code strings', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch, originalError = console.error;
  const logs = [];
  let calls = 0, error;
  globalThis.fetch = async () => { throw new Error('NETWORK_BLOCKED_BY_MANUAL_REPRODUCTION'); };
  console.error = (...args) => { logs.push(args); };
  try {
    const store = createSupabasePrivyActorStore({ SUPABASE_URL: 'https://synthetic.supabase.test',
      SUPABASE_SECRET_KEY: 'SYNTHETIC_SERVER_KEY' }, async url => {
      assert.equal(String(url), 'https://synthetic.supabase.test/rest/v1/rpc/trustleaf_bootstrap_first_privy_admin');
      calls++;
      return Response.json({ code: marker, message: 'SYNTHETIC_PRIVATE_MESSAGE' }, { status: 500 });
    });
    try { await store.bootstrapFirstAdmin('did:privy:diagnostic-fixture'); }
    catch (caught) { error = caught; }
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
  assert.equal(calls, 1);
  assert.equal(error?.statusCode, 503);
  assert.equal(error?.code, 'PRIVY_ADMIN_BOOTSTRAP_UNAVAILABLE');
  assert.equal(String(error).includes(marker), false, 'client error must remain sanitized');
  assert.equal(inspect(logs, { depth: null, maxArrayLength: null, maxStringLength: null }).includes(marker),
    false, 'private provider code must not reach logs');
});
