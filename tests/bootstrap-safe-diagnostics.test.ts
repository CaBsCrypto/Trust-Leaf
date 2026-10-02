import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { inspect } from 'node:util';
import { createSupabasePrivyActorStore, type PrivyActorStore } from '../api/_lib/privy-supabase-rbac.ts';

const projectUrl = 'https://bootstrap-fixture.supabase.test';
const endpoint = `${projectUrl}/rest/v1/rpc/trustleaf_bootstrap_first_privy_admin`;
const subject = 'did:privy:BOOTSTRAP_SUBJECT_PRIVATE_MARKER';
const actorRef = '11111111-1111-4111-8111-111111111111';
const serverKey = 'SYNTHETIC_SERVER_KEY_PRIVATE_MARKER';
const token = 'SYNTHETIC_PRIVY_TOKEN_PRIVATE_MARKER';
const email = 'bootstrap-private-marker@example.invalid';
const profile = 'BOOTSTRAP_PROFILE_PRIVATE_MARKER';
const providerCode = 'BOOTSTRAP_PROVIDER_CODE_PRIVATE_MARKER';
const providerMessage = 'BOOTSTRAP_PROVIDER_MESSAGE_PRIVATE_MARKER';
const privateMarkers = [subject, serverKey, token, email, profile, providerCode, providerMessage];
const privateText = privateMarkers.join(' ');
const longPrivateText = `${'x'.repeat(20_000)} ${privateText}`;
const inspectOptions = { depth: null, maxArrayLength: null, maxStringLength: null };
const consoleChannels = [
  'log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'dirxml', 'table', 'assert',
  'group', 'groupCollapsed', 'groupEnd', 'count', 'countReset', 'time', 'timeEnd', 'timeLog', 'clear',
  'profile', 'profileEnd', 'timeStamp',
] as const;
const allowedUpstreamCodes = new Set(['42501', 'PGRST202', '42883', 'unknown']);
const unavailable = 'PRIVY_ADMIN_BOOTSTRAP_UNAVAILABLE';
const keyInvalid = 'PRIVY_ADMIN_BOOTSTRAP_SERVER_KEY_INVALID';
const schemaUnavailable = 'PRIVY_ADMIN_BOOTSTRAP_SCHEMA_UNAVAILABLE';

interface LogEntry {
  channel: string;
  args: unknown[];
}

interface FetchCall {
  url: string;
  request: RequestInit | undefined;
}

function assertPrivateMarkersAbsent(value: unknown) {
  const rendered = inspect(value, inspectOptions);
  for (const marker of privateMarkers) {
    assert.equal(rendered.includes(marker), false, 'private fixture marker must not escape through diagnostics');
  }
}

async function withStore(
  t: TestContext,
  respond: () => Promise<Response>,
  check: (store: PrivyActorStore, logs: LogEntry[], calls: FetchCall[]) => Promise<void>,
  keyName: 'SUPABASE_SECRET_KEY' | 'SUPABASE_SERVICE_ROLE_KEY' = 'SUPABASE_SECRET_KEY',
) {
  const logs: LogEntry[] = [];
  const calls: FetchCall[] = [];
  let globalFetchCalls = 0;
  try {
    t.mock.method(globalThis, 'fetch', async () => {
      globalFetchCalls++;
      throw new Error('NETWORK_BLOCKED_BY_BOOTSTRAP_REGRESSION');
    });
    for (const channel of consoleChannels) {
      t.mock.method(console, channel, (...args: unknown[]) => { logs.push({ channel, args }); });
    }
    for (const channel of ['stdout', 'stderr'] as const) {
      t.mock.method(process[channel], 'write', (chunk: string | Uint8Array, ...args: unknown[]) => {
        const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
        logs.push({ channel, args: [text] });
        const callback = args.find((value): value is () => void => typeof value === 'function');
        callback?.();
        return true;
      });
    }
    const store = createSupabasePrivyActorStore({ SUPABASE_URL: projectUrl, [keyName]: serverKey }, async (url, request) => {
      calls.push({ url: String(url), request });
      return respond();
    });
    await check(store, logs, calls);
    assert.equal(globalFetchCalls, 0, 'bootstrap must use only the injected fetcher');
    assertPrivateMarkersAbsent(logs);
  } finally {
    t.mock.restoreAll();
  }
}

function assertSingleBootstrapRequest(calls: FetchCall[]) {
  assert.equal(calls.length, 1, 'bootstrap must not automatically retry');
  assert.equal(calls[0].url, endpoint);
  const request = calls[0].request;
  assert.equal(request?.method, 'POST');
  const headers = new Headers(request?.headers);
  assert.equal(headers.get('apikey'), serverKey);
  assert.equal(headers.get('content-type'), 'application/json');
  assert.equal(headers.get('authorization'), null);
  assert.equal(typeof request?.body, 'string');
  assert.deepEqual(JSON.parse(request!.body as string), { subject });
  assert.ok(request?.signal instanceof AbortSignal);
}

