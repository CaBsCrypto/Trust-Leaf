import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const hooks = registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.endsWith('/operations-pilot.ts') && specifier.endsWith('.js') ? specifier.slice(0, -3) + '.ts' : specifier, context);
} });
const { executeOperationsPilot, operationsPilotHandler } = await import('../api/_lib/operations-pilot.ts');
hooks.deregister();
const { gramsToMg, currentPeriod } = await import('../src/features/operations/contracts.ts');
const env = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'synthetic-only', TRUSTLEAF_OPERATIONS_PILOT_ENABLED: 'true' };
const subject = 'did:privy:operations-fixture';
const verifier = { async verify() { return { subject, emails: [] }; } };
const binding = (state = 'active') => [{ actor_ref: '11111111-1111-4111-8111-111111111111', role: 'doctor', actor_state: state }];
test('pilot disabled by default and no request is sent', async () => {
  await assert.rejects(executeOperationsPilot({ token: 'fixture', command: { action: 'snapshot', input: {} }, env: {}, verifier,
    fetcher: async () => { throw new Error('must not fetch'); } }), { code: 'PILOT_DISABLED' });
});
test('subject comes from verified identity and SQL receives only a bounded action envelope', async () => {
  let calls = 0;
  await executeOperationsPilot({ token: 'fixture', command: { action: 'start-encounter', input: { subject: 'forged' } }, env, verifier,
    fetcher: async (url, init) => { calls++; if (String(url).includes('resolve_privy')) return Response.json(binding());
      assert.equal(JSON.parse(String(init?.body)).p_subject, subject); return Response.json({ synthetic: true }); } });
  assert.equal(calls, 2);
});
test('pending identity cannot reach the pilot RPC', async () => {
  let calls = 0;
  await assert.rejects(executeOperationsPilot({ token: 'fixture', command: { action: 'snapshot', input: {} }, env, verifier,
    fetcher: async () => { calls++; return Response.json(binding('pending')); } }));
  assert.equal(calls, 1);
});
test('errors never expose SQL detail or retry uncertain writes', async () => {
  for (const [code, statusCode] of [['42501', 403], ['40001', 409], ['23505', 409], ['23514', 400], ['23502', 400], ['XX000', 503]] as const) {
    let mutations = 0;
    await assert.rejects(executeOperationsPilot({ token: 'fixture', command: { action: 'dispense', input: {} }, env, verifier,
      fetcher: async url => { if (String(url).includes('resolve_privy')) return Response.json(binding()); mutations++;
        return Response.json({ code, message: 'PRIVATE clinical note and database internals' }, { status: 400 }); } }),
      (e: any) => e.statusCode === statusCode && !e.message.includes('PRIVATE'));
    assert.equal(mutations, 1);
  }
});
test('HTTP handler has no-store, authentication and safe method boundaries', async () => {
  for (const [method, token, body, expected] of [['GET', undefined, undefined, 401], ['DELETE', 'fixture', undefined, 405], ['POST', 'fixture', '{bad', 400], ['POST', 'fixture', { action: 'snapshot' }, 400]] as const) {
    const headers: Record<string, string> = {}; let code = 0;
    const res = { setHeader(k: string, v: string) { headers[k] = v; }, status(n: number) { code = n; return this; }, json() { return this; } };
    await operationsPilotHandler({ method, headers: { 'privy-id-token': token }, body }, res, env, verifier);
    assert.equal(code, expected); assert.match(headers['Cache-Control'], /no-store/);
  }
});
test('grams are parsed without floating point quota drift', () => {
  assert.equal(gramsToMg('0.001'), 1); assert.equal(gramsToMg('10,125'), 10125); assert.equal(gramsToMg('-1.005', true), -1005);
  for (const bad of ['0', '-1', '1.0001', 'NaN', '1e3', 'Infinity']) assert.throws(() => gramsToMg(bad));
});
test('period intervals are start-inclusive and end-exclusive; expired treatment closes access', () => {
  const t: any = { state: 'active', prescription_valid_until: '2026-12-01T00:00:00Z', treatment_ends_at: '2026-12-01T00:00:00Z',
    periods: [{ period_index: 1, starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-01T00:00:00Z' }, { period_index: 2, starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-31T00:00:00Z' }] };
  assert.equal(currentPeriod(t, Date.parse('2026-09-01T00:00:00Z'))?.period_index, 1);
  assert.equal(currentPeriod(t, Date.parse('2026-10-01T00:00:00Z'))?.period_index, 2);
  assert.equal(currentPeriod({ ...t, state: 'revoked' }, Date.parse('2026-09-02T00:00:00Z')), undefined);
});
