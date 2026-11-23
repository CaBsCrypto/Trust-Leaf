import assert from 'node:assert/strict';
import { CANNABIS_WAITLIST_MAX_BODY_BYTES, cannabisWaitlistHandler, registerCannabisWaitlist } from '../api/_lib/cannabis-waitlist.ts';

const email = 'sandbox@example.test';
const goodRequest = {
  method: 'POST',
  headers: { origin: 'https://cannabis.trustleaf.org', 'content-type': 'application/json; charset=utf-8' },
  body: { audience: 'patient', email: '  Sandbox@Example.Test  ' },
};
const env = {
  TRUSTLEAF_CANNABIS_WAITLIST_ENABLED: 'true',
  SUPABASE_URL: 'https://project.example.test',
  SUPABASE_SECRET_KEY: 'test-service-key',
};
const calls: unknown[] = [];
const rpc: typeof fetch = async (resource, config) => {
  assert.equal(String(resource), `${env.SUPABASE_URL}/rest/v1/rpc/trustleaf_cannabis_waitlist_signup`);
  assert.equal(config?.method, 'POST');
  assert.equal(new Headers(config?.headers).get('apikey'), env.SUPABASE_SECRET_KEY);
  assert.equal(config?.redirect, 'error');
  calls.push(JSON.parse(String(config?.body)));
  return Response.json({ registered: true });
};

async function request(options: Partial<Parameters<typeof cannabisWaitlistHandler>[0]> = {},
  config: Parameters<typeof cannabisWaitlistHandler>[2] = env, fetcher = rpc) {
  const result: { status?: number; body?: { registered: boolean }; headers: Headers } = { headers: new Headers() };
  await cannabisWaitlistHandler({ ...goodRequest, ...options }, {
    setHeader(name, value) { result.headers.set(name, value); },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; },
  }, config, fetcher);
  assert.equal(result.headers.get('cache-control'), 'no-store, private');
  return result;
}

const first = await request();
const repeat = await request();
const doctor = await request({ body: JSON.stringify({ audience: 'doctor', email }) });
const dispensary = await request({ body: JSON.stringify({ audience: 'dispensary', email }) });
for (const result of [first, repeat, doctor, dispensary]) {
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { registered: true });
}
assert.deepEqual(calls, [
  { p_audience: 'patient', p_email: email },
  { p_audience: 'patient', p_email: email },
  { p_audience: 'doctor', p_email: email },
  { p_audience: 'dispensary', p_email: email },
]);

for (const [options, config, expected] of [
  [{ method: 'GET' }, env, 405],
  [{ headers: { ...goodRequest.headers, origin: 'https://trustleaf.org' } }, env, 403],
  [{ headers: {} }, env, 403],
  [{}, {}, 503],
  [{ headers: { ...goodRequest.headers, 'content-type': 'text/plain' } }, env, 415],
  [{ headers: { ...goodRequest.headers, 'content-length': String(CANNABIS_WAITLIST_MAX_BODY_BYTES + 1) } }, env, 413],
  [{ body: { audience: 'other', email } }, env, 400],
  [{ body: { audience: 'patient', email: 'invalid' } }, env, 400],
  [{ body: { audience: 'patient', email, notes: 'unexpected field' } }, env, 400],
  [{ body: '{' }, env, 400],
  [{ body: ' '.repeat(CANNABIS_WAITLIST_MAX_BODY_BYTES) + '{}' }, env, 400],
] as const) {
  const result = await request(options, config);
  assert.equal(result.status, expected);
  assert.deepEqual(result.body, { registered: false });
}
assert.equal(calls.length, 4, 'Invalid and disabled requests must not reach storage.');

const unavailable = await request({}, env, async () => Response.json({ detail: email }, { status: 500 }));
assert.equal(unavailable.status, 503);
assert.deepEqual(unavailable.body, { registered: false });
await assert.rejects(registerCannabisWaitlist({ body: goodRequest.body, save: async () => { throw new Error(email); } }),
  { statusCode: 503, message: 'WAITLIST_UNAVAILABLE' });

console.log('cannabis-waitlist: distinct profiles, validation, origin, no-store and private failures passed');