function assertDiagnostics(logs: LogEntry[], httpStatus: number, code: string, upstreamCode?: string) {
  assertPrivateMarkersAbsent(logs);
  const expected: LogEntry[] = [];
  if (upstreamCode !== undefined) {
    assert.ok(allowedUpstreamCodes.has(upstreamCode));
    expected.push({
      channel: 'error',
      args: ['Supabase Privy bootstrap gateway response.', { httpStatus, upstreamCode }],
    });
  }
  expected.push({
    channel: 'error',
    args: ['Privy admin bootstrap rejected by Supabase.', { code, statusCode: 503, httpStatus }],
  });
  assert.deepEqual(logs, expected, 'logs must contain only bounded diagnostic metadata');
}

async function assertDenied(store: PrivyActorStore, code: string, invalidSubject = subject, statusCode = 503) {
  await assert.rejects(store.bootstrapFirstAdmin(invalidSubject), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'Privy authorization denied.');
    assert.equal((error as Error & { code: string }).code, code);
    assert.equal((error as Error & { statusCode: number }).statusCode, statusCode);
    assertPrivateMarkersAbsent(error);
    return true;
  });
}

function privatePayload(code: unknown) {
  return {
    code,
    message: providerMessage,
    details: { token, email, profile: { displayName: profile, subject }, serverKey },
    hint: privateText,
  };
}

const classificationCases = [
  { name: 'exact permission code', status: 500, upstream: '42501', code: keyInvalid },
  { name: 'exact PostgREST schema code', status: 500, upstream: 'PGRST202', code: schemaUnavailable },
  { name: 'exact missing-function code', status: 500, upstream: '42883', code: schemaUnavailable },
  { name: '401 status with untrusted code', status: 401, upstream: providerCode, code: keyInvalid },
  { name: '403 status with untrusted code', status: 403, upstream: providerCode, code: keyInvalid },
  { name: '404 status with untrusted code', status: 404, upstream: providerCode, code: schemaUnavailable },
  { name: '401 takes priority over schema code', status: 401, upstream: 'PGRST202', code: keyInvalid },
  { name: '403 takes priority over schema code', status: 403, upstream: '42883', code: keyInvalid },
  { name: 'permission code takes priority over 404', status: 404, upstream: '42501', code: keyInvalid },
  ...[400, 429, 500, 502, 503].map((status) => ({
    name: `${status} status uses fallback`, status, upstream: providerCode, code: unavailable,
  })),
];

for (const fixture of classificationCases) {
  test(`bootstrap preserves error category: ${fixture.name}`, { concurrency: false }, async (t) => {
    await withStore(t, async () => Response.json(privatePayload(fixture.upstream), { status: fixture.status }), async (store, logs, calls) => {
      await assertDenied(store, fixture.code);
      assertSingleBootstrapRequest(calls);
      const upstreamCode = allowedUpstreamCodes.has(fixture.upstream) ? fixture.upstream : 'unknown';
      assertDiagnostics(logs, fixture.status, fixture.code, upstreamCode);
    });
  });
}

const untrustedCodes: Array<{ name: string; code: unknown }> = [
  { name: 'arbitrary provider code markers in every diagnostic channel', code: privateText },
  { name: 'token marker as code', code: token },
  { name: 'email marker as code', code: email },
  { name: 'profile marker as code', code: profile },
  { name: 'subject marker as code', code: subject },
  { name: 'server-key marker as code', code: serverKey },
  { name: 'permission code with newline', code: `42501\n${privateText}` },
  { name: 'PostgREST code with newline', code: `PGRST202\n${privateText}` },
  { name: 'missing-function code with newline', code: `42883\n${privateText}` },
  { name: 'leading whitespace', code: ' 42501' },
  { name: 'trailing whitespace', code: '42883 ' },
  { name: 'lowercase code', code: 'pgrst202' },
  { name: 'very long code with private suffix', code: `PGRST202${longPrivateText}` },
  { name: 'null code', code: null },
  { name: 'boolean code', code: true },
  { name: 'numeric permission code', code: 42501 },
  { name: 'numeric missing-function code', code: 42883 },
  { name: 'object code', code: { value: '42501', token, email, profile } },
  { name: 'array code', code: ['PGRST202', token, email, profile] },
];

for (const fixture of untrustedCodes) {
  test(`bootstrap hides ${fixture.name}`, { concurrency: false }, async (t) => {
    await withStore(t, async () => Response.json(privatePayload(fixture.code), { status: 500 }), async (store, logs, calls) => {
      await assertDenied(store, unavailable);
      assertSingleBootstrapRequest(calls);
      assertDiagnostics(logs, 500, unavailable, 'unknown');
    });
  });
}

