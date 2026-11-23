import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createServer, normalizePath } from 'vite';

const checkout = fileURLToPath(new URL('../../', import.meta.url));
const instance = `qa-${randomUUID()}`;
const dataDir = join(checkout, 'scratch', 'cannabis-waitlists', instance);
const port = 5221;
const origin = `http://127.0.0.1:${port}`;
const endpoint = `${origin}/api/cannabis-waitlist`;
const normalizedEmail = 'waitlist-persistence@example.test';
const audiences = ['patient', 'doctor', 'dispensary'];
process.env.TRUSTLEAF_LOCAL_WAITLIST_INSTANCE = instance;

async function withServer(run) {
  const server = await createServer({
    root: checkout,
    configFile: join(checkout, 'vite.visual.config.ts'),
    mode: 'waitlist-local',
    logLevel: 'silent',
    server: { host: '127.0.0.1', port, strictPort: true },
  });

  try {
    await server.listen();
    await run();
  } finally {
    await server.close();
  }
}

function signup(audience, email, requestOrigin = origin) {
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
    body: JSON.stringify({ audience, email }),
    signal: AbortSignal.timeout(15_000),
  });
}

async function expectRegistered(audience, email) {
  const response = await signup(audience, email);
  assert.equal(response.status, 200, `successful registration in the ${audience} list`);
  assert.deepEqual(await response.json(), { registered: true }, 'the response exposes only the registration result');
  assert.match(response.headers.get('cache-control') ?? '', /\bno-store\b/);
}

async function storedCounts() {
  const db = new PGlite(dataDir);
  try {
    const { rows } = await db.query(`
      select audience, count(*)::int as total,
        count(*) filter (where email = $1)::int as normalized,
        min(created_at)::text as created_at
      from trustleaf_private.cannabis_waitlist
      group by audience
      order by audience
    `, [normalizedEmail]);
    return rows;
  } finally {
    await db.close();
  }
}

async function expectPrivateFiles() {
  const file = join(dataDir, 'PG_VERSION');
  assert.ok((await stat(file)).isFile(), 'the private database file should exist during the test');

  const paths = [`/scratch/cannabis-waitlists/${instance}/PG_VERSION`, `/@fs/${encodeURI(normalizePath(file))}`];
  for (const path of paths) {
    const response = await fetch(`${origin}${path}`, {
      headers: { Accept: 'application/octet-stream' },
      signal: AbortSignal.timeout(15_000),
    });
    assert.ok([403, 404].includes(response.status), 'Vite must refuse direct requests for private database files');
    await response.body?.cancel();
  }
}

await withServer(async () => {
  const foreign = await signup('patient', 'foreign-origin@example.test', 'http://127.0.0.1:5222');
  assert.equal(foreign.status, 403, 'a different origin cannot submit');
  await foreign.body?.cancel();
  const invalid = await signup('other', 'invalid-audience@example.test');
  assert.equal(invalid.status, 400, 'an invalid audience cannot submit');
  await invalid.body?.cancel();
  const method = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
  assert.equal(method.status, 405, 'the endpoint does not list stored addresses');
  await method.body?.cancel();

  for (const audience of audiences) {
    await expectRegistered(audience, ` ${normalizedEmail.toUpperCase()} `);
    await expectRegistered(audience, normalizedEmail);
  }
  await expectPrivateFiles();
});

const beforeRestart = await storedCounts();
assert.deepEqual(beforeRestart.map(({ audience, total, normalized }) => ({ audience, total, normalized })), [
  { audience: 'dispensary', total: 1, normalized: 1 },
  { audience: 'doctor', total: 1, normalized: 1 },
  { audience: 'patient', total: 1, normalized: 1 },
]);
assert.ok(beforeRestart.every(row => row.created_at), 'each signup has its own creation timestamp');

await withServer(async () => {
  for (const audience of audiences) await expectRegistered(audience, normalizedEmail);
  await expectPrivateFiles();
});

assert.deepEqual(await storedCounts(), beforeRestart, 'restarting preserves all original signups and their timestamps');
console.log('PASS: all three private signup records survived a local Vite restart, with normalization, deduplication and file isolation.');
