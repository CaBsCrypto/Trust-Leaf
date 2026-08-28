import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOpaqueDemoHandle, DEMO_PUBLIC_VERIFICATION_TOKENS, demoPublicReceiptVerifier, resetPublicVerificationDemoState } from '../src/lib/publicVerification.ts';

const allowed = ['demo', 'evidenceExists', 'proofMatches', 'status'].sort();
const forbidden = /rut|name|patient|doctor|diagnos|dose|gram|quantity|dispens|history|wallet|address|contract|timestamp|expiresAt|issuedBy/i;

resetPublicVerificationDemoState();
const statuses = new Set<string>();
for (const [index, token] of DEMO_PUBLIC_VERIFICATION_TOKENS.entries()) {
  const result = await demoPublicReceiptVerifier.verify(token, `positive-${index}`);
  assert.deepEqual(Object.keys(result).sort(), allowed);
  assert.equal(result.evidenceExists, true);
  assert.equal(result.proofMatches, true);
  assert.equal(forbidden.test(JSON.stringify(result)), false);
  statuses.add(result.status);
  assert.ok(token.split('.')[0].length >= 40, 'fixture handle must be opaque and non-sequential');
}
assert.deepEqual([...statuses].sort(), ['active', 'expired', 'revoked']);
const generatedHandles = new Set(Array.from({ length: 32 }, () => createOpaqueDemoHandle()));
assert.equal(generatedHandles.size, 32, 'CSPRNG demo handles must not repeat in the sample');
for (const handle of generatedHandles) assert.match(handle, /^tl_demo_[A-Za-z0-9_-]{32}$/);

const valid = DEMO_PUBLIC_VERIFICATION_TOKENS[0];
const invalidTokens = ['1', 'someone@example.com', '12.345.678-9', `${valid.slice(0, -1)}A`, 'tl_demo_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'];
const envelopes = [];
for (const [index, token] of invalidTokens.entries()) {
  const result = await demoPublicReceiptVerifier.verify(token, `negative-${index}`);
  assert.deepEqual(Object.keys(result).sort(), allowed);
  assert.deepEqual(result, { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' });
  assert.equal(JSON.stringify(result).includes(token), false);
  envelopes.push(JSON.stringify(result));
}
assert.equal(new Set(envelopes).size, 1);

const first = await demoPublicReceiptVerifier.verify(valid, 'idempotent-read');
const replay = await demoPublicReceiptVerifier.verify(`${valid}tampered`, 'idempotent-read');
assert.deepEqual(replay, { demo: true, evidenceExists: false, proofMatches: false, status: 'unavailable' }, 'operation key reuse must not substitute a different token');
const exactReplay = await demoPublicReceiptVerifier.verify(valid, 'idempotent-read');
assert.deepEqual(exactReplay, first, 'exact read replay is idempotent');

const component = readFileSync(new URL('../src/components/PrescriptionVerifier.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
for (const leakedIdentifier of ['patientAddress', 'issuedBy', 'totalQuantity', 'dispensedQuantity', 'remainingQuantity', 'contractId']) {
  assert.equal(component.includes(leakedIdentifier), false, `public component must not use ${leakedIdentifier}`);
}
assert.equal(component.includes('/api/stellar/prescription/'), false, 'public mock must not call the legacy endpoint');
assert.equal(component.includes('stellar.expert'), false, 'public mock must not expose a ledger link');
assert.equal(app.includes("path.match(/^\\/verify\\/([\\w-]+)/)"), false, 'numeric/enumerable legacy route must remain removed');
assert.equal(app.includes("path.match(/^\\/verify\\/([^/]+)$/)"), true, 'all single-segment invalid inputs must reach the same unavailable view');
const portal = readFileSync(new URL('../src/components/MockupPortal.tsx', import.meta.url), 'utf8');
assert.equal(portal.includes('verify/${prescriptionId}'), false, 'QR generator must not use numeric prescription IDs');
console.log('public-verification: minimized positive and negative contracts passed');
