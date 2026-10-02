import assert from 'node:assert/strict';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { test } from 'node:test';
import { inspect } from 'node:util';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import http2 from 'node:http2';
import dgram from 'node:dgram';

const readinessUrl = new URL('../api/stellar/readiness.ts', import.meta.url).href;
const identityUrl = new URL('../api/_lib/privy-identity.ts', import.meta.url).href;
const fixtureKey = Symbol.for('trustleaf.bootstrap-safe-errors.fixture');
const marker = 'SYNTHETIC_PRIVATE_BOOTSTRAP_ERROR';
const token = 'SYNTHETIC_ID_TOKEN', email = 'bootstrap@example.test';
const subject = 'did:privy:bootstrap-synthetic-reader';
const actorRef = '00000000-0000-4000-8000-000000000001';
const pairs = [
  ['PRIVY_IDENTITY_TOKEN_INVALID', 401], ['PRIVY_IDENTITY_SUBJECT_INVALID', 401],
  ['PRIVY_SERVER_CONFIGURATION_MISSING', 503], ['BOOTSTRAP_CONFIGURATION_MISSING', 503],
  ['SUPABASE_URL_MISSING', 503], ['SUPABASE_URL_INVALID', 503], ['SUPABASE_SERVER_KEY_MISSING', 503],
  ['PRIVY_ADMIN_BOOTSTRAP_UNAVAILABLE', 503], ['PRIVY_ADMIN_BOOTSTRAP_SERVER_KEY_INVALID', 503],
  ['PRIVY_ADMIN_BOOTSTRAP_SCHEMA_UNAVAILABLE', 503], ['PRIVY_ACTOR_BINDING_INVALID', 503],
];
const calls = { verifier: 0, reader: 0, store: 0, sdk: 0, unrelated: 0, network: 0 };
const state = { calls, fixtureFailures: [], config: {}, environment: {}, user: null, readerFails: false, storeFails: false,
  readerError: null, storeError: null, actor: null,
  reader: { users() { return { async get(input) {
    calls.reader++;
    try { assert.deepEqual(input, { id_token: token }); }
    catch (error) { state.fixtureFailures.push(error); throw error; }
    if (state.readerFails) throw state.readerError;
    return state.user;
  } }; } } };
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const access = `const fixture=globalThis[Symbol.for('trustleaf.bootstrap-safe-errors.fixture')];`;
const forbidden = names => names.map(name => `export function ${name}(){
  globalThis[Symbol.for('trustleaf.bootstrap-safe-errors.fixture')].calls.unrelated++;
  throw new Error('UNRELATED_DEPENDENCY_BLOCKED');}`).join('\n');
const adapters = new Map(Object.entries({
  '../_lib/stellar.js': forbidden(['fundTestnetAccount','getContractsStatus','getDeterministicKeypair','getRuntimeReadiness']),
  '../_lib/pilot-safety.js': forbidden(['assertTestnetMutationEnabled','sendPilotSafetyError']),
  '../_lib/privy-identity.js': `import {createPrivyIdentityVerifier as real} from ${JSON.stringify(identityUrl)};
    ${access} export function createPrivyIdentityVerifier(){fixture.calls.verifier++;return real(fixture.config,fixture.reader);}`,
  '../_lib/privy-supabase-rbac.js': `${access}
    export function createSupabasePrivyActorStore(){return {async bootstrapFirstAdmin(subject){
      fixture.calls.store++; if(subject!==${JSON.stringify(subject)}){fixture.fixtureFailures.push('UNEXPECTED_SUBJECT');throw new Error('UNEXPECTED_SUBJECT');}
      if(fixture.storeFails)throw fixture.storeError;return fixture.actor;}};}
    ${forbidden(['createPrivyRbacAuthorizer'])}`,
  '../_lib/privy-actor-directory.js': forbidden(['readActorDirectory']),
  '../_lib/privy-agenda.js': forbidden(['executePrivyAgenda']),
  '../_lib/google-calendar-handler.js': forbidden(['googleCalendarHandler']),
}).map(([key, value]) => [key, moduleUrl(value)]));
const sdk = moduleUrl(`${access} export class PrivyClient{constructor(){fixture.calls.sdk++;throw new Error('SDK_BLOCKED');}}`);
const allowed = new Set([readinessUrl, identityUrl, sdk, ...adapters.values()]);
const restore = [], observations = [];
const originalEnvironment = process.env;
let hook;
function replace(target, key, value) {
  const previous = target[key]; target[key] = value; restore.push(() => { target[key] = previous; });
}
function block() { calls.network++; throw new Error('EXTERNAL_NETWORK_BLOCKED'); }
function reset() {
  state.config = { PRIVY_APP_ID: 'SYNTHETIC_APP', PRIVY_APP_SECRET: 'SYNTHETIC_APP_SECRET' };
  state.environment = { TRUSTLEAF_BOOTSTRAP_ADMIN_EMAIL: email };
  state.user = { id: subject, linked_accounts: [{ type: 'email', address: email }] };
  state.actor = { actorRef, role: 'admin', state: 'active', extra: marker };
  state.readerFails = false; state.storeFails = false;
}

