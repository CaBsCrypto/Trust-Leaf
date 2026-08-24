import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDurableReadonlyReceiptIndexer, createMemoryDurableReceiptIndexerStore } from '../api/_lib/durable-readonly-receipt-indexer.ts';
import { createReceiptEventSource } from '../api/_lib/stellar-receipt-event-source.ts';
import { getTechnicalAdminFixture } from '../src/lib/technicalAdminFixtures.ts';
import { projectReadonlyReceiptForRole, publicReadonlyProjection, type ReadonlyReceiptFixture, type ReadonlyRole } from '../src/lib/readonlyRoleReceipt.ts';

const hash = (digit: string) => digit.repeat(64);
const receiptId = 'opaque_receipt_role_e2e';
const event = (version: number, state: 'issued' | 'active' | 'partial' | 'dispensed' | 'revoked' | 'expired', suffix = String(version)) => ({
  eventId: `opaque_event_role_${suffix.padStart(4, '0')}`,
  receiptId,
  operationId: `opaque_operation_role_${suffix.padStart(4, '0')}`,
  version,
  state,
});
const ledger = (sequence: number, ledgerHash: string, parentHash: string, events: ReturnType<typeof event>[] = []) => ({ sequence, hash: ledgerHash, parentHash, closedAt: 1_780_000_000 + sequence, events });

// Durable port: recover, await async ingest, restart, idempotent replay and canonical reorg.
const store = createMemoryDurableReceiptIndexerStore();
const first = createDurableReadonlyReceiptIndexer({ store, finalityDepth: 1, now: () => 1_780_000_000_000 });
await first.recover();
assert.deepEqual(first.getHealth(), { mode: 'read-only', durable: false, recovered: true, revision: 0, ledgerCount: 0 });
const metrics = { increment() {} };
let delivered = false;
const source = createReceiptEventSource({
  mode: 'fixture', contractId: `C${'A'.repeat(55)}`, metrics,
  ingest: async value => { await Promise.resolve(); await first.ingest(value); delivered = true; },
  getCursor: first.getCursor,
  transport: { kind: 'fixture', async fetchNext() { return { status: 'ledger', contractId: `C${'A'.repeat(55)}`, schemaVersion: 1, ledger: ledger(100, hash('1'), hash('0'), [event(1, 'issued')]) }; } },
});
assert.equal((await source.pollOnce()).status, 'ingested');
assert.equal(delivered, true, 'event source must await durable commit before reporting ingested');
assert.equal(first.getCursor()?.sequence, 100);

const restarted = createDurableReadonlyReceiptIndexer({ store, finalityDepth: 1 });
await restarted.recover();
assert.equal(restarted.getCursor()?.hash, hash('1'), 'cursor must recover from the durable port');
assert.equal(restarted.getReceiptTimeline(receiptId)[0]?.state, 'issued');
assert.equal(await restarted.ingest(ledger(100, hash('1'), hash('0'), [event(1, 'issued')])), 'replayed');
await restarted.ingest(ledger(101, hash('2'), hash('1'), [event(2, 'active')]));
assert.equal(restarted.getReceiptTimeline(receiptId).at(-1)?.state, 'active');
await assert.rejects(() => restarted.ingest(ledger(103, hash('3'), hash('2'))), (error: any) => error.code === 'LEDGER_GAP');
assert.equal(restarted.getCursor()?.sequence, 101, 'invalid gap must not advance durable cursor');
await assert.rejects(() => restarted.ingest(ledger(99, hash('9'), hash('8'))), (error: any) => error.code === 'INDEXER_SEQUENCE_REJECTED');
assert.equal(restarted.getCursor()?.sequence, 101, 'unknown stale ledger must not rewind the durable cursor');
await restarted.ingest(ledger(101, hash('a'), hash('1'), [event(2, 'revoked', 'fork')]));
assert.equal(restarted.getCursor()?.hash, hash('a'));
assert.deepEqual(restarted.getReceiptTimeline(receiptId).map(item => item.state), ['issued', 'revoked']);

