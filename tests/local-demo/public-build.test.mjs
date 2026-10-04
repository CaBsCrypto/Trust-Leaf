import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
const files = await readdir(new URL('../../dist/assets/', import.meta.url));
for (const name of files.filter(name => /\.(js|css)$/.test(name))) {
  const body = await readFile(new URL('../../dist/assets/' + name, import.meta.url), 'utf8');
  assert.ok(!/LOCAL_DEMO_READY|LOCAL_CONTEXT_EXPIRED|local-demo-invited-actor|newmanager@example\.test/.test(body), 'local demo marker in published asset: ' + name);
}
const entry = await readFile(new URL('../../src/main.tsx', import.meta.url), 'utf8');
assert.ok(!entry.includes('local-demo'));
console.log('PASS compiled product contains no local entry, controls or synthetic demo identity markers.');
