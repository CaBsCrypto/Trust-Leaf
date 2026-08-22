import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createAdminReadinessController, policyFromEnv } from '../api/_lib/admin-readiness.ts';
import { readFile } from 'node:fs/promises';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const baseEnv = {
  TRUSTLEAF_AUTH_ISSUER: 'https://synthetic-idp.invalid', TRUSTLEAF_AUTH_AUDIENCE: 'trustleaf-synthetic',
  TRUSTLEAF_AUTH_JWKS_URL: 'https://synthetic-idp.invalid/jwks', TRUSTLEAF_AUTH_SUBJECT_ALLOWLIST_JSON: '{"synthetic-admin":["admin"]}',
  TRUSTLEAF_TESTNET_SUBMIT_ENABLED: 'false',
};
const token = (claims: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'synthetic-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
};
const fetcher = async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'synthetic-key', alg: 'RS256', use: 'sig' }] }), { status: 200 });
const claims = { sub: 'synthetic-admin', iss: baseEnv.TRUSTLEAF_AUTH_ISSUER, aud: baseEnv.TRUSTLEAF_AUTH_AUDIENCE, exp: 2_000, roles: ['admin'], scope: 'admin:readiness:read' };
const controller = createAdminReadinessController(baseEnv, { fetcher: fetcher as typeof fetch, now: () => 1_000 });
const result = await controller({ authorization: `Bearer ${token(claims)}`, 'x-trustleaf-role': 'admin' });
assert.equal(result.mode, 'read-only'); assert.equal(result.submissionEnabled, false); assert.equal(result.mutationsAvailable, false);
await assert.rejects(() => controller({}), (e: any) => e.code === 'AUTH_REQUIRED');
await assert.rejects(() => controller({ authorization: `Bearer ${token({ ...claims, sub: 'outsider' })}`, 'x-trustleaf-role': 'admin' }), (e: any) => e.code === 'SUBJECT_NOT_ALLOWLISTED');
await assert.rejects(() => createAdminReadinessController(baseEnv, { fetcher: (async () => new Response('', { status: 503 })) as typeof fetch, now: () => 1_000 })({ authorization: `Bearer ${token(claims)}` }), (e: any) => e.code === 'TOKEN_INVALID');
assert.throws(() => policyFromEnv({ ...baseEnv, TRUSTLEAF_AUTH_SUBJECT_ALLOWLIST_JSON: '' }), (e: any) => e.code === 'AUTH_CONFIGURATION_MISSING');
assert.throws(() => policyFromEnv({ ...baseEnv, TRUSTLEAF_AUTH_SUBJECT_ALLOWLIST_JSON: '{"synthetic-admin":["root"]}' }), (e: any) => e.code === 'AUTH_ALLOWLIST_INVALID');
assert.equal(JSON.stringify(result).includes('synthetic-key'), false);
const panel = await readFile(new URL('../src/components/AdminReadinessPanel.tsx', import.meta.url), 'utf8');
assert.equal(panel.includes("method: 'GET'"), true);
assert.equal(/method:\s*['\"](?:POST|PUT|PATCH|DELETE)/.test(panel), false);
assert.equal(/submit|mutation/i.test(panel), true);
console.log('admin-auth-readiness: JWKS, claims, allowlist, IdP failure and read-only gates passed');
