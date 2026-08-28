import {
  V2_READONLY_SMOKE_SCHEMA,
  assertSafeV2ReadonlySmokeReport,
  createLocalV2ReadonlyFixture,
  runTestnetV2ReadonlySmoke,
} from '../api/_lib/testnet-v2-readonly-smoke.ts';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const deploymentManifest = JSON.parse(readFileSync(new URL('../docs/internal/testnet-v2-deployment-manifest.local.json', import.meta.url), 'utf8'));
const registryHash = deploymentManifest.artifacts.trustRegistry.sha256;
const ledgerHash = deploymentManifest.artifacts.receiptLedgerV2.sha256;
const actualRegistryHash = createHash('sha256').update(readFileSync(new URL('../soroban/target/wasm32v1-none/release/trust_registry.wasm', import.meta.url))).digest('hex');
const actualLedgerHash = createHash('sha256').update(readFileSync(new URL('../soroban/target/wasm32v1-none/release/receipt_ledger_v2.wasm', import.meta.url))).digest('hex');
const registryRef = 'registry-local-fixture';
const ledgerRef = 'ledger-v2-local-fixture';
const doctor = 'doctor-active';
const eligibility = 'eligibility-active';
const dispensary = 'dispensary-active';

const receiptEntries = ['issued', 'active', 'partial', 'dispensed', 'revoked', 'expired'].map((state, index) => ({
  ref: `receipt-${state}`,
  expectedState: state,
  doctorCredentialRef: doctor,
  eligibilityCredentialRef: eligibility,
  expectDoctorActive: true,
  expectEligibilityActive: true,
  dispensaryCredentialRef: dispensary,
  expectDispensaryActive: true,
  expectGrantEnabled: index > 0,
}));

const manifest = {
  schema: V2_READONLY_SMOKE_SCHEMA,
  network: 'testnet',
  submissionEnabled: false,
  mutationsAllowed: false,
  timeoutMs: 250,
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
  receipts: receiptEntries,
};

const credentials = Object.fromEntries(manifest.credentials.map((entry, index) => [entry.ref, {
  kind: entry.kind,
  state: entry.expectedState,
  version: index + 1,
}]));
const receipts = Object.fromEntries(receiptEntries.map((entry, index) => [entry.ref, {
  state: entry.expectedState,
  version: index + 1,
  doctorCredentialRef: doctor,
  eligibilityCredentialRef: eligibility,
}]));
const chains = Object.fromEntries(receiptEntries.map(entry => [entry.ref, {
  registryRef,
  doctorCredentialRef: doctor,
  doctorActive: true,
  eligibilityCredentialRef: eligibility,
  eligibilityActive: true,
  dispensaryCredentialRef: dispensary,
  dispensaryActive: true,
  grantEnabled: entry.expectGrantEnabled,
}]));

const adapter = createLocalV2ReadonlyFixture({
  contracts: {
    [registryRef]: { schemaVersion: 1, wasmSha256: actualRegistryHash },
    [ledgerRef]: { schemaVersion: 2, wasmSha256: actualLedgerHash, linkedRegistryRef: registryRef },
  },
  credentials,
  receipts,
  chains,
});

const report = await runTestnetV2ReadonlySmoke({ manifest, adapter });
assertSafeV2ReadonlySmokeReport(report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ready) process.exitCode = 1;
