import assert from 'node:assert/strict';
import { createSyntheticReceiptLedger, createTestnetReceiptLedger } from '../api/_lib/receipt-ledger.ts';
import { createReceiptService, identityFromHeaders } from '../api/_lib/receipt-service.ts';

const ledger = createSyntheticReceiptLedger();
const service = createReceiptService(ledger);
const token = 'tl_demo_A7mQ2vJ9xK4pR8wN6yT3uF5zB1cD0eGhL.iNbZ8-2idR0rHqfXp-7YefpAq-svn1CjFmtUlXt2zbM';
const publicResult = await service.verifyPublic(token, 'read-1');
assert.deepEqual(Object.keys(publicResult).sort(), ['demo', 'evidenceExists', 'proofMatches', 'status']);
assert.equal(/patient|doctor|gram|quantity|balance|event|contract|address/i.test(JSON.stringify(publicResult)), false);
assert.deepEqual(await service.verifyPublic(`${token}x`, 'read-1'), { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' });
assert.deepEqual(await service.verifyPublic(token, 'read-1'), publicResult);
assert.deepEqual(await service.verifyPublic('tl_demo_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'enumeration'), { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' });

await assert.rejects(() => service.getOperational(token.split('.')[0], { authenticated: false }), (error: any) => error.code === 'AUTH_REQUIRED');
await assert.rejects(() => service.getOperational(token.split('.')[0], { authenticated: true, role: 'attacker' as any }), (error: any) => error.code === 'ROLE_FORBIDDEN');
const detail = await service.getOperational(token.split('.')[0], { authenticated: true, role: 'doctor' });
assert.equal(detail.demo, true);
assert.equal(detail.state, 'active');
assert.ok(detail.events.length > 0);
assert.equal(/name|rut|diagnos|dose|gram|wallet|address/i.test(JSON.stringify(detail)), false);

assert.deepEqual(identityFromHeaders({ authorization: 'Bearer wrong', 'x-trustleaf-role': 'doctor' }, { TRUSTLEAF_SYNTHETIC_AUTH_TOKEN: 'right' }), { authenticated: false });
assert.deepEqual(identityFromHeaders({ authorization: 'Bearer right', 'x-trustleaf-role': 'dispensary' }, { TRUSTLEAF_SYNTHETIC_AUTH_TOKEN: 'right' }), { authenticated: true, role: 'dispensary' });
assert.deepEqual(identityFromHeaders({ authorization: 'Bearer anything', 'x-trustleaf-role': 'doctor' }, {}), { authenticated: false });

await assert.rejects(() => ledger.appendEvent(), (error: any) => error.code === 'RECEIPT_MUTATIONS_DISABLED');
for (const env of [
  {},
  { STELLAR_NETWORK: 'mainnet', STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org', STELLAR_RECEIPT_CONTRACT_ID: 'CDEMO' },
  { STELLAR_NETWORK: 'testnet', STELLAR_RPC_URL: 'https://evil.invalid', STELLAR_RECEIPT_CONTRACT_ID: 'CDEMO' },
]) assert.throws(() => createTestnetReceiptLedger(env), (error: any) => error.code === 'RECEIPT_LEDGER_NOT_CONFIGURED');
assert.throws(() => createTestnetReceiptLedger({ STELLAR_NETWORK: 'testnet', STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org', STELLAR_RECEIPT_CONTRACT_ID: 'CDEMO' }), (error: any) => error.code === 'RECEIPT_TESTNET_GATE_CLOSED');

console.log('receipt-ledger-backend: auth, minimization, replay and fail-closed gates passed');