const unexpectedBodies: Array<{ name: string; body: string; status?: number; upstreamCode?: string; code?: string }> = [
  { name: 'invalid JSON', body: `{"code":"${providerCode}","message":${privateText}` },
  { name: 'malformed JSON at 401 preserves fallback', body: `{"code":"42501","message":${privateText}`, status: 401 },
  { name: 'plain text', body: privateText },
  { name: 'long plain text', body: longPrivateText },
  { name: 'null JSON', body: 'null' },
  { name: 'numeric JSON', body: '42501' },
  { name: 'boolean JSON', body: 'true' },
  { name: 'string JSON', body: JSON.stringify(privateText) },
  { name: 'empty object', body: '{}', upstreamCode: 'unknown' },
  { name: 'untrusted code without message', body: JSON.stringify({ code: privateText }), upstreamCode: 'unknown' },
  { name: 'known code without message', body: '{"code":"PGRST202"}', upstreamCode: 'PGRST202', code: schemaUnavailable },
  { name: 'empty array', body: '[]', upstreamCode: 'unknown' },
  { name: 'array of private error objects', body: JSON.stringify([privatePayload('42501')]), upstreamCode: 'unknown' },
  {
    name: 'deep object with long text and long array but no code',
    body: JSON.stringify({ details: { nested: { nested: { nested: { nested: { profile, token, email } } } } },
      message: longPrivateText, hint: [...Array.from({ length: 150 }, () => 'padding'), privatePayload(providerCode)] }),
    upstreamCode: 'unknown',
  },
];

for (const fixture of unexpectedBodies) {
  test(`bootstrap sanitizes non-success body: ${fixture.name}`, { concurrency: false }, async (t) => {
    const status = fixture.status ?? 500;
    await withStore(t, async () => new Response(fixture.body, { status }), async (store, logs, calls) => {
      const code = fixture.code ?? unavailable;
      await assertDenied(store, code);
      assertSingleBootstrapRequest(calls);
      assertDiagnostics(logs, status, code, fixture.upstreamCode);
    });
  });
}

test('bootstrap sanitizes unreadable JSON rejection with private error markers', { concurrency: false }, async (t) => {
  let jsonReads = 0;
  await withStore(t, async () => {
    const response = Response.json(privatePayload('42501'), { status: 500 });
    t.mock.method(response, 'json', async () => {
      jsonReads++;
      throw new Error(privateText);
    });
    return response;
  }, async (store, logs, calls) => {
    await assertDenied(store, unavailable);
    assertSingleBootstrapRequest(calls);
    assert.equal(jsonReads, 1, 'unreadable JSON must not automatically retry');
    assertDiagnostics(logs, 500, unavailable);
  });
});

for (const fixture of [
  { name: 'private transport error', error: new Error(privateText) },
  { name: 'private non-Error transport rejection', error: privatePayload(providerCode) },
]) {
  test(`bootstrap sanitizes ${fixture.name} without retry`, { concurrency: false }, async (t) => {
    await withStore(t, async () => { throw fixture.error; }, async (store, logs, calls) => {
      await assertDenied(store, unavailable);
      assertSingleBootstrapRequest(calls);
      assert.deepEqual(logs, []);
    });
  });
}

for (const keyName of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
  test(`bootstrap returns a valid binding using injected fetch and ${keyName}`, { concurrency: false }, async (t) => {
    const validUntil = '2099-10-01T12:00:00Z';
    await withStore(t, async () => Response.json([{
      actor_ref: actorRef, role: 'admin', actor_state: 'active', valid_until: validUntil,
      subject, email, profile, token,
    }]), async (store, logs, calls) => {
      assert.deepEqual(await store.bootstrapFirstAdmin(subject), { actorRef, role: 'admin', state: 'active', validUntil });
      assertSingleBootstrapRequest(calls);
      assert.deepEqual(logs, []);
    }, keyName);
  });
}

for (const fixture of [
  { name: 'empty subject', value: '' },
  { name: 'email instead of DID', value: email },
  { name: 'short DID', value: 'did:privy:short' },
  { name: 'DID containing whitespace', value: `did:privy:invalid ${profile}` },
  { name: 'DID containing newline', value: `did:privy:invalid\n${profile}` },
  { name: 'overlong DID', value: `did:privy:${'a'.repeat(501)}` },
]) {
  test(`bootstrap rejects ${fixture.name} without querying`, { concurrency: false }, async (t) => {
    await withStore(t, async () => { throw new Error('INVALID_SUBJECT_MUST_NOT_FETCH'); }, async (store, logs, calls) => {
      await assertDenied(store, 'PRIVY_IDENTITY_SUBJECT_INVALID', fixture.value, 401);
      assert.equal(calls.length, 0, 'invalid subjects must not issue a query');
      assert.deepEqual(logs, []);
    });
  });
}
