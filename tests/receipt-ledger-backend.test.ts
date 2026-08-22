import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSyntheticReceiptLedger, createTestnetReceiptLedger } from '../api/_lib/receipt-ledger.ts';
import { createReceiptService, identityFromHeaders } from '../api/_lib/receipt-service.ts';
import { SYNTHETIC_RECEIPT_TOKEN } from '../shared/receipt-demo-contract.ts';

const ledger = createSyntheticReceiptLedger();
const service = createReceiptService(ledger);
const token = SYNTHETIC_RECEIPT_TOKEN;
const publicResult = await service.verifyPublic(token, 'read-1');
assert.deepEqual(Object.keys(publicResult).sort(), ['demo', 'evidenceExists', 'proofMatches', 'status']);
assert.equal(/patient|doctor|gram|quantity|balance|event|contract|address/i.test(JSON.stringify(publicResult)), false);
assert.deepEqual(await service.verifyPublic(`${token}x`, 'read-1'), { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' });
assert.deepEqual(await service.verifyPublic(token, 'read-1'), publicResult);
assert.deepEqual(await service.verifyPublic('tl_demo_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'enumeration'), { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' });

const activeHandle = token.split('.')[0];
const revokedHandle = 'tl_demo_P9kL3sV7nM2qW8xR5tY1uC6bF4dE0aJzH';
await assert.rejects(() => service.getOperational(activeHandle, { authenticated: false }), (error: any) => error.code === 'AUTH_REQUIRED');
await assert.rejects(() => service.getOperational(activeHandle, { authenticated: true, actorId: 'attacker', roles: ['attacker' as any], receiptHandles: [activeHandle] }), (error: any) => error.code === 'ROLE_FORBIDDEN');
await assert.rejects(() => service.getOperational(revokedHandle, { authenticated: true, actorId: 'doctor-a', roles: ['doctor'], receiptHandles: [activeHandle] }), (error: any) => error.code === 'RECEIPT_SCOPE_FORBIDDEN');
const detail = await service.getOperational(activeHandle, { authenticated: true, actorId: 'doctor-a', roles: ['doctor'], receiptHandles: [activeHandle] });
assert.equal(detail.demo, true);
assert.equal(detail.state, 'active');
assert.ok(detail.events.length > 0);
assert.equal(/name|rut|diagnos|dose|gram|wallet|address/i.test(JSON.stringify(detail)), false);

const fixturesJson = JSON.stringify([{ credential: 'server-known-credential', actorId: 'doctor-a', roles: ['doctor'], receiptHandles: [activeHandle] }]);
assert.deepEqual(identityFromHeaders({ authorization: 'Bearer wrong', 'x-trustleaf-role': 'admin' }, { TRUSTLEAF_SYNTHETIC_AUTH_FIXTURES_JSON: fixturesJson }), { authenticated: false });
assert.deepEqual(identityFromHeaders({ authorization: 'Bearer server-known-credential', 'x-trustleaf-role': 'admin' }, { TRUSTLEAF_SYNTHETIC_AUTH_FIXTURES_JSON: fixturesJson }), { authenticated: true, actorId: 'doctor-a', roles: ['doctor'], receiptHandles: [activeHandle] });
assert.deepEqual(identityFromHeaders({ authorization: 'Bearer anything', 'x-trustleaf-role': 'doctor' }, {}), { authenticated: false });
assert.deepEqual(identityFromHeaders({ authorization: 'Bearer anything' }, { TRUSTLEAF_SYNTHETIC_AUTH_FIXTURES_JSON: 'not-json' }), { authenticated: false });

const boundedLedger = createSyntheticReceiptLedger({ maxReadCacheEntries: 8 });
for (let index = 0; index < 1_000; index += 1) await boundedLedger.verifyPublic(token, `untrusted-${index}`);
assert.equal(boundedLedger.getReadCacheSize(), 8, 'operation cache must remain bounded under exhaustion');

const publicHandlerSource = readFileSync(new URL('../api/receipts/public-verify.ts', import.meta.url), 'utf8');
assert.equal(publicHandlerSource.includes('x-operation-id'), false, 'client operation header must not control deduplication');
assert.equal(/submitTransaction|invokeContract/i.test(publicHandlerSource), false, 'public verifier must remain read-only');

await assert.rejects(() => ledger.appendEvent(), (error: any) => error.code === 'RECEIPT_MUTATIONS_DISABLED');
for (const env of [
  {},
  { STELLAR_NETWORK: 'mainnet', STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org', STELLAR_RECEIPT_CONTRACT_ID: 'CDEMO' },
  { STELLAR_NETWORK: 'testnet', STELLAR_RPC_URL: 'https://evil.invalid', STELLAR_RECEIPT_CONTRACT_ID: 'CDEMO' },
]) assert.throws(() => createTestnetReceiptLedger(env), (error: any) => error.code === 'RECEIPT_LEDGER_NOT_CONFIGURED');
assert.throws(() => createTestnetReceiptLedger({ STELLAR_NETWORK: 'testnet', STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org', STELLAR_RECEIPT_CONTRACT_ID: 'CDEMO' }), (error: any) => error.code === 'RECEIPT_TESTNET_GATE_CLOSED');

console.log('receipt-ledger-backend: auth, minimization, replay and fail-closed gates passed');
