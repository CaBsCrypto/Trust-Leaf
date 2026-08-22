import assert from 'node:assert/strict';
import { createSimulatedSecretStore, createSimulatedTestnetAdapter, syntheticContractId, TESTNET_PASSPHRASE, TESTNET_RPC, type SimulatedReceiptAction, type SimulatedTestnetTransport } from '../api/_lib/simulated-testnet-adapter.ts';

const hash = 'e627801e8940efec80f4e50d1b16219bc25d8a1aa97130f54fc1734ca7b14fd3';
const contractId = syntheticContractId();
const config = { network: 'testnet' as const, passphrase: TESTNET_PASSPHRASE, rpcUrl: TESTNET_RPC, contractId, contractWasmSha256: hash, allowedContractIds: [contractId], allowedWasmSha256: [hash], submissionEnabled: false as const };
const action: SimulatedReceiptAction = { operationId: 'operation-fixture-0001', receiptHandle: 'receipt_handle_fixture_0001', expectedVersion: 0, event: 'Issued', commitment: 'a'.repeat(64) };
const secrets = createSimulatedSecretStore({ doctor: { version: 2, material: 'synthetic-only-not-a-stellar-key' } });
const errorCode = (run: () => unknown | Promise<unknown>) => Promise.resolve().then(run).then(() => '', error => error.code);

let calls = 0;
const confirmed: SimulatedTestnetTransport = { async submit() { calls += 1; return { state: 'confirmed', ledgerSequence: 42 }; }, async reconcile() { return { state: 'confirmed', ledgerSequence: 42 }; } };
const adapter = createSimulatedTestnetAdapter({ config, transport: confirmed, secrets, signerAlias: 'doctor', secretVersion: 2 });
assert.equal((await adapter.submit(action)).state, 'confirmed');
assert.equal((await adapter.submit(action)).state, 'confirmed');
assert.equal(calls, 1, 'confirmed retry must be idempotent');
assert.equal(await errorCode(() => adapter.prepare({ ...action, commitment: 'b'.repeat(64) })), 'IDEMPOTENCY_CONFLICT');

assert.equal(await errorCode(() => createSimulatedTestnetAdapter({ config: { ...config, rpcUrl: 'https://evil.invalid' }, transport: confirmed, secrets, signerAlias: 'doctor', secretVersion: 2 })), 'TESTNET_ALLOWLIST_REJECTED');
assert.equal(await errorCode(() => createSimulatedTestnetAdapter({ config: { ...config, allowedContractIds: [] }, transport: confirmed, secrets, signerAlias: 'doctor', secretVersion: 2 })), 'CONTRACT_ALLOWLIST_REJECTED');
assert.equal(await errorCode(() => createSimulatedTestnetAdapter({ config: { ...config, allowedWasmSha256: [] }, transport: confirmed, secrets, signerAlias: 'doctor', secretVersion: 2 })), 'WASM_HASH_ALLOWLIST_REJECTED');
assert.equal(await errorCode(() => createSimulatedTestnetAdapter({ config: { ...config, submissionEnabled: true as never }, transport: confirmed, secrets, signerAlias: 'doctor', secretVersion: 2 })), 'REAL_SUBMISSION_FORBIDDEN');

const missing = createSimulatedTestnetAdapter({ config, transport: confirmed, secrets, signerAlias: 'missing', secretVersion: 1 });
assert.equal(await errorCode(() => missing.submit({ ...action, operationId: 'operation-fixture-0002' })), 'SIMULATED_SECRET_MISSING');
const rotated = createSimulatedTestnetAdapter({ config, transport: confirmed, secrets, signerAlias: 'doctor', secretVersion: 1 });
assert.equal(await errorCode(() => rotated.submit({ ...action, operationId: 'operation-fixture-0003' })), 'SIMULATED_SECRET_ROTATED');

const delayed: SimulatedTestnetTransport = { async submit() { return new Promise(() => undefined); }, async reconcile() { return { state: 'unknown' }; } };
const timeout = createSimulatedTestnetAdapter({ config, transport: delayed, secrets, signerAlias: 'doctor', secretVersion: 2, timeoutMs: 5 });
assert.equal((await timeout.submit({ ...action, operationId: 'operation-fixture-0004' })).state, 'unknown');
assert.equal(timeout.get('operation-fixture-0004')?.errorCode, 'RPC_TIMEOUT_UNKNOWN');
assert.equal((await timeout.reconcile('operation-fixture-0004')).state, 'unknown');

let reconcileCount = 0;
const reorg: SimulatedTestnetTransport = { async submit() { return { state: 'submitted', ledgerSequence: 100 }; }, async reconcile() { reconcileCount += 1; return reconcileCount === 1 ? { state: 'submitted', ledgerSequence: 101 } : { state: 'confirmed', ledgerSequence: 99 }; } };
const ordered = createSimulatedTestnetAdapter({ config, transport: reorg, secrets, signerAlias: 'doctor', secretVersion: 2 });
await ordered.submit({ ...action, operationId: 'operation-fixture-0005' });
await ordered.reconcile('operation-fixture-0005');
const reorgResult = await ordered.reconcile('operation-fixture-0005');
assert.equal(reorgResult.state, 'unknown');
assert.equal(reorgResult.errorCode, 'LEDGER_ORDER_VIOLATION');

const unsafeError: SimulatedTestnetTransport = { async submit() { return { state: 'failed', errorCode: 'secret=leaked value' }; }, async reconcile() { return { state: 'failed' }; } };
const redacted = createSimulatedTestnetAdapter({ config, transport: unsafeError, secrets, signerAlias: 'doctor', secretVersion: 2 });
assert.equal((await redacted.submit({ ...action, operationId: 'operation-fixture-0006' })).errorCode, 'SIMULATED_TRANSPORT_ERROR');

console.log('simulated Testnet adapter: allowlists, fail-closed signer, timeout, idempotency, ordering and redaction passed');