try {
  globalThis[fixtureKey] = state;
  replace(globalThis, 'fetch', block);
  if ('WebSocket' in globalThis) replace(globalThis, 'WebSocket', block);
  for (const transport of [http, https]) { replace(transport, 'request', block); replace(transport, 'get', block); }
  replace(net, 'connect', block); replace(net, 'createConnection', block); replace(net.Socket.prototype, 'connect', block);
  replace(tls, 'connect', block); replace(http2, 'connect', block); replace(dgram, 'createSocket', block);
  syncBuiltinESMExports();
  // No inherited configuration is read; only synthetic values are supplied.
  process.env = new Proxy(Object.create(null), { get(_target, key) { return state.environment[key]; } });
  hook = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL === readinessUrl && adapters.has(specifier)) return { url: adapters.get(specifier), shortCircuit: true };
      if (context.parentURL === identityUrl && specifier === '@privy-io/node') return { url: sdk, shortCircuit: true };
      if (allowed.has(specifier) || (context.parentURL === readinessUrl && specifier === 'node:crypto')) return next(specifier, context);
      throw new Error('UNADAPTED_IMPORT_BLOCKED');
    },
    load(url, context, next) {
      if (allowed.has(url) || url === 'node:crypto') return next(url, context);
      throw new Error('UNEXPECTED_SOURCE_BLOCKED');
    },
  });
  const { default: handler } = await import(readinessUrl);
  async function observe(name, expected, options = {}) {
    const logs = [], headers = {}, diagnosticWrites = [];
    const previous = new Map(), before = { ...calls };
    let status, body, escaped;
    for (const method of ['debug','info','log','warn','error']) {
      previous.set(method, console[method]); console[method] = (...args) => { logs.push(args); };
    }
    const stdout = process.stdout.write, stderr = process.stderr.write;
    function capture(chunk, ...args) { diagnosticWrites.push(String(chunk)); args.find(value => typeof value === 'function')?.(); return true; }
    process.stdout.write = capture; process.stderr.write = capture;
    try {
      await handler({ method: options.method ?? 'POST', query: { __trustleaf_route: 'privy-bootstrap-admin' },
        headers: options.headers ?? { 'privy-id-token': token } }, {
        setHeader(key, value) { headers[key] = value; },
        status(value) { status = value; return { json(value) { body = value; return value; } }; },
      });
    } catch (error) { escaped = error; }
    finally {
      for (const [method, previousMethod] of previous) console[method] = previousMethod;
      process.stdout.write = stdout; process.stderr.write = stderr;
    }
    observations.push({ name, expected, status, body, headers, logs, diagnosticWrites,
      escaped: Boolean(escaped), calls: Object.fromEntries(Object.keys(calls).map(key => [key, calls[key] - before[key]])) });
  }
  for (const [code, status] of pairs) {
    reset(); state.readerFails = true; state.readerError = { code, statusCode: status, message: marker, stack: marker };
    await observe(`exact bounded pair ${code}`, { code, status, verifier: 1, reader: 1, store: 0, logged: true });
  }
  for (const code of [marker, { private: marker }, [marker], '__proto__', 'constructor', 'PRIVY_IDENTITY_TOKEN_INVALID_SUFFIX', '', `${marker}\n${'x'.repeat(1000)}`]) {
    reset(); state.readerFails = true; state.readerError = { code, statusCode: 503, message: marker };
    await observe('unknown code never escapes', { code: 'BOOTSTRAP_UNAVAILABLE', status: 503, verifier: 1, reader: 1, store: 0, logged: true });
  }
  for (const statusCode of [503, 400, 404, '401', null, {}, [401], NaN, Infinity]) {
    reset(); state.readerFails = true; state.readerError = { code: 'PRIVY_IDENTITY_TOKEN_INVALID', statusCode };
    await observe('mismatched status never escapes', { code: 'BOOTSTRAP_UNAVAILABLE', status: 503, verifier: 1, reader: 1, store: 0, logged: true });
  }
  for (const error of [null, undefined, marker, 77, true, new Error(marker)]) {
    reset(); state.storeFails = true; state.storeError = error;
    await observe('primitive or unclassified store rejection', { code: 'BOOTSTRAP_UNAVAILABLE', status: 503, verifier: 1, reader: 1, store: 1, logged: true });
  }
  reset(); state.readerFails = true; state.readerError = new Error(marker);
  await observe('real verifier retains token-invalid classification', { code: 'PRIVY_IDENTITY_TOKEN_INVALID', status: 401, verifier: 1, reader: 1, store: 0, logged: true });
  for (const method of ['GET','PUT','DELETE','PATCH','OPTIONS']) {
    reset(); await observe('method denial before identity', { code: 'METHOD_NOT_ALLOWED', status: 405, verifier: 0, reader: 0, store: 0 }, { method });
  }
  for (const value of [undefined, '', ' ', [token], token.repeat(1000)]) {
    reset(); await observe('missing or malformed token before verifier', { code: 'AUTH_REQUIRED', status: 401, verifier: 0, reader: 0, store: 0 }, { headers: { 'privy-id-token': value } });
  }
  reset(); state.user.id = marker;
  await observe('real verifier rejects malformed subject', { code: 'PRIVY_IDENTITY_SUBJECT_INVALID', status: 401, verifier: 1, reader: 1, store: 0, logged: true });
  reset(); state.user.linked_accounts = [{ address: 'other@example.test' }];
  await observe('different email denied before store', { code: 'BOOTSTRAP_NOT_ALLOWED', status: 403, verifier: 1, reader: 1, store: 0 });
  for (const value of [undefined, '', marker]) {
    reset(); state.environment.TRUSTLEAF_BOOTSTRAP_ADMIN_EMAIL = value;
    await observe('missing or malformed bootstrap configuration', { code: 'BOOTSTRAP_CONFIGURATION_MISSING', status: 503, verifier: 1, reader: 1, store: 0, logged: true });
  }
  reset(); state.config = {};
  await observe('real verifier requires server configuration', { code: 'PRIVY_SERVER_CONFIGURATION_MISSING', status: 503, verifier: 1, reader: 0, store: 0, logged: true });
  for (const actor of [{ role: 'patient', state: 'active' }, { role: 'admin', state: 'suspended' }]) {
    reset(); state.actor = actor;
    await observe('invalid returned actor denied', { code: 'BOOTSTRAP_INVALID_RESULT', status: 503, verifier: 1, reader: 1, store: 1 });
  }
  reset(); state.environment.TRUSTLEAF_BOOTSTRAP_ADMIN_EMAIL = ` ${email.toUpperCase()} `;
  await observe('minimal success retains normalization and no extra fields', { status: 200, verifier: 1, reader: 1, store: 1 });
} finally {
  hook?.deregister(); process.env = originalEnvironment;
  for (const undo of restore.reverse()) undo(); syncBuiltinESMExports(); delete globalThis[fixtureKey];
}

for (const [index, result] of observations.entries()) test(`${index + 1}: ${result.name}`, () => {
  assert.equal(state.fixtureFailures.length, 0, 'catch boundaries must not hide fixture assertion failures');
  const expected = result.expected;
  assert.equal(result.escaped, false, 'handler must handle arbitrary rejection shapes');
  assert.equal(result.status, expected.status);
  assert.deepEqual(result.body, expected.status === 200 ? { authorized: true, role: 'admin', actorRef } : { code: expected.code });
  assert.deepEqual(result.headers, expected.status === 405 ? {} : { 'Cache-Control': 'no-store' });
  assert.deepEqual(result.logs, expected.logged ? [['Privy admin bootstrap denied.', { code: expected.code, statusCode: expected.status }]] : []);
  assert.deepEqual(result.calls, { verifier: expected.verifier, reader: expected.reader, store: expected.store, sdk: 0, unrelated: 0, network: 0 });
  const serialized = inspect(result, { depth: null, maxArrayLength: null, maxStringLength: null });
  for (const privateValue of [marker, token, email, subject, 'SYNTHETIC_APP_SECRET']) assert.equal(serialized.includes(privateValue), false);
});
