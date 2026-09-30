import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import ts from 'typescript';

const patientPath = '/api/stellar/patient/:address/dashboard';
const validationPath = '/api/stellar/dispensary/validate-prescription';
const disabled = { code: 'LEGACY_PRIVATE_ROUTE_DISABLED' };
const methodDenied = { code: 'METHOD_NOT_ALLOWED' };
const calls = { stellar: 0, fetch: 0, downstream: 0 };
globalThis.__legacyPrivateRouteCalls = calls;
const stellarFixture = `
  const call = () => { globalThis.__legacyPrivateRouteCalls.stellar++; return { synthetic: true, privateData: 'fixture-only' }; };
  export const getPatientDashboard = call;
  export const validatePrescriptionForDispensary = call;
  export const dispensePrescriptionForPatient = call;
  export const releasePrescriptionToPatient = call;
  export const retainPrescriptionForDispensary = call;
`;
const stellarModule = new URL('../api/_lib/stellar.js', import.meta.url).href;
const baseline = process.argv.includes('--baseline');
assert.ok(process.argv.slice(2).every(arg => arg === '--baseline'), 'Only --baseline is supported');
const baselineHandlers = baseline ? new Map([
  ['api/stellar/patient/[address]/dashboard.ts', new URL('../api/stellar/patient/[address]/dashboard.ts', import.meta.url).href],
  ['api/stellar/dispensary/[action].ts', new URL('../api/stellar/dispensary/[action].ts', import.meta.url).href],
].map(([path, url]) => [fileURLToPath(url), execFileSync('git', ['show', `637e17c:${path}`], {
  cwd: new URL('../', import.meta.url), encoding: 'utf8',
})])) : new Map();
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/api/') && specifier.startsWith('.') && new URL(specifier, context.parentURL).href === stellarModule) {
      return { url: `data:text/javascript,${encodeURIComponent(stellarFixture)}`, shortCircuit: true };
    }
    if (context.parentURL?.includes('/api/') && specifier.startsWith('.') && specifier.endsWith('.js')) {
      return next(specifier.replace(/\.js$/, '.ts'), context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    const path = url.startsWith('file:') ? fileURLToPath(url) : null;
    if (baselineHandlers.has(path)) return { format: 'module-typescript', source: baselineHandlers.get(path), shortCircuit: true };
    return next(url, context);
  },
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { calls.fetch++; throw new Error('External fetch forbidden in synthetic retirement test'); };

function response() {
  const output = { headers: {} };
  const res = {
    setHeader(name, value) { output.headers[name.toLowerCase()] = value; },
    status(code) { output.status = code; return this; },
    json(body) { output.body = body; return this; },
  };
  return { res, output };
}
function expectResponse(output, status) {
  assert.equal(output.status, status);
  assert.deepEqual(output.body, status === 410 ? disabled : methodDenied);
  assert.equal(output.headers['cache-control'], 'no-store, private');
}
function poisoned(label) {
  return new Proxy({}, { get() { throw new Error(`Retired route read ${label}`); } });
}

const envKeys = ['NODE_ENV', 'TRUSTLEAF_ALLOW_TESTNET_MUTATIONS', 'TRUSTLEAF_TESTNET_SUBMIT_ENABLED',
  'TRUSTLEAF_OPERATIONS_PILOT_ENABLED', 'TRUSTLEAF_PILOT_RUNTIME', 'TRUSTLEAF_AUTH_JWKS_URL'];
const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const environments = [
  { name: 'flags-off', NODE_ENV: 'test', TRUSTLEAF_ALLOW_TESTNET_MUTATIONS: 'false', TRUSTLEAF_TESTNET_SUBMIT_ENABLED: 'false', TRUSTLEAF_OPERATIONS_PILOT_ENABLED: 'false', TRUSTLEAF_PILOT_RUNTIME: 'local-synthetic' },
  { name: 'flags-on', NODE_ENV: 'test', TRUSTLEAF_ALLOW_TESTNET_MUTATIONS: 'true', TRUSTLEAF_TESTNET_SUBMIT_ENABLED: 'true', TRUSTLEAF_OPERATIONS_PILOT_ENABLED: 'true', TRUSTLEAF_PILOT_RUNTIME: 'local-synthetic' },
  { name: 'production', NODE_ENV: 'production', TRUSTLEAF_ALLOW_TESTNET_MUTATIONS: 'true', TRUSTLEAF_TESTNET_SUBMIT_ENABLED: 'true', TRUSTLEAF_OPERATIONS_PILOT_ENABLED: 'true', TRUSTLEAF_PILOT_RUNTIME: 'local-synthetic' },
];
const identities = [
  {},
  { authorization: 'Bearer invalid-synthetic-token' },
  { authorization: 'Bearer expired-synthetic-token' },
  { authorization: 'Bearer synthetic-valid-token', 'privy-id-token': 'synthetic-valid-token' },
  ...['patient', 'doctor', 'dispensary', 'admin'].map(role => ({ 'x-trustleaf-role': role, 'privy-id-token': 'synthetic-valid-token' })),
];
const identifiers = ['G' + 'A'.repeat(55), 'G' + 'B'.repeat(55), '%ZZ?address=foreign'];
let server;
let vercelCases = 0, expressCases = 0;
try {
  const { default: patient } = await import('../api/stellar/patient/[address]/dashboard.ts');
  const { default: dispensary } = await import('../api/stellar/dispensary/[action].ts');
  if (baseline) {
    for (const env of environments) {
      for (const key of envKeys) {
        if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
      }
      for (const [handler, method, query] of [[patient, 'GET', { address: identifiers[0] }],
        [dispensary, 'POST', { action: 'validate-prescription' }]]) {
        const actual = response();
        await handler({ method, query, headers: {}, body: { prescriptionId: 1 } }, actual.res);
        assert.equal(actual.output.status, 200);
        assert.deepEqual(actual.output.body, { synthetic: true, privateData: 'fixture-only' });
        assert.equal(actual.output.headers['cache-control'], undefined);
      }
    }
    assert.equal(calls.stellar, 6);
    assert.equal(calls.fetch, 0);
    console.log('legacy-private-route-block baseline: 6 anonymous 200 responses at 637e17c, fixture-only; no production data or external network');
  } else {
  for (const env of environments) {
    for (const key of envKeys) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
    process.env.TRUSTLEAF_AUTH_JWKS_URL = 'https://auth.example.invalid/jwks';
    for (const headers of identities) for (const identifier of identifiers) {
      for (const [handler, method, query, body] of [
        [patient, 'GET', { address: identifier, __trustleaf_route: 'operations-pilot' }, {}],
        [dispensary, 'POST', { action: 'validate-prescription', __trustleaf_route: 'privy-agenda' }, { prescriptionId: identifier, patientId: identifier }],
      ]) {
        const { res, output } = response();
        await handler({ method, query, body, headers }, res);
        expectResponse(output, 410);
        vercelCases++;
      }
    }
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      const { res, output } = response();
      await patient({ method, headers: poisoned('headers'), query: poisoned('query'), body: poisoned('body') }, res);
      expectResponse(output, 405);
      vercelCases++;
    }
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      const { res, output } = response();
      await dispensary({ method, headers: poisoned('headers'), query: { action: 'validate-prescription' }, body: poisoned('body') }, res);
      expectResponse(output, 405);
      vercelCases++;
    }
    const p = response();
    await patient({ method: 'GET', headers: poisoned('headers'), query: poisoned('address'), body: poisoned('body') }, p.res);
    expectResponse(p.output, 410);
    const d = response();
    await dispensary({ method: 'POST', query: { action: 'validate-prescription' }, headers: poisoned('headers'), body: poisoned('identifier') }, d.res);
    expectResponse(d.output, 410);
    vercelCases += 2;
    for (const action of [['validate-prescription'], ['validate-prescription', 'dispense-prescription'], undefined, 'unknown-action']) {
      const actual = response();
      await dispensary({ method: 'POST', query: { action }, headers: {}, body: {} }, actual.res);
      assert.ok([404, 500, 503].includes(actual.output.status), 'Malformed or unrelated dispatch must not recover private data');
      vercelCases++;
    }
  }
  assert.equal(calls.stellar, 0, 'Actual serverless exports must not call the Stellar adapter');
  assert.equal(calls.fetch, 0, 'Retired routes must not call JWKS or another external service');

  // Execute the actual early route registrations, not a second hand-written router.
  // Avoid starting the full dev server or importing dotenv/real service bootstrap.
  const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('server.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const bootstrap = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'startServer');
  assert.ok(bootstrap?.body, 'Express bootstrap must exist');
  const statements = [...bootstrap.body.statements];
  const registrations = statements.filter(node => ts.isExpressionStatement(node)
    && ts.isCallExpression(node.expression) && node.expression.expression.getText(ast) === 'app.all'
    && ts.isStringLiteral(node.expression.arguments[0])
    && [patientPath, validationPath].includes(node.expression.arguments[0].text));
  assert.equal(registrations.length, 2, 'Both retired routes must have one early all-method registration');
  const parserIndex = statements.findIndex(node => node.getText(ast) === 'app.use(express.json());');
  const authIndex = statements.findIndex(node => node.getText(ast).includes('app.use(createLegacyAuthorizationMiddleware('));
  assert.ok(parserIndex >= 0 && authIndex >= 0);
  assert.ok(registrations.every(node => statements.indexOf(node) < parserIndex && statements.indexOf(node) < authIndex),
    'Retirement must precede body parsing and legacy authorization');
  const firstRegistration = Math.min(...registrations.map(node => statements.indexOf(node)));
  assert.ok(!statements.slice(0, firstRegistration).some(node => ts.isExpressionStatement(node)
    && ts.isCallExpression(node.expression) && /^app\./.test(node.expression.expression.getText(ast))),
  'No earlier Express registration may shadow the retirement boundary');
  const blockerImports = ast.statements.filter(node => ts.isImportDeclaration(node)
    && /legacy-private-route-block/.test(node.moduleSpecifier.text));
  assert.equal(blockerImports.length, 1, 'One shared blocker must serve Express and Vercel');
  const imported = await import(new URL(`../${blockerImports[0].moduleSpecifier.text.replace(/^\.\//, '')}.ts`, import.meta.url));
  const bindings = [...blockerImports[0].importClause.namedBindings.elements];
  const app = express();
  const registrationCode = ts.transpileModule(registrations.map(node => node.getText(ast)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  new Function('app', ...bindings.map(node => node.name.text), registrationCode)(app,
    ...bindings.map(node => imported[node.propertyName?.text ?? node.name.text]));
  app.use((req, res) => { calls.downstream++; res.status(418).json({ synthetic: 'downstream' }); });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const port = server.address().port;
  function http(method, path, headers = {}, body = '') {
    return new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, method, path, headers }, res => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { text += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }));
      });
      req.on('error', reject);
      req.end(body);
    });
  }
  for (const env of environments) {
    for (const key of envKeys) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
    for (const headers of identities) for (const identifier of identifiers) {
      const address = encodeURIComponent(identifier);
      for (const path of [`/api/stellar/patient/${address}/dashboard`, `/API/STELLAR/PATIENT/${address}/DASHBOARD/?address=foreign`]) {
        expectResponse(await http('GET', path, headers), 410);
        expressCases++;
      }
      for (const path of [validationPath, `${validationPath}/?prescriptionId=foreign`]) {
        expectResponse(await http('POST', path, { ...headers, 'content-type': 'application/json' }, '{invalid-json'), 410);
        expressCases++;
      }
    }
    for (const [path, allowed] of [[`/api/stellar/patient/${'G' + 'A'.repeat(55)}/dashboard`, 'GET'], [validationPath, 'POST']]) {
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].filter(candidate => candidate !== allowed)) {
        const actual = await http(method, path);
        assert.equal(actual.status, 405);
        assert.equal(actual.headers['cache-control'], 'no-store, private');
        assert.deepEqual(actual.body, method === 'HEAD' ? null : methodDenied);
        expressCases++;
      }
    }
  }
  assert.equal(calls.downstream, 0, 'Retired Express routes must never reach parsing, auth or handlers');
  expectResponse(await http('POST', validationPath, { 'content-type': 'application/json' }, 'x'.repeat(200000)), 410);
  expressCases++;
  // Unrelated route families still pass through this narrow boundary.
  for (const path of ['/api/agenda', '/api/operations-pilot', '/api/dispensary-commerce', '/api/dispensary-onboarding',
    '/api/stellar/readiness', '/api/stellar/contracts', '/api/stellar/prescription/1/verify']) {
    assert.equal((await http('GET', path)).status, 418);
  }
  assert.equal(calls.stellar, 0);
  assert.equal(calls.fetch, 0);
  console.log(`legacy-private-route-block: ${vercelCases} actual export cases, ${expressCases} Express HTTP cases; zero Stellar/fetch calls; synthetic only`);
  }
} finally {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  globalThis.fetch = originalFetch;
  delete globalThis.__legacyPrivateRouteCalls;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
