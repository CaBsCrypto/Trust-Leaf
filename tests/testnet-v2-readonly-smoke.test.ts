import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  V2_READONLY_SMOKE_SCHEMA,
  assertSafeV2ReadonlySmokeReport,
  createLocalV2ReadonlyFixture,
  runTestnetV2ReadonlySmoke,
  type TestnetV2ReadonlySmokeManifest,
} from '../api/_lib/testnet-v2-readonly-smoke.ts';

const registryHash = '1'.repeat(64);
const ledgerHash = '2'.repeat(64);
const registryRef = 'registry-fixture';
const ledgerRef = 'ledger-v2-fixture';
const doctor = 'doctor-active';
const eligibility = 'eligibility-active';
const dispensary = 'dispensary-active';
const states = ['issued', 'active', 'partial', 'dispensed', 'revoked', 'expired'] as const;

const deploymentManifest = JSON.parse(readFileSync(new URL('../docs/internal/testnet-v2-deployment-manifest.local.json', import.meta.url), 'utf8')) as {
  status: string;
  submissionEnabled: boolean;
  mutationsAllowed: boolean;
  artifacts: Record<'trustRegistry' | 'receiptLedgerV2', {
    path: string;
    sha256: string;
    init: { method: string; args: string[] };
    readonlyMethods: string[];
    mutatingMethods: string[];
  }>;
};
assert.equal(deploymentManifest.status, 'LOCAL_DRY_RUN_ONLY');
assert.equal(deploymentManifest.submissionEnabled, false);
assert.equal(deploymentManifest.mutationsAllowed, false);
for (const artifact of Object.values(deploymentManifest.artifacts)) {
  const wasm = readFileSync(new URL(`../${artifact.path}`, import.meta.url));
  assert.equal(createHash('sha256').update(wasm).digest('hex'), artifact.sha256);
  assert.equal(artifact.init.method, 'init');
  assert.ok(artifact.readonlyMethods.length >= 3);
  assert.ok(artifact.mutatingMethods.length >= 5);
}

function manifest(): TestnetV2ReadonlySmokeManifest {
  return {
    schema: V2_READONLY_SMOKE_SCHEMA,
    network: 'testnet',
    submissionEnabled: false,
    mutationsAllowed: false,
    timeoutMs: 80,
    contracts: {
      registry: { ref: registryRef, expectedSchemaVersion: 1, expectedWasmSha256: registryHash },
      receiptLedgerV2: { ref: ledgerRef, expectedSchemaVersion: 2, expectedWasmSha256: ledgerHash, expectedRegistryRef: registryRef },
    },
    credentials: [
      { ref: doctor, kind: 'doctor', expectedState: 'active' },
      { ref: dispensary, kind: 'dispensary', expectedState: 'active' },
      { ref: eligibility, kind: 'patient-eligibility', expectedState: 'active' },
      { ref: 'doctor-suspended', kind: 'doctor', expectedState: 'suspended' },
      { ref: 'dispensary-expired', kind: 'dispensary', expectedState: 'expired' },
      { ref: 'eligibility-revoked', kind: 'patient-eligibility', expectedState: 'revoked' },
    ],
    receipts: states.map(state => ({
      ref: `receipt-${state}`,
      expectedState: state,
      doctorCredentialRef: doctor,
      eligibilityCredentialRef: eligibility,
      dispensaryCredentialRef: dispensary,
      expectDispensaryActive: true,
      expectGrantEnabled: state !== 'issued',
    })),
  };
}

function adapter(overrides: {
  registryHash?: string;
  linkedRegistryRef?: string;
  omitCredential?: string;
  omitReceipt?: string;
  chainRegistryRef?: string;
  delayMs?: number;
} = {}) {
  const expected = manifest();
  return createLocalV2ReadonlyFixture({
    contracts: {
      [registryRef]: { schemaVersion: 1, wasmSha256: overrides.registryHash ?? registryHash },
      [ledgerRef]: { schemaVersion: 2, wasmSha256: ledgerHash, linkedRegistryRef: overrides.linkedRegistryRef ?? registryRef },
    },
    credentials: Object.fromEntries(expected.credentials
      .filter(item => item.ref !== overrides.omitCredential)
      .map((item, index) => [item.ref, { kind: item.kind, state: item.expectedState, version: index + 1 }])),
    receipts: Object.fromEntries(expected.receipts
      .filter(item => item.ref !== overrides.omitReceipt)
      .map((item, index) => [item.ref, {
        state: item.expectedState,
        version: index + 1,
        doctorCredentialRef: doctor,
        eligibilityCredentialRef: eligibility,
      }])),
    chains: Object.fromEntries(expected.receipts.map(item => [item.ref, {
      registryRef: overrides.chainRegistryRef ?? registryRef,
      doctorCredentialRef: doctor,
      doctorActive: true,
      eligibilityCredentialRef: eligibility,
      eligibilityActive: true,
      dispensaryCredentialRef: dispensary,
      dispensaryActive: true,
      grantEnabled: item.expectedState !== 'issued',
    }])),
    delayMs: overrides.delayMs,
  });
}

