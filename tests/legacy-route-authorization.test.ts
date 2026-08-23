import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ROLE_SCOPES } from '../api/_lib/admin-readiness.ts';
import { createLegacyAuthorizationMiddleware, createLegacyRouteAuthorizer, resolveLegacyRouteRequirement } from '../api/_lib/legacy-route-authorization.ts';
import type { ServerRole } from '../api/_lib/server-authorization.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const subjects: Record<ServerRole, string> = {
  doctor: 'synthetic-doctor', patient: 'synthetic-patient', dispensary: 'synthetic-dispensary',
  admin: 'synthetic-admin', relayer: 'synthetic-relayer',
};
const env = {
  TRUSTLEAF_AUTH_ISSUER: 'https://synthetic-idp.invalid',
  TRUSTLEAF_AUTH_AUDIENCE: 'trustleaf-phase1',
  TRUSTLEAF_AUTH_JWKS_URL: 'https://synthetic-idp.invalid/jwks',
  TRUSTLEAF_AUTH_SUBJECT_ALLOWLIST_JSON: JSON.stringify(Object.fromEntries(
    Object.entries(subjects).map(([role, subject]) => [subject, [role]]),
  )),
};
const fetcher = async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'phase1-key', alg: 'RS256', use: 'sig' }] }), { status: 200 });
const tokenFor = (role: ServerRole, overrides: Record<string, unknown> = {}) => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'phase1-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: subjects[role], iss: env.TRUSTLEAF_AUTH_ISSUER, aud: env.TRUSTLEAF_AUTH_AUDIENCE,
    exp: 2_000, roles: [role], scopes: ROLE_SCOPES[role], ...overrides,
  })).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
};
const authorize = createLegacyRouteAuthorizer(env, { fetcher: fetcher as typeof fetch, now: () => 1_000 });
const headersFor = (role: ServerRole) => ({ authorization: `Bearer ${tokenFor(role)}` });

const positives: Array<[string, string, ServerRole]> = [
  ['POST', '/api/stellar/doctor/issue-prescription', 'doctor'],
  ['GET', '/api/stellar/patient/G-SYNTHETIC/dashboard', 'patient'],
  ['GET', '/api/stellar/patient/G-SYNTHETIC/dashboard', 'doctor'],
  ['POST', '/api/stellar/dispensary/dispense-prescription', 'dispensary'],
  ['POST', '/api/stellar/admin/register-doctor', 'admin'],
  ['POST', '/api/stellar/submit', 'relayer'],
  ['GET', '/api/stellar/prescription/opaque/verify', 'patient'],
];
for (const [method, path, role] of positives) {
  const principal = await authorize(headersFor(role), method, path);
  assert.equal(principal?.subject, subjects[role], `${role} should access ${method} ${path}`);
}

await assert.rejects(() => authorize({}, 'POST', '/api/stellar/doctor/issue-prescription'), (error: any) => error.code === 'AUTH_REQUIRED');
await assert.rejects(() => authorize(headersFor('patient'), 'POST', '/api/stellar/doctor/issue-prescription'), (error: any) => error.code === 'ROLE_FORBIDDEN');
await assert.rejects(() => authorize(headersFor('doctor'), 'POST', '/api/stellar/dispensary/dispense-prescription'), (error: any) => error.code === 'ROLE_FORBIDDEN');
await assert.rejects(() => authorize(headersFor('dispensary'), 'POST', '/api/stellar/admin/register-doctor'), (error: any) => error.code === 'ROLE_FORBIDDEN');
await assert.rejects(() => authorize({ authorization: `Bearer ${tokenFor('doctor', { scopes: [] })}` }, 'POST', '/api/stellar/doctor/issue-prescription'), (error: any) => error.code === 'SCOPE_FORBIDDEN');
await assert.rejects(() => authorize({ authorization: `Bearer ${tokenFor('doctor', { sub: 'outsider' })}`, 'x-trustleaf-role': 'admin' }, 'POST', '/api/stellar/doctor/issue-prescription'), (error: any) => error.code === 'SUBJECT_NOT_ALLOWLISTED');
assert.throws(() => resolveLegacyRouteRequirement('POST', '/api/stellar/future-unreviewed-operation'), (error: any) => error.code === 'ROUTE_DENIED_BY_DEFAULT');
assert.equal(resolveLegacyRouteRequirement('GET', '/api/stellar/health')?.access, 'public');
assert.equal(resolveLegacyRouteRequirement('GET', '/unrelated') , null);

const middleware = createLegacyAuthorizationMiddleware(env, { fetcher: fetcher as typeof fetch, now: () => 1_000 });
async function invokeMiddleware(method: string, path: string, headers: Record<string, string> = {}) {
  let nextCalls = 0;
  let responseStatus: number | null = null;
  let responseBody: unknown;
  const res = {
    locals: {} as Record<string, unknown>,
    status(code: number) {
      responseStatus = code;
      return { json(body: unknown) { responseBody = body; } };
    },
  };
  await middleware({ method, path, headers }, res, () => { nextCalls += 1; });
  return { nextCalls, responseStatus, responseBody, locals: res.locals };
}
assert.deepEqual(await invokeMiddleware('POST', '/api/stellar/doctor/issue-prescription'), {
  nextCalls: 0, responseStatus: 401, responseBody: { code: 'AUTH_REQUIRED' }, locals: {},
});
assert.equal((await invokeMiddleware('POST', '/api/stellar/doctor/issue-prescription', headersFor('patient'))).responseStatus, 403);
const authorizedHttp = await invokeMiddleware('POST', '/api/stellar/doctor/issue-prescription', headersFor('doctor'));
assert.equal(authorizedHttp.nextCalls, 1);
assert.equal((authorizedHttp.locals.authPrincipal as { subject: string }).subject, subjects.doctor);
assert.equal((await invokeMiddleware('GET', '/api/stellar/health')).nextCalls, 1);
assert.equal((await invokeMiddleware('POST', '/api/stellar/future-unreviewed-operation', headersFor('admin'))).responseStatus, 403);
const missingConfigMiddleware = createLegacyAuthorizationMiddleware({});
let missingConfigNext = 0;
let missingConfigStatus = 0;
await missingConfigMiddleware(
  { method: 'POST', path: '/api/stellar/doctor/issue-prescription', headers: {} },
  { locals: {}, status(code) { missingConfigStatus = code; return { json() {} }; } },
  () => { missingConfigNext += 1; },
);
assert.equal(missingConfigStatus, 503);
assert.equal(missingConfigNext, 0);

const serverSource = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
const routePattern = /app\.(get|post|put|patch|delete)\("([^"*]+)"/g;
for (const match of serverSource.matchAll(routePattern)) {
  const method = match[1].toUpperCase();
  const path = match[2].replace(/:[^/]+/g, 'synthetic');
  assert.doesNotThrow(() => {
    const requirement = resolveLegacyRouteRequirement(method, path);
    assert.ok(requirement, `route must be classified: ${method} ${path}`);
  });
}
const authMiddlewarePosition = serverSource.indexOf('app.use(createLegacyAuthorizationMiddleware(process.env))');
const mutationMiddlewarePosition = serverSource.indexOf('const protectedMutation');
assert.ok(authMiddlewarePosition > 0 && mutationMiddlewarePosition > authMiddlewarePosition, 'auth must run before mutation gate');
const safetySource = await readFile(new URL('../api/_lib/pilot-safety.ts', import.meta.url), 'utf8');
assert.match(safetySource, /TRUSTLEAF_TESTNET_SUBMIT_ENABLED/);

console.log('legacy-route-authorization: route matrix, JWT, RBAC, scopes and default-deny passed');
