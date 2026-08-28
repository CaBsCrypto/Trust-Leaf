import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRUST_CHAIN_SCENARIOS, type TrustChainScenario } from '../src/lib/trustRegistryReview.ts';
import {
  LOCAL_V2_READONLY_EVIDENCE_PORT,
  readV2Evidence,
  sanitizeV2EvidenceSnapshot,
  type V2ReadonlyEvidencePort,
  type V2ReadonlyEvidenceSnapshot,
} from '../src/lib/v2ReadonlyEvidence.ts';

for (const [scenario, fixture] of Object.entries(TRUST_CHAIN_SCENARIOS) as [TrustChainScenario, (typeof TRUST_CHAIN_SCENARIOS)[TrustChainScenario]][]) {
  const snapshot = readV2Evidence(LOCAL_V2_READONLY_EVIDENCE_PORT, scenario, fixture.actorRole);
  assert.equal(snapshot.scenario, scenario);
  assert.equal(snapshot.viewerRole, fixture.actorRole);
  assert.equal(snapshot.source, 'local-fixture');
  assert.equal(snapshot.finality, 'local-fixture');
  assert.equal(snapshot.reorgState, 'none');
  assert.equal(snapshot.evidence, null);
  assert.ok(snapshot.blockedReason, 'fixture must not claim live Testnet evidence');
}
assert.equal(TRUST_CHAIN_SCENARIOS['patient-readonly'].actorRole, 'patient');
assert.equal(TRUST_CHAIN_SCENARIOS['patient-readonly'].receiptState, 'active');

const allowlisted: V2ReadonlyEvidenceSnapshot = {
  schemaVersion: 1,
  scenario: 'receipt-active',
  viewerRole: 'doctor',
  source: 'sanitized-indexer',
  health: 'current',
  freshnessLabel: 'checkpoint reciente',
  cursorLabel: 'ledger 123 · cursor 4',
  finality: 'finalized',
  reorgState: 'none',
  observedState: 'active · v2',
  evidence: {
    label: 'Abrir evidencia técnica Testnet',
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${'a'.repeat(64)}`,
    contractRef: 'ctr_v2_Ab3…Kp9',
    eventRef: 'evt_v2_Q7m…N4c',
  },
  blockedReason: null,
};

assert.deepEqual(sanitizeV2EvidenceSnapshot(allowlisted, 'receipt-active', 'doctor'), allowlisted);

for (const tampered of [
  { ...allowlisted, viewerRole: 'admin' },
  { ...allowlisted, scenario: 'receipt-dispensed' },
  { ...allowlisted, finality: 'pending' },
  { ...allowlisted, reorgState: 'reconciling' },
  { ...allowlisted, health: 'stale' },
  { ...allowlisted, cursorLabel: 'patient@example.test' },
  { ...allowlisted, diagnosis: 'hidden extra field' },
  { ...allowlisted, evidence: { ...allowlisted.evidence!, diagnosis: 'hidden extra field' } },
  { ...allowlisted, evidence: { ...allowlisted.evidence!, explorerUrl: 'https://evil.example/explorer/testnet/tx/forged' } },
  { ...allowlisted, evidence: { ...allowlisted.evidence!, explorerUrl: `https://stellar.expert/explorer/public/tx/${'a'.repeat(64)}` } },
  { ...allowlisted, evidence: { ...allowlisted.evidence!, contractRef: 'C'.repeat(56) } },
]) {
  const result = sanitizeV2EvidenceSnapshot(tampered, 'receipt-active', 'doctor');
  assert.equal(result.health, 'unknown');
  assert.equal(result.finality, 'unknown');
  assert.equal(result.reorgState, 'blocked');
  assert.equal(result.evidence, null);
  assert.ok(result.blockedReason);
}

const throwingPort: V2ReadonlyEvidencePort = { readScenario() { throw new Error('RPC secret detail must not escape'); } };
const failed = readV2Evidence(throwingPort, 'admin-audit', 'admin');
assert.equal(failed.health, 'unknown');
assert.equal(failed.blockedReason, 'Lector read-only no disponible');
assert.doesNotMatch(JSON.stringify(failed), /RPC secret detail/);

const ui = readFileSync(new URL('../src/components/TrustAuthorizationReview.tsx', import.meta.url), 'utf8');
const model = readFileSync(new URL('../src/lib/v2ReadonlyEvidence.ts', import.meta.url), 'utf8');
const runbook = readFileSync(new URL('../docs/internal/v2-readonly-ui-e2e-runbook.md', import.meta.url), 'utf8');

assert.match(ui, /Puerto read-only sanitizado/);
assert.match(ui, /Freshness/);
assert.match(ui, /Cursor/);
assert.match(ui, /Finality/);
assert.match(ui, /Reorg/);
assert.match(ui, /data-reader-health/);
assert.match(ui, /role="status"/);
assert.match(ui, /rel="noreferrer"/);
assert.doesNotMatch(ui, /fetch\(|XMLHttpRequest|WebSocket|sendTransaction|signTransaction/i);
assert.doesNotMatch(model, /process\.env|localStorage|sessionStorage|document\.cookie/i);

for (const source of [JSON.stringify(LOCAL_V2_READONLY_EVIDENCE_PORT), runbook]) {
  assert.doesNotMatch(source, /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b|diagn[oó]stico|dosis|gramaje|private.?key|seed phrase/i);
}

console.log('v2-readonly-ui-e2e: sanitized port, fail-closed evidence, role scenarios and privacy negatives passed');
