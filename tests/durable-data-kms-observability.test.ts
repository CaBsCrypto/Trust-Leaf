import assert from 'node:assert/strict';
import { createInMemoryEncryptedRepository, createInMemoryKeyCustody, createEncryptedDurableStore, createOpaqueMappingId, loadDurableStoreConfig } from '../api/_lib/durable-encrypted-store.ts';
import { createFixedWindowRateLimiter, redactForLog } from '../api/_lib/safe-operational-controls.ts';

assert.throws(() => loadDurableStoreConfig({}), /DURABLE_STORE_MODE_REQUIRED/);
assert.throws(() => loadDurableStoreConfig({ TRUSTLEAF_DURABLE_STORE_MODE: 'postgres', TRUSTLEAF_RETENTION_DAYS: '30' }), /POSTGRES_URL_REQUIRED/);
assert.deepEqual(loadDurableStoreConfig({ TRUSTLEAF_DURABLE_STORE_MODE: 'memory-fixture', TRUSTLEAF_RETENTION_DAYS: '30' }).mode, 'memory-fixture');

const namespace = Buffer.alloc(32, 3); const id = createOpaqueMappingId(namespace, 'synthetic-case-0001');
assert.equal(id, createOpaqueMappingId(namespace, 'synthetic-case-0001')); assert.doesNotMatch(id, /synthetic-case/);
const kms = createInMemoryKeyCustody({ 'fixture-kek': Buffer.alloc(32, 7) }); const repository = createInMemoryEncryptedRepository();
let clock = new Date('2026-08-22T12:00:00Z'); const store = createEncryptedDurableStore(repository, kms, 'fixture-kek', () => clock);
await store.put(id, null, { fixture: true, state: 'active', syntheticUnits: 2 });
const row1 = (await repository.read(id))!; assert.doesNotMatch(JSON.stringify(row1), /active|syntheticUnits/); assert.equal(row1.key.keyVersion, 1);
assert.deepEqual(await store.get(id), { fixture: true, state: 'active', syntheticUnits: 2 });
await assert.rejects(store.put(id, 0, { fixture: true, state: 'partial' }), /REVISION_CONFLICT/);
await assert.rejects(store.put(createOpaqueMappingId(namespace, 'synthetic-case-0002'), null, { fixture: true, patientName: 'not-allowed' }), /FORBIDDEN_DATA_FIELD/);
await assert.rejects(store.put(createOpaqueMappingId(namespace, 'synthetic-case-0002b'), null, { fixture: true, nested: { medication: 'not-allowed' } }), /FORBIDDEN_DATA_FIELD/);

// Change a fully significant base64url character. Mutating the final character
// can alter only unused padding bits and intermittently decode to the same tag.
const tampered = { ...row1, tag: `${row1.tag.startsWith('A') ? 'B' : 'A'}${row1.tag.slice(1)}` };
await repository.compareAndSwap(id, 1, tampered); await assert.rejects(store.get(id)); await repository.compareAndSwap(id, 1, row1);
const otherId = createOpaqueMappingId(namespace, 'synthetic-case-0003');
await repository.compareAndSwap(otherId, null, { ...row1, opaqueId: otherId });
await assert.rejects(store.get(otherId));

kms.rotate('fixture-kek', Buffer.alloc(32, 8)); clock = new Date('2026-08-22T12:01:00Z'); assert.equal(await store.rewrap(id), true);
assert.equal((await repository.read(id))!.key.keyVersion, 2); assert.deepEqual(await store.get(id), { fixture: true, state: 'active', syntheticUnits: 2 }); assert.equal(await store.rewrap(id), false);
await store.put(id, 1, { fixture: true, state: 'partial', syntheticUnits: 1 }); assert.equal(await store.verifyAuditChain(), true);
const actions = (await repository.audits()).map(entry => entry.action); assert.deepEqual(actions, ['create', 'rewrap', 'update']);

const concurrentId = createOpaqueMappingId(namespace, 'synthetic-case-0004');
const concurrent = await Promise.allSettled([store.put(concurrentId, null, { fixture: true, worker: 1 }), store.put(concurrentId, null, { fixture: true, worker: 2 })]);
assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1); assert.equal(concurrent.filter(result => result.status === 'rejected' && /REVISION_CONFLICT/.test(String(result.reason))).length, 1);

const logged = redactForLog({ authorization: 'Bearer abc.def', nested: { email: 'fixture@example.invalid', message: 'key SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } });
assert.equal(JSON.stringify(logged).includes('fixture@example.invalid'), false); assert.equal(JSON.stringify(logged).includes('SAAAA'), false);
const limiter = createFixedWindowRateLimiter(2, 1_000, 1); assert.equal(limiter.check('role:fixture', 0).allowed, true); assert.equal(limiter.check('role:fixture', 1).allowed, true); assert.deepEqual(limiter.check('role:fixture', 2), { allowed: false, retryAfterMs: 998, remaining: 0 }); assert.equal(limiter.check('new-subject', 2).allowed, false); assert.equal(limiter.check('role:fixture', 1_000).allowed, true);

console.log('durable-data-kms-observability: encryption/AAD/tamper/rotation/CAS/audit/redaction/rate-limit gates passed');