// Role/state projections expose only opaque technical state and never a mutation capability.
const roles: ReadonlyRole[] = ['doctor', 'patient', 'dispensary', 'admin'];
const states: ReadonlyReceiptFixture['state'][] = ['issued', 'active', 'partial', 'dispensed', 'revoked', 'expired', 'unknown'];
for (const state of states) {
  const fixture: ReadonlyReceiptFixture = {
    opaqueReceiptRef: 'rcpt_7yH4mJ2qP8vN6kL3', state, version: 1, finality: state === 'unknown' ? 'unknown' : 'confirmed',
    timeline: state === 'unknown' ? [] : [{ version: 1, state }], publicToken: 'tl_demo_fixture',
  };
  for (const role of roles) {
    const view = projectReadonlyReceiptForRole(role, fixture);
    assert.equal(view.mutationsAvailable, false);
    assert.equal(view.operationalDetailVisible, false);
    assert.equal('publicToken' in view, role === 'patient', 'QR token is visible only to the patient fixture role');
    assert.equal('timeline' in view, role === 'doctor' || role === 'dispensary', 'technical timeline is limited by role');
  }
  assert.deepEqual(Object.keys(publicReadonlyProjection(fixture)).sort(), ['demo', 'evidenceExists', 'proofMatches', 'status']);
}

// Minimal admin panel is deny-by-default and contains only opaque fixture references.
assert.deepEqual(getTechnicalAdminFixture({ authenticated: false, roles: ['admin'], scopes: ['admin:readiness:read'] }), { mode: 'denied', mutationsAvailable: false });
assert.equal(getTechnicalAdminFixture({ authenticated: true, roles: ['doctor'], scopes: ['admin:readiness:read'] }).mode, 'denied');
assert.equal(getTechnicalAdminFixture({ authenticated: true, roles: ['admin'], scopes: ['receipt:read'] }).mode, 'denied');
const admin = getTechnicalAdminFixture({ authenticated: true, roles: ['admin'], scopes: ['admin:readiness:read'] });
assert.equal(admin.mode, 'synthetic-read-only');
assert.equal(admin.mutationsAvailable, false);
const serialized = JSON.stringify(admin);
for (const forbidden of ['@', 'rut', 'diagnos', 'dose', 'gram', 'wallet', 'address', 'secret', 'privateKey']) assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, `admin fixture leaked forbidden marker: ${forbidden}`);

const adminUi = readFileSync(new URL('../src/components/TechnicalAdminOversightPanel.tsx', import.meta.url), 'utf8');
assert.match(adminUi, /disabled>Verificar actor/);
assert.match(adminUi, /disabled>Suspender actor/);
assert.match(adminUi, /disabled>Resolver alerta/);
const readinessUi = readFileSync(new URL('../src/components/AdminReadinessPanel.tsx', import.meta.url), 'utf8');
assert.ok(readinessUi.indexOf('<TechnicalAdminOversightPanel') > readinessUi.indexOf('if (!state)'), 'technical admin fixture must render only after server-side admin readiness authorization succeeds');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
assert.ok(app.indexOf('<AdminReadinessPanel') > app.indexOf('if (hasRealAdminSession && adminAuth.user)'), 'admin readiness must remain behind the authenticated admin branch');
for (const sourceText of [adminUi, readFileSync(new URL('../api/_lib/durable-readonly-receipt-indexer.ts', import.meta.url), 'utf8')]) {
  assert.equal(/submitTransaction|sendTransaction|invokeContract|TRUSTLEAF_TESTNET_SUBMIT_ENABLED\s*=\s*true/i.test(sourceText), false);
}
const eventSourceText = readFileSync(new URL('../api/_lib/stellar-receipt-event-source.ts', import.meta.url), 'utf8');
assert.match(eventSourceText, /server\.getLedgers/);
assert.match(eventSourceText, /server\.getEvents/);
assert.equal(/submitTransaction|sendTransaction|simulateTransaction|invokeContract/i.test(eventSourceText), false, 'Stellar event transport must expose no RPC write primitive');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
assert.match(envExample, /^TRUSTLEAF_TESTNET_SUBMIT_ENABLED=false$/m);
assert.match(envExample, /^TRUSTLEAF_ALLOW_TESTNET_MUTATIONS=false$/m);

console.log('readonly-indexer-role-e2e: durable recovery/reorg, async commit, all role states, admin deny-by-default and forbidden-data checks passed');
