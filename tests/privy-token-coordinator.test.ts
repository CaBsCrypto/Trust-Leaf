import assert from 'node:assert/strict';
import { createPrivyTokenCoordinator } from '../src/lib/privyTokenCoordinator.ts';

function deferred() {
  let resolve!: (value: string | null) => void;
  const promise = new Promise<string | null>(done => { resolve = done; });
  return { promise, resolve };
}
const initial = deferred(); const renewed = deferred();
let reads = 0; let refreshes = 0;
const tokens = createPrivyTokenCoordinator(
  () => { reads++; return initial.promise; },
  () => { refreshes++; return renewed.promise; },
);
const first = tokens.read();
assert.equal(tokens.read(), first);
const refresh = tokens.refresh();
assert.equal(tokens.refresh(), refresh);
assert.equal(tokens.read(), refresh);
assert.equal(refreshes, 0);
initial.resolve('old'); await first;
await Promise.resolve();
renewed.resolve('new');
assert.equal(await refresh, 'new');
assert.equal(reads, 1); assert.equal(refreshes, 1);

const late = deferred();
const scoped = createPrivyTokenCoordinator(() => late.promise, async () => 'unused');
const obsolete = scoped.read(); const queuedRefresh = scoped.refresh();
scoped.invalidate(); late.resolve('wrong-account');
assert.equal(await obsolete, null); assert.equal(await queuedRefresh, null);
assert.equal(await scoped.read(), null);
assert.equal(await scoped.refresh(), null);
scoped.activate();
assert.equal(await scoped.refresh(), 'unused');

let attempts = 0;
const recovery = createPrivyTokenCoordinator(async () => {
  if (++attempts === 1) throw new Error('temporary');
  return 'recovered';
}, async () => null);
await assert.rejects(recovery.read(), /temporary/);
assert.equal(await recovery.read(), 'recovered');
console.log('PASS token single-flight, serialized refresh, stale result rejection and failure recovery');
