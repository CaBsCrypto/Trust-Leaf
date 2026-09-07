import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../../supabase/migrations/20260907010000_google_calendar_connection.sql', import.meta.url), 'utf8'));
  async function rpc(action, subject = '', key = '', value = '', role = 'service_role') {
    await db.exec(`set role ${role}`);
    try { return (await db.query('select public.trustleaf_calendar_connection($1,$2,$3,$4) as result', [action, subject, key, value])).rows[0].result; }
    finally { await db.exec('reset role'); }
  }
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(rpc('status', 'doctor', '', '', role));
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from public.trustleaf_calendar_connections'));
    await db.exec('reset role');
  }
  await rpc('start', 'doctor', 'hash', 'ciphertext');
  await assert.rejects(rpc('consume', '', 'wrong-browser'));
  assert.deepEqual(await rpc('consume', '', 'hash'), { subject: 'doctor', payload: 'ciphertext' });
  await assert.rejects(rpc('consume', '', 'hash'));
  await rpc('start', 'doctor', 'old', 'ciphertext');
  await rpc('start', 'doctor', 'new', 'ciphertext');
  await assert.rejects(rpc('consume', '', 'old'));
  await db.exec("update public.trustleaf_calendar_oauth set expires_at = now() - interval '1 minute'");
  await assert.rejects(rpc('consume', '', 'new'));
  await rpc('save', 'doctor', '', 'encrypted-refresh');
  assert.deepEqual(await rpc('status', 'doctor'), { connected: true });
  assert.deepEqual(await rpc('status', 'other'), { connected: false });
  console.log('PASS: SQL permissions, one-use state, expiry, replacement and isolated connection status');
} finally { await db.close(); }
