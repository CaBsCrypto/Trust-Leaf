import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
try {
  // Identity resolver is a fixture; the central connection migration is unmodified.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create function public.trustleaf_resolve_privy_actor(text) returns table(role text, actor_state text)
    language sql as $$ select case when $1 like 'admin%' then 'admin' else 'doctor' end, 'active'::text $$;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20260907020000_central_calendar_connection.sql',import.meta.url),'utf8'));
  const rpc = async (a,s='',k='',v='',r='service_role') => {
    await db.exec(`set role ${r}`);
    try { return (await db.query('select public.trustleaf_central_calendar_connection($1,$2,$3,$4) as value',[a,s,k,v])).rows[0].value; }
    finally { await db.exec('reset role'); }
  };
  await assert.rejects(rpc('start','doctor','x','cipher'));
  for (const r of ['anon','authenticated']) await assert.rejects(rpc('status','admin','','',r));
  await rpc('start','admin','first','cipher');
  await rpc('start','admin2','second','cipher2');
  await assert.rejects(rpc('consume','','first'));
  assert.equal((await rpc('consume','','second')).subject,'admin2');
  await assert.rejects(rpc('consume','','second'));
  await rpc('save','admin','','cipher');
  await rpc('save','admin2','','cipher2');
  assert.equal((await db.query('select count(*)::int as n from public.trustleaf_central_calendar')).rows[0].n,1);
  assert.deepEqual(await rpc('status','admin'),{connected:true});
  await assert.rejects(rpc('status','doctor'));
  console.log('PASS: central singleton, admin restrictions, nonce replacement and replay');
} finally { await db.close(); }
