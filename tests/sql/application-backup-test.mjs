import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { operationsDatabase } from './operations-db.mjs';
import { joinTeam } from './team-fixtures.mjs';
import { randomUUID } from 'node:crypto';

const { db, call, subjects } = await operationsDatabase();
try {
  await call('dispensary', 'join', { acceptSyntheticOnly: true });
  await call('dispensary', 'create-organization', { name: 'Backup fixture', operationId: randomUUID() });
  await joinTeam(db, subjects.dispensary, subjects.operator);
  await db.exec('reset role');
  const tableRows = (await db.query("select table_schema,table_name from information_schema.tables where table_type='BASE TABLE' and (table_schema='trustleaf_private' or (table_schema='public' and table_name like 'trustleaf_%')) order by table_schema,table_name")).rows;
  const tables = {};
  for (const t of tableRows) tables[`${t.table_schema}.${t.table_name}`] = (await db.query(`select to_jsonb(t) as row from ${t.table_schema}.${t.table_name} t`)).rows.map(x => x.row);
  const columns = (await db.query(`select table_schema as schema,table_name as "table",column_name as "column",udt_name as type from information_schema.columns
    where table_schema='trustleaf_private' or (table_schema='public' and table_name like 'trustleaf_%') order by table_schema,table_name,ordinal_position`)).rows;
  const functions = (await db.query(`select pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f' and (n.nspname='trustleaf_private' or (n.nspname='public' and p.proname like 'trustleaf_%'))`)).rows.map(x => x.definition);
  const sequences = (await db.query("select * from pg_sequences where schemaname='trustleaf_private'")).rows;
  const migrations = new URL('../../supabase/migrations/', import.meta.url);
  const schemaMigrations = [];
  for (const name of (await readdir(migrations)).filter(n => n.endsWith('.sql') && n !== '20260906120000_monthly_dispensing_quota.sql').sort()) {
    schemaMigrations.push({ version: name.slice(0, 14), sql: await readFile(new URL(name, migrations), 'utf8') });
  }
  const payload = { project: 'zohgdvzjhxoviiwqyzgs', schemaMigrations, snapshot: { tables, columns, functions, sequences } };
  const run = value => spawnSync(process.execPath, [fileURLToPath(new URL('./verify-application-backup.mjs', import.meta.url))], { input: JSON.stringify(value, (_, field) => typeof field === 'bigint' ? field.toString() : field), encoding: 'utf8', windowsHide: true, timeout: 60000 });
  const success = run(payload);
  assert.equal(success.status, 0, success.stderr);
  const verified = JSON.parse(success.stdout);
  assert.equal(verified.tables, tableRows.length);
  assert.equal(verified.rows, Object.values(tables).reduce((sum, rows) => sum + rows.length, 0));
  const mismatch = run({ ...payload, snapshot: { ...payload.snapshot, columns: [] } });
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /APPLICATION_BACKUP_RESTORE_FAILED:schema/);
  console.log('PASS: synthetic application backup restores schema, functions, records, foreign keys and sequences; schema mismatch fails without printing rows.');
} finally { await db.close(); }
