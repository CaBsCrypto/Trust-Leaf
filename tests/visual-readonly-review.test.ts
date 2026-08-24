import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  projectReadonlyReceiptForRole,
  publicReadonlyProjection,
  SYNTHETIC_READONLY_RECEIPT,
  type ReadonlyRole,
} from '../src/lib/readonlyRoleReceipt.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const pilot = read('../src/components/ReceiptPilotFlow.tsx');
const rolePanel = read('../src/components/ReadonlyRoleReceiptPanel.tsx');
const verifier = read('../src/components/PrescriptionVerifier.tsx');
const envExample = read('../.env.example');
const smokeEvidence = read('../docs/internal/testnet-receipt-smoke-evidence-20260822.md');
const runbook = read('../docs/internal/visual-readonly-e2e-runbook-20260824.md');
const backlog = read('../docs/internal/visual-readonly-ux-backlog-20260824.md');

assert.match(app, /path === '\/demo\/receipt-pilot'/, 'the consolidated visual review route must remain navigable');
assert.match(app, /path\.match\(\/\^\\\/verify\\\/\(\[\^\/\]\+\)\$\//, 'the opaque public verifier route must remain navigable');
assert.match(app, /navigate\(`\/verify\/\$\{encodeURIComponent\(token\)\}`\)/, 'QR navigation must encode only its opaque token');

for (const label of ['Médico técnico', 'Paciente sintético', 'Dispensario técnico', 'Admin técnico']) {
  assert.match(pilot, new RegExp(label), `pilot must expose the ${label} fixture role`);
}
for (const label of ['Médico', 'Paciente', 'Dispensario', 'Admin']) {
  assert.match(rolePanel, new RegExp(`${label}`), `read-only panel must expose the ${label} projection`);
}
assert.match(pilot, /Revisión local · sin submissions/);
assert.match(pilot, /Vista sintética y local/);
assert.match(pilot, /Abrir contrato en Stellar Expert/);
assert.match(pilot, /Escenario visible/);
assert.match(rolePanel, /Operaciones<\/dt><dd className="font-bold">Bloqueadas/);
assert.doesNotMatch(pilot + rolePanel, /submitTransaction|sendTransaction|invokeContract|signAndSubmit/i, 'visual review surfaces must not contain submission primitives');

const roles: ReadonlyRole[] = ['doctor', 'patient', 'dispensary', 'admin'];
const views = Object.fromEntries(roles.map(role => [role, projectReadonlyReceiptForRole(role, SYNTHETIC_READONLY_RECEIPT)]));
for (const role of roles) {
  assert.equal(views[role].mode, 'synthetic-read-only');
  assert.equal(views[role].mutationsAvailable, false);
  assert.equal(views[role].operationalDetailVisible, false);
}
assert.ok(views.doctor.timeline && views.doctor.timeline.length === 3);
assert.ok(views.dispensary.timeline && views.dispensary.timeline.length === 3);
assert.equal(views.patient.timeline, undefined);
assert.equal(views.patient.publicToken, SYNTHETIC_READONLY_RECEIPT.publicToken);
assert.equal(views.admin.timeline, undefined);
assert.equal(views.admin.publicToken, undefined);

const publicView = publicReadonlyProjection(SYNTHETIC_READONLY_RECEIPT);
assert.deepEqual(Object.keys(publicView).sort(), ['demo', 'evidenceExists', 'proofMatches', 'status']);
assert.deepEqual(publicView, { demo: true, evidenceExists: true, proofMatches: true, status: 'active' });
for (const forbidden of ['identidad', 'ficha', 'diagnóstico', 'medicamento', 'dosis', 'gramaje', 'saldo', 'historial']) {
  assert.match(verifier, new RegExp(forbidden, 'i'), `public UI must explicitly state that ${forbidden} is excluded`);
}

assert.match(envExample, /^TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false$/m);
assert.match(envExample, /^TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false$/m);
assert.match(smokeEvidence, /CA7SCEMQM4VETVCDD6RKO5RE7TCFG2HJD3PKW6EPD325IRDXJWF5OSY3/);
for (const state of ['Issued', 'Active', 'Partial', 'Dispensed', 'Revoked', 'Expired']) {
  assert.match(smokeEvidence, new RegExp(`\\[${state}\\]\\(https://stellar\\.expert/explorer/testnet/tx/`));
}

for (const required of [
  'http://localhost:3000/demo/receipt-pilot',
  '1440 × 900',
  '390 × 844',
  'teclado',
  'movimiento reducido',
  'Stellar Expert',
  'NO-GO',
]) assert.match(runbook, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
assert.match(backlog, /P0/);
assert.match(backlog, /P1/);
assert.match(backlog, /simulación local/i);

console.log('visual-readonly-review: routes, roles, public minimization, kill-switches, evidence and runbook passed');
