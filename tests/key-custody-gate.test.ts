import assert from 'node:assert/strict';
import {
  createKeyCustodyGate,
  createNoSecretLocalCustodyProvider,
  STELLAR_TESTNET_PASSPHRASE,
  type CustodyAuthorizationRequest,
  type KeyCustodyPolicy,
  type KeyDescriptor,
  type SigningRole,
} from '../api/_lib/key-custody-gate.ts';

const contractId = `C${'A'.repeat(55)}`;
const wasmSha256 = 'b'.repeat(64);
const payloadDigest = 'a'.repeat(64);
const roles: readonly SigningRole[] = ['admin-quorum', 'deployer', 'submission-operator', 'doctor-service', 'dispensary-service'];
const aliasesByRole = {
  'admin-quorum': ['admin-a', 'admin-b'],
  deployer: ['deployer-fixture'],
  'submission-operator': ['operator-fixture'],
  'doctor-service': ['doctor-fixture'],
  'dispensary-service': ['dispensary-fixture'],
} as const;
const pinnedVersions = Object.fromEntries(Object.values(aliasesByRole).flat().map(alias => [alias, 1]));

const policy: KeyCustodyPolicy = {
  runtime: 'local-mock',
  submissionEnabled: false,
  network: 'testnet',
  allowedPassphrases: [STELLAR_TESTNET_PASSPHRASE],
  allowedRpcOrigins: ['https://soroban-testnet.stellar.org'],
  allowedContractIds: [contractId],
  allowedWasmSha256: [wasmSha256],
  allowedAliasesByRole: aliasesByRole,
  pinnedVersions,
  quorumByRole: { 'admin-quorum': 2, deployer: 1, 'submission-operator': 1, 'doctor-service': 1, 'dispensary-service': 1 },
  allowedProviderKinds: ['local-mock-no-secret'],
};

const descriptors: KeyDescriptor[] = roles.flatMap(role => aliasesByRole[role].map(alias => ({
  alias,
  role,
  version: 1,
  state: 'active' as const,
  providerKind: 'local-mock-no-secret' as const,
})));

const request = (role: SigningRole, alias: string): CustodyAuthorizationRequest => ({
  role,
  alias,
  keyVersion: 1,
  operationId: `fixture-operation-${role}`,
  payloadDigest,
  network: 'testnet',
  passphrase: STELLAR_TESTNET_PASSPHRASE,
  rpcUrl: 'https://soroban-testnet.stellar.org',
  contractId,
  wasmSha256,
});

const code = async (run: () => unknown | Promise<unknown>) => Promise.resolve().then(run).then(() => '', error => error.code as string);
const audit: unknown[] = [];
const gate = createKeyCustodyGate({
  provider: createNoSecretLocalCustodyProvider(descriptors),
  policy,
  audit: { write(event) { audit.push(event); } },
});

for (const role of roles) {
  const alias = aliasesByRole[role][0];
  const result = await gate.authorize(request(role, alias));
  assert.equal(result.submissionEnabled, false);
  assert.equal(result.usableOnStellar, false);
  assert.match(result.authorizationProof, /^local-proof-[a-f0-9]{64}$/);
}

const quorum = await gate.authorizeQuorum([
  request('admin-quorum', 'admin-a'),
  request('admin-quorum', 'admin-b'),
]);
assert.equal(quorum.length, 2);
assert.equal(quorum[0].intentId, quorum[1].intentId);
assert.equal(await code(() => gate.authorizeQuorum([request('admin-quorum', 'admin-a')])), 'QUORUM_NOT_MET');
assert.equal(await code(() => gate.authorizeQuorum([request('admin-quorum', 'admin-a'), request('admin-quorum', 'admin-a')])), 'QUORUM_ALIAS_DUPLICATE');
for (const changed of [
  { operationId: 'fixture-operation-admin-quorum-changed' },
  { payloadDigest: 'c'.repeat(64) },
  { keyVersion: 2 },
]) {
  assert.equal(await code(() => gate.authorizeQuorum([
    request('admin-quorum', 'admin-a'),
    { ...request('admin-quorum', 'admin-b'), ...changed },
  ])), 'QUORUM_INTENT_MISMATCH');
}

