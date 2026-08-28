import assert from 'node:assert/strict';
import { createServerAuthorizer, type TokenVerifier } from '../api/_lib/server-authorization.ts';
import { createSignerCustody, type CustodyProvider } from '../api/_lib/signer-custody.ts';

const claims = { subject: 'synthetic-doctor-01', issuer: 'local-fixture-issuer', audience: 'trustleaf-testnet-prep', expiresAt: 2_000, roles: ['doctor'], scopes: ['receipt:issue'] };
const verifier: TokenVerifier = { kind: 'synthetic-test-double', async verify(token) { if (token !== 'synthetic-valid-token') throw new Error('bad token'); return claims; } };
const policy = {
  issuer: 'local-fixture-issuer', audience: 'trustleaf-testnet-prep',
  allowedSubjects: { 'synthetic-doctor-01': ['doctor'] as const },
  roleScopes: { doctor: ['receipt:issue'], patient: ['receipt:read'], dispensary: ['receipt:dispense'], admin: ['policy:read'], relayer: ['receipt:submit'] },
};
const authorizer = createServerAuthorizer({ verifier, policy, now: () => 1_000 });
await assert.rejects(() => authorizer.authorize({}, { roles: ['doctor'], scopes: ['receipt:issue'] }), (e: any) => e.code === 'AUTH_REQUIRED');
await assert.rejects(() => authorizer.authorize({ authorization: 'Bearer synthetic-valid-token' }, { roles: ['dispensary'], scopes: ['receipt:dispense'] }), (e: any) => e.code === 'ROLE_FORBIDDEN');
await assert.rejects(() => authorizer.authorize({ authorization: 'Bearer synthetic-valid-token' }, { roles: ['doctor'], scopes: ['receipt:dispense'] }), (e: any) => e.code === 'SCOPE_FORBIDDEN');
const outsider = createServerAuthorizer({ verifier: { ...verifier, async verify() { return { ...claims, subject: 'synthetic-outsider' }; } }, policy, now: () => 1_000 });
await assert.rejects(() => outsider.authorize({ authorization: 'Bearer synthetic-valid-token', 'x-trustleaf-role': 'admin' }, { roles: ['doctor'], scopes: ['receipt:issue'] }), (e: any) => e.code === 'SUBJECT_NOT_ALLOWLISTED');
const principal = await authorizer.authorize({ authorization: 'Bearer synthetic-valid-token', 'x-trustleaf-role': 'admin' }, { roles: ['doctor'], scopes: ['receipt:issue'] });
assert.deepEqual(principal, { subject: claims.subject, roles: ['doctor'], scopes: ['receipt:issue'] });

const secretMaterial = 'synthetic-material-never-log';
let currentVersion: number | null = 3;
const provider: CustodyProvider = {
  kind: 'synthetic-test-double',
  async currentVersion() { return currentVersion; },
  async signDigest(_alias, _version, digest) { return `synthetic-signature-${digest.slice(0, 8)}-${secretMaterial}`; },
};
const logs: Record<string, unknown>[] = [];
const makeCustody = (pinned = 3) => createSignerCustody({ provider, policy: { submissionEnabled: false, allowedAliases: ['receipt-issuer'], pinnedVersions: { 'receipt-issuer': pinned } }, logger: { write: event => logs.push(event) } });
const digest = 'ab'.repeat(32);
const signed = await makeCustody().sign({ alias: 'receipt-issuer', secretVersion: 3, digest, operationId: 'synthetic-op-0001' });
assert.equal(signed.submissionEnabled, false);
assert.equal(JSON.stringify(logs).includes(secretMaterial), false);
assert.equal(JSON.stringify(logs).includes(digest), false);

currentVersion = null;
await assert.rejects(() => makeCustody().sign({ alias: 'receipt-issuer', secretVersion: 3, digest, operationId: 'synthetic-op-0002' }), (e: any) => e.code === 'SECRET_MISSING');
currentVersion = 4;
await assert.rejects(() => makeCustody().sign({ alias: 'receipt-issuer', secretVersion: 3, digest, operationId: 'synthetic-op-0003' }), (e: any) => e.code === 'SECRET_ROTATED');
await assert.rejects(() => makeCustody(4).sign({ alias: 'receipt-issuer', secretVersion: 3, digest, operationId: 'synthetic-op-0004' }), (e: any) => e.code === 'SECRET_VERSION_NOT_PINNED');
await assert.rejects(() => makeCustody(4).sign({ alias: 'unknown-signer', secretVersion: 4, digest, operationId: 'synthetic-op-0005' }), (e: any) => e.code === 'SIGNER_ALIAS_FORBIDDEN');
assert.equal(JSON.stringify(logs).includes(secretMaterial), false);
assert.equal(JSON.stringify(logs).includes(digest), false);

console.log('server-auth-custody: fail-closed roles, scopes, allowlists, rotation and redacted audit passed');