const pass = await runTestnetV2ReadonlySmoke({ manifest: manifest(), adapter: adapter() });
assert.equal(pass.ready, true);
assert.equal(pass.submissionAttempts, 0);
assert.equal(pass.counts.contractsChecked, 2);
assert.equal(pass.counts.credentialsChecked, 6);
assert.equal(pass.counts.receiptsChecked, 6);
assert.equal(pass.counts.authorizationChainsChecked, 6);
assert.deepEqual(pass.observed.credentialStates, { active: 3, suspended: 1, revoked: 1, expired: 1 });
assert.deepEqual(pass.observed.receiptStates, { issued: 1, active: 1, partial: 1, dispensed: 1, revoked: 1, expired: 1 });
assertSafeV2ReadonlySmokeReport(pass);

const hashMismatch = await runTestnetV2ReadonlySmoke({ manifest: manifest(), adapter: adapter({ registryHash: '3'.repeat(64) }) });
assert.equal(hashMismatch.ready, false);
assert.ok(hashMismatch.blockers.includes('REGISTRY_ARTIFACT_MISMATCH'));

const linkMismatch = await runTestnetV2ReadonlySmoke({ manifest: manifest(), adapter: adapter({ linkedRegistryRef: 'registry-other' }) });
assert.equal(linkMismatch.ready, false);
assert.ok(linkMismatch.blockers.includes('REGISTRY_LINK_MISMATCH'));

const chainMismatch = await runTestnetV2ReadonlySmoke({ manifest: manifest(), adapter: adapter({ chainRegistryRef: 'registry-other' }) });
assert.equal(chainMismatch.ready, false);
assert.ok(chainMismatch.blockers.includes('AUTHORIZATION_CHAIN_MISMATCH'));

const unknown = await runTestnetV2ReadonlySmoke({ manifest: manifest(), adapter: adapter({ omitCredential: doctor, omitReceipt: 'receipt-active' }) });
assert.equal(unknown.ready, false);
assert.ok(unknown.blockers.includes('CREDENTIAL_UNKNOWN'));
assert.ok(unknown.blockers.includes('RECEIPT_UNKNOWN'));

const timeout = await runTestnetV2ReadonlySmoke({ manifest: manifest(), adapter: adapter({ delayMs: 120 }) });
assert.equal(timeout.ready, false);
assert.ok(timeout.blockers.some(code => code.endsWith('_TIMEOUT')));
assert.equal(timeout.submissionAttempts, 0);

const unsafeBase = adapter();
const unsafeAdapter = {
  ...unsafeBase,
  async readCredential(ref: string, signal: AbortSignal) {
    const result = await unsafeBase.readCredential(ref, signal);
    return result ? { ...result, patientName: 'not-allowed' } as never : null;
  },
};
const unsafePayload = await runTestnetV2ReadonlySmoke({ manifest: manifest(), adapter: unsafeAdapter });
assert.equal(unsafePayload.ready, false);
assert.equal(unsafePayload.checks.privacySafe, false);
assert.ok(unsafePayload.blockers.includes('UNSAFE_ADAPTER_PAYLOAD'));

const open = structuredClone(manifest()) as unknown as { submissionEnabled: boolean };
open.submissionEnabled = true;
const flags = await runTestnetV2ReadonlySmoke({ manifest: open as unknown as TestnetV2ReadonlySmokeManifest, adapter: adapter() });
assert.equal(flags.ready, false);
assert.deepEqual(flags.blockers, ['FLAGS_NOT_CLOSED']);

const badEnums = structuredClone(manifest()) as unknown as { credentials: Array<{ ref: string; kind: string; expectedState: string }> };
badEnums.credentials[0].kind = 'admin';
badEnums.credentials[1].expectedState = 'verified';
const invalidEnums = await runTestnetV2ReadonlySmoke({ manifest: badEnums as unknown as TestnetV2ReadonlySmokeManifest, adapter: adapter() });
assert.equal(invalidEnums.ready, false);
assert.deepEqual(invalidEnums.blockers, ['MANIFEST_INVALID']);

const duplicateBase = manifest();
const duplicateReceipts: TestnetV2ReadonlySmokeManifest = {
  ...duplicateBase,
  receipts: duplicateBase.receipts.map((item, index) => index === 1 ? { ...item, ref: duplicateBase.receipts[0].ref } : item),
};
const invalidDuplicate = await runTestnetV2ReadonlySmoke({ manifest: duplicateReceipts, adapter: adapter() });
assert.equal(invalidDuplicate.ready, false);
assert.deepEqual(invalidDuplicate.blockers, ['MANIFEST_INVALID']);

for (const unsafe of [
  { ...pass, providerUrl: 'https://rpc.invalid' },
  { ...pass, blockers: [`C${'A'.repeat(55)}`] },
  { ...pass, blockers: [`G${'B'.repeat(55)}`] },
  { ...pass, blockers: ['a'.repeat(64)] },
  { ...pass, secret: 'fixture' },
  { ...pass, submissionAttempts: 1 },
]) assert.throws(() => assertSafeV2ReadonlySmokeReport(unsafe as never), (error: unknown) => (error as { code?: string }).code === 'UNSAFE_SMOKE_REPORT');

console.log('testnet-v2-readonly-smoke: 10 lifecycle, manifest, mismatch, timeout, privacy and zero-submission gate families passed');
