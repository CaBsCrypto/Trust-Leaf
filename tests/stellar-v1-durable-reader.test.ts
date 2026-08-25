import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { createLocalFileDurableReceiptIndexerStore, createMemoryDurableReceiptIndexerStore } from '../api/_lib/durable-readonly-receipt-indexer.ts';
import {
  DEPLOYED_RECEIPT_START_LEDGER,
  DEPLOYED_RECEIPT_WASM_SHA256,
  STELLAR_TESTNET_PASSPHRASE,
  STELLAR_TESTNET_RPC_URL,
  createStellarV1DurableReader,
  createStellarV1RpcDurableReader,
  loadDeployedV1ReaderConfig,
  validateStellarV1DurableReaderConfig,
  type StellarV1DurableReaderConfig,
} from '../api/_lib/stellar-v1-durable-reader.ts';
import { DEPLOYED_RECEIPT_CONTRACT_ID } from '../api/_lib/readonly-receipt-verifier.ts';

const deployedEnv = {
  STELLAR_NETWORK_PASSPHRASE: STELLAR_TESTNET_PASSPHRASE,
  STELLAR_RPC_URL: STELLAR_TESTNET_RPC_URL,
  STELLAR_RECEIPT_CONTRACT_ID: DEPLOYED_RECEIPT_CONTRACT_ID,
  STELLAR_RECEIPT_WASM_SHA256: DEPLOYED_RECEIPT_WASM_SHA256,
  STELLAR_RECEIPT_START_LEDGER: String(DEPLOYED_RECEIPT_START_LEDGER),
  TRUSTLEAF_TESTNET_SUBMIT_ENABLED: 'false',
  TRUSTLEAF_ALLOW_TESTNET_MUTATIONS: 'false',
};
assert.equal(loadDeployedV1ReaderConfig(deployedEnv).startLedger, DEPLOYED_RECEIPT_START_LEDGER);
for (const candidate of [
  { ...deployedEnv, STELLAR_RPC_URL: 'https://evil.invalid' },
  { ...deployedEnv, STELLAR_RECEIPT_CONTRACT_ID: `C${'B'.repeat(55)}` },
  { ...deployedEnv, STELLAR_RECEIPT_WASM_SHA256: 'f'.repeat(64) },
  { ...deployedEnv, STELLAR_RECEIPT_START_LEDGER: '1' },
  { ...deployedEnv, STELLAR_NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015' },
  { ...deployedEnv, TRUSTLEAF_TESTNET_SUBMIT_ENABLED: 'true' },
  { ...deployedEnv, TRUSTLEAF_ALLOW_TESTNET_MUTATIONS: 'true' },
]) assert.throws(() => loadDeployedV1ReaderConfig(candidate));

const contractId = `C${'A'.repeat(55)}`;
const rpcUrl = STELLAR_TESTNET_RPC_URL;
const wasm = Buffer.from('synthetic ReceiptLedger V1 bytecode fixture');
const wasmSha256 = createHash('sha256').update(wasm).digest('hex');
const config: StellarV1DurableReaderConfig = {
  mode: 'testnet-readonly', network: 'testnet', networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
  rpcUrl, allowedRpcUrls: [rpcUrl], receiptContractId: contractId, allowedContractIds: [contractId],
  receiptWasmSha256: wasmSha256, allowedWasmSha256: [wasmSha256], startLedger: 10,
  timeoutMs: 100, retryAttempts: 3, finalityDepth: 2,
  submissionEnabled: false, mutationsAllowed: false,
};
validateStellarV1DurableReaderConfig(config);
for (const candidate of [
  { ...config, rpcUrl: 'https://evil.invalid' },
  { ...config, networkPassphrase: 'Public Global Stellar Network ; September 2015' },
  { ...config, receiptContractId: `C${'B'.repeat(55)}` },
  { ...config, receiptWasmSha256: 'f'.repeat(64) },
  { ...config, submissionEnabled: true as false },
  { ...config, mutationsAllowed: true as false },
]) assert.throws(() => validateStellarV1DurableReaderConfig(candidate));

const receipt = Buffer.alloc(32, 1);
const event = (sequence: number, state: string, version: number) => ({
  id: `event-${sequence}-${version}`, ledger: sequence, ledgerClosedAt: '2026-08-25T12:00:00Z',
  transactionIndex: 1, operationIndex: 1, type: 'contract',
  contractId: { contractId: () => contractId }, txHash: String(sequence).repeat(64).slice(0, 64),
  inSuccessfulContractCall: true,
  topic: [nativeToScVal(state, { type: 'symbol' })],
  value: nativeToScVal([1, receipt, version, Buffer.alloc(32, version), Buffer.alloc(32, version + 4), `G${'A'.repeat(55)}`]),
});
let networkCalls = 0;
let ledgerRound = 0;
const server = {
  async getNetwork() { networkCalls += 1; return { passphrase: STELLAR_TESTNET_PASSPHRASE }; },
  async getContractWasmByContractId() { networkCalls += 1; return wasm; },
  async getLedgers() {
    ledgerRound += 1;
    const parent = { sequence: 9, hash: '9'.repeat(64), ledgerCloseTime: '2026-08-25T11:59:55Z' };
    if (ledgerRound === 1) return { latestLedger: 10, ledgers: [parent, { sequence: 10, hash: 'a'.repeat(64), ledgerCloseTime: '2026-08-25T12:00:00Z' }] };
    if (ledgerRound === 2) return { latestLedger: 10, ledgers: [parent, { sequence: 10, hash: 'b'.repeat(64), ledgerCloseTime: '2026-08-25T12:00:01Z' }] };
    return { latestLedger: 11, ledgers: [parent, { sequence: 10, hash: 'b'.repeat(64), ledgerCloseTime: '2026-08-25T12:00:01Z' }, { sequence: 11, hash: 'c'.repeat(64), ledgerCloseTime: '2026-08-25T12:00:06Z' }] };
  },
  async getEvents(request: { startLedger?: number }) {
    const sequence = request.startLedger ?? 10;
    return { events: [event(sequence, sequence === 11 ? 'Active' : 'Issued', sequence === 11 ? 2 : 1)] };
  },
};

const stateDirectory = await mkdtemp(join(tmpdir(), 'trustleaf-v1-reader-'));
try {
  const store = createLocalFileDurableReceiptIndexerStore({ stateDirectory, fileName: 'receipt-indexer-v1.json', lockDelayMs: 1 });
  const reader = createStellarV1RpcDurableReader({ config, store, server: server as never, metrics: { increment() {} }, wait: async () => undefined });
  assert.equal(networkCalls, 0, 'construction must remain lazy');
  assert.equal((await reader.start()).attested, true);
  assert.equal(networkCalls, 2);
  assert.equal((await reader.pollOnce()).pollStatus, 'ingested');
  assert.equal(reader.getCursor()?.hash, 'a'.repeat(64));
  const reorg = await reader.pollOnce();
  assert.equal(reorg.code, 'REORG_REPLACED');
  assert.equal(reader.getCursor()?.hash, 'b'.repeat(64));
  assert.equal((await reader.pollOnce()).pollStatus, 'ingested');
  assert.deepEqual(reader.getReceiptTimeline(receipt.toString('hex')).map(item => item.state), ['issued', 'active']);
  const report = JSON.stringify(reader.getReport());
  for (const forbidden of [rpcUrl, contractId, receipt.toString('hex'), 'event-', 'http', '@', 'secret', 'xdr']) {
    assert.equal(report.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
  const restarted = createStellarV1RpcDurableReader({
    config,
    store: createLocalFileDurableReceiptIndexerStore({ stateDirectory, fileName: 'receipt-indexer-v1.json' }),
    server: server as never,
    metrics: { increment() {} },
  });
  await restarted.start();
  assert.equal(restarted.getCursor()?.sequence, 11, 'cursor must recover after restart');
  const journal = await readFile(join(stateDirectory, 'receipt-indexer-v1.json'), 'utf8');
  for (const forbidden of ['http', '@', 'secret', 'private', 'xdr']) assert.equal(journal.toLowerCase().includes(forbidden), false);
} finally {
  await rm(stateDirectory, { recursive: true, force: true });
}

let retryAttempts = 0;
const retryReader = createStellarV1DurableReader({
  config,
  store: createMemoryDurableReceiptIndexerStore(),
  metrics: { increment() {} },
  transport: {
    kind: 'stellar-rpc',
    async fetchNext() {
      retryAttempts += 1;
      throw Object.assign(new Error('patient@example.test secret xdr'), { code: 'SOURCE_TIMEOUT' });
    },
  },
  async attest() { return { networkPassphrase: STELLAR_TESTNET_PASSPHRASE, contractId, wasmSha256 }; },
  wait: async () => undefined,
});
await retryReader.start();
const unknown = await retryReader.pollOnce();
assert.equal(unknown.pollStatus, 'unknown');
assert.equal(retryAttempts, 3);
const unknownReport = JSON.stringify(unknown);
for (const forbidden of ['patient', '@', 'secret', 'xdr', contractId, rpcUrl]) assert.equal(unknownReport.includes(forbidden), false);

const rejectedReader = createStellarV1DurableReader({
  config,
  store: createMemoryDurableReceiptIndexerStore(),
  metrics: { increment() {} },
  transport: {
    kind: 'stellar-rpc',
    async fetchNext() {
      return { status: 'ledger', contractId: `C${'B'.repeat(55)}`, schemaVersion: 1, ledger: {
        sequence: 10, hash: 'a'.repeat(64), parentHash: '9'.repeat(64), closedAt: 1, events: [],
      } };
    },
  },
  async attest() { return { networkPassphrase: STELLAR_TESTNET_PASSPHRASE, contractId, wasmSha256 }; },
});
await rejectedReader.start();
assert.equal((await rejectedReader.pollOnce()).code, 'EVENT_SOURCE_ALLOWLIST_REJECTED');

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(packageJson.scripts.preflight.includes('live:testnet-v1:readonly'), false, 'live RPC must never run in preflight');
const liveScript = await readFile(new URL('../scripts/testnet-v1-readonly-live.mjs', import.meta.url), 'utf8');
assert.match(liveScript, /TRUSTLEAF_V1_READONLY_LIVE_ENABLED/);
assert.equal(/submitTransaction|sendTransaction|issueSyntheticReadonlyToken|TRUSTLEAF_PUBLIC_QR_HMAC_KEY/.test(liveScript), false);

console.log('stellar-v1-durable-reader: exact deployed allowlists, lazy RPC, cursor restart, reorg, retry and redaction passed');
