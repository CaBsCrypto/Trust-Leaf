import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEPLOYED_TESTNET_RECEIPT_CONTRACT_ID,
  REVIEW_SCENARIOS,
  STELLAR_EXPERT_CONTRACT_URL,
  TESTNET_EVIDENCE_LINKS,
  parseReviewSelection,
  reviewSearch,
} from '../src/lib/testnetReviewEvidence.ts';
import { projectReadonlyReceiptForRole } from '../src/lib/readonlyRoleReceipt.ts';

assert.equal(DEPLOYED_TESTNET_RECEIPT_CONTRACT_ID, 'CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3');
assert.equal(STELLAR_EXPERT_CONTRACT_URL, `https://stellar.expert/explorer/testnet/contract/${DEPLOYED_TESTNET_RECEIPT_CONTRACT_ID}`);
assert.deepEqual(parseReviewSelection('?role=patient&scenario=revoked'), { role: 'patient', scenario: 'revoked' });
assert.deepEqual(parseReviewSelection('?role=attacker&scenario=forged'), { role: 'doctor', scenario: 'active' }, 'unknown URL input must fail to safe review defaults');
assert.equal(reviewSearch('dispensary', 'expired'), '?role=dispensary&scenario=expired');

assert.deepEqual(Object.keys(REVIEW_SCENARIOS).sort(), ['active', 'dispensed', 'expired', 'partial', 'revoked', 'unknown']);
assert.deepEqual(TESTNET_EVIDENCE_LINKS.map(item => item.state), ['issued', 'active', 'partial', 'dispensed', 'revoked', 'expired']);
for (const item of TESTNET_EVIDENCE_LINKS) assert.match(item.url, /^https:\/\/stellar\.expert\/explorer\/testnet\/tx\/[a-f0-9]{64}$/);
for (const role of ['doctor', 'patient', 'dispensary', 'admin'] as const) {
  const view = projectReadonlyReceiptForRole(role, REVIEW_SCENARIOS.active);
  assert.equal(view.mutationsAvailable, false);
  assert.equal(view.operationalDetailVisible, false);
}

const ui = readFileSync(new URL('../src/components/ReceiptPilotFlow.tsx', import.meta.url), 'utf8');
for (const roleLabel of ['Médico técnico', 'Paciente sintético', 'Dispensario técnico', 'Admin técnico']) assert.match(ui, new RegExp(roleLabel));
assert.match(ui, /Abrir contrato en Stellar Expert/);
assert.match(ui, /Revisión local · sin submissions/);
assert.match(ui, /onVerify\(view\.publicToken!\)/, 'patient QR navigation must pass only the opaque fixture token');
assert.match(ui, /window\.history\.replaceState/, 'role/scenario changes must produce a reproducible review URL');
assert.doesNotMatch(ui, /fetch\(|submitTransaction|sendTransaction|invokeContract|simulateTransaction|TRUSTLEAF_TESTNET_SUBMIT_ENABLED\s*=\s*true/i);
for (const forbidden of ['diagnóstico:', 'dosis:', 'gramaje:', 'privatekey', 'secret key']) assert.equal(ui.toLowerCase().includes(forbidden), false);

const env = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
assert.match(env, /^TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false$/m);
assert.match(env, /^TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false$/m);
console.log('ui-onchain-human-review: roles, deterministic routes, Testnet evidence links, privacy copy and no-write gates passed');
