import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const db = new PGlite();
let stage = 'schema';
const quote = value => `"${String(value).replaceAll('"', '""')}"`;
try {
  assert.equal(backup.project, 'zohgdvzjhxoviiwqyzgs');
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;`);
  for (const migration of backup.schemaMigrations) await db.exec(migration.sql);
  const columns = (await db.query(`select table_schema as schema,table_name as "table",column_name as "column",udt_name as type
    from information_schema.columns where table_schema='trustleaf_private' or (table_schema='public' and table_name like 'trustleaf_%')
    order by table_schema,table_name,ordinal_position`)).rows;
  assert.deepEqual(columns, backup.snapshot.columns, 'live columns must match the reviewed migration chain');
  stage = 'functions';
  for (const definition of backup.snapshot.functions) await db.exec(definition);
  stage = 'data';
  // This is an ephemeral in-process database, never a connection to Supabase.
  await db.exec('set session_replication_role=replica');
  let rows = 0;
  for (const [name, records] of Object.entries(backup.snapshot.tables)) {
    const table = name.split('.').map(quote).join('.');
    await db.exec(`delete from ${table}`);
    await db.query(`insert into ${table} overriding system value select * from jsonb_populate_recordset(null::${table},$1::jsonb)`, [JSON.stringify(records)]);
    assert.equal(Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n), records.length);
    rows += records.length;
  }
  await db.exec('set session_replication_role=origin');
  stage = 'integrity';
  const fks = (await db.query(`select n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) as definition
    from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
    where k.contype='f' and (n.nspname='trustleaf_private' or (n.nspname='public' and c.relname like 'trustleaf_%'))`)).rows;
  for (const fk of fks) await db.exec(`alter table ${quote(fk.nspname)}.${quote(fk.relname)} drop constraint ${quote(fk.conname)};
    alter table ${quote(fk.nspname)}.${quote(fk.relname)} add constraint ${quote(fk.conname)} ${fk.definition}`);
  for (const sequence of backup.snapshot.sequences) if (sequence.last_value !== null) {
    await db.query('select setval($1::regclass,$2::bigint,true)', [`${sequence.schemaname}.${sequence.sequencename}`, sequence.last_value]);
  }
  console.log(JSON.stringify({ tables: Object.keys(backup.snapshot.tables).length, rows, verified: true }));
} catch {
  // Provider records and constraint errors can contain private data.
  console.error(`APPLICATION_BACKUP_RESTORE_FAILED:${stage}`); process.exitCode = 1;
} finally { await db.close(); }