const alternateTargetPolicy: KeyCustodyPolicy = {
  ...policy,
  allowedRpcOrigins: [...policy.allowedRpcOrigins, 'https://alternate-rpc.invalid'],
  allowedContractIds: [...policy.allowedContractIds, `C${'B'.repeat(55)}`],
  allowedWasmSha256: [...policy.allowedWasmSha256, 'c'.repeat(64)],
};
const alternateTargetGate = createKeyCustodyGate({ provider: createNoSecretLocalCustodyProvider(descriptors), policy: alternateTargetPolicy });
for (const changed of [
  { rpcUrl: 'https://alternate-rpc.invalid' },
  { contractId: `C${'B'.repeat(55)}` },
  { wasmSha256: 'c'.repeat(64) },
]) {
  assert.equal(await code(() => alternateTargetGate.authorizeQuorum([
    request('admin-quorum', 'admin-a'),
    { ...request('admin-quorum', 'admin-b'), ...changed },
  ])), 'QUORUM_INTENT_MISMATCH');
}

assert.equal(await code(() => gate.authorize(request('doctor-service', 'dispensary-fixture'))), 'KEY_ROLE_MISMATCH');
assert.equal(await code(() => gate.authorize({ ...request('doctor-service', 'doctor-fixture'), keyVersion: 2 })), 'KEY_VERSION_STALE');
assert.equal(await code(() => gate.authorize({ ...request('doctor-service', 'doctor-fixture'), passphrase: 'Public Global Stellar Network ; September 2015' })), 'NETWORK_ALLOWLIST_MISMATCH');
assert.equal(await code(() => gate.authorize({ ...request('doctor-service', 'doctor-fixture'), rpcUrl: 'https://untrusted.invalid' })), 'RPC_ALLOWLIST_MISMATCH');
assert.equal(await code(() => gate.authorize({ ...request('doctor-service', 'doctor-fixture'), contractId: `C${'B'.repeat(55)}` })), 'CONTRACT_ALLOWLIST_MISMATCH');
assert.equal(await code(() => gate.authorize({ ...request('doctor-service', 'doctor-fixture'), wasmSha256: 'c'.repeat(64) })), 'WASM_ALLOWLIST_MISMATCH');

for (const [state, expected] of [
  ['rotating', 'KEY_ROTATION_PENDING'],
  ['revoked', 'KEY_REVOKED'],
  ['recovery-locked', 'KEY_RECOVERY_LOCKED'],
] as const) {
  const provider = createNoSecretLocalCustodyProvider(descriptors.map(item => item.alias === 'doctor-fixture' ? { ...item, state } : item));
  const stateGate = createKeyCustodyGate({ provider, policy });
  assert.equal(await code(() => stateGate.authorize(request('doctor-service', 'doctor-fixture'))), expected);
}

const missingProvider = createNoSecretLocalCustodyProvider(descriptors.filter(item => item.alias !== 'doctor-fixture'));
const missingGate = createKeyCustodyGate({ provider: missingProvider, policy });
assert.equal(await code(() => missingGate.authorize(request('doctor-service', 'doctor-fixture'))), 'KEY_ALIAS_MISSING');

assert.throws(() => createKeyCustodyGate({ provider: { ...createNoSecretLocalCustodyProvider(descriptors), kind: 'kms' }, policy }), /Key custody authorization unavailable/);
assert.throws(() => createKeyCustodyGate({ provider: createNoSecretLocalCustodyProvider(descriptors), policy: { ...policy, submissionEnabled: true as never } }), /Key custody authorization unavailable/);
assert.throws(() => createKeyCustodyGate({
  provider: createNoSecretLocalCustodyProvider(descriptors),
  policy: { ...policy, allowedPassphrases: [STELLAR_TESTNET_PASSPHRASE, 'Public Global Stellar Network ; September 2015'] },
}), /Key custody authorization unavailable/);
assert.throws(() => createKeyCustodyGate({
  provider: createNoSecretLocalCustodyProvider(descriptors),
  policy: { ...policy, allowedAliasesByRole: { ...aliasesByRole, deployer: ['doctor-fixture'] } },
}), /Key custody authorization unavailable/);

const serializedAudit = JSON.stringify(audit);
assert.doesNotMatch(serializedAudit, new RegExp(payloadDigest));
assert.doesNotMatch(serializedAudit, /soroban-testnet|authorizationProof|contractId|wasmSha256|rpcUrl/i);
assert.doesNotMatch(serializedAudit, /secret|private|seed|S[A-Z2-7]{55}/i);
assert.equal((audit as Array<{ outcome: string }>).filter(event => event.outcome === 'authorized-local-only').length >= roles.length, true);
assert.equal((audit as Array<{ reason?: string }>).some(event => event.reason === 'QUORUM_INTENT_MISMATCH'), true);

console.log('key-custody-gate: no-secret mock, duties, quorum, lifecycle, allowlists and redaction passed');
