import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { WaitlistAudience } from '../lib/waitlist';

const migrationFile = '20261122020000_cannabis_waitlist.sql';
const doctorsMigrationFile = '20261123170115_cannabis_waitlist_doctors.sql';

interface LocalWaitlistDatabase {
  readonly waitReady: Promise<void>;
  exec(sql: string): Promise<unknown>;
  query<T>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

export async function openLocalWaitlistStore(root: string) {
  const instance = process.env.TRUSTLEAF_LOCAL_WAITLIST_INSTANCE ?? 'local';
  if (!/^[a-z0-9-]{1,64}$/.test(instance)) throw new Error('INVALID_LOCAL_WAITLIST_INSTANCE');

  const requireLocalSql = createRequire(join(root, 'tests', 'sql', 'package.json'));
  const { PGlite } = requireLocalSql('@electric-sql/pglite') as { PGlite: new (dataDir: string) => LocalWaitlistDatabase };
  const dataDir = join(root, 'scratch', 'cannabis-waitlists', instance);
  await mkdir(dataDir, { recursive: true });
  const db = new PGlite(dataDir);

  try {
    await db.waitReady;
    const { rows } = await db.query<{ installed: boolean }>(
      "select to_regprocedure('public.trustleaf_cannabis_waitlist_signup(text,text)') is not null as installed",
    );
    if (!rows[0]?.installed) {
      await db.exec(`do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
      end $$;
      create schema if not exists trustleaf_private;
      revoke all on schema trustleaf_private from public, anon, authenticated, service_role;`);
      await db.exec(await readFile(join(root, 'supabase', 'migrations', migrationFile), 'utf8'));
    }
    const { rows: doctorSupport } = await db.query<{ installed: boolean }>(
      `select exists (
        select 1 from pg_constraint
        where conrelid = 'trustleaf_private.cannabis_waitlist'::regclass
          and conname = 'cannabis_waitlist_supported_audience_check'
      ) as installed`,
    );
    if (!doctorSupport[0]?.installed) {
      await db.exec(await readFile(join(root, 'supabase', 'migrations', doctorsMigrationFile), 'utf8'));
    }
    await db.exec('set role service_role');
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error;
  }

  return {
    async save({ audience, email }: { audience: WaitlistAudience; email: string }) {
      const { rows } = await db.query<{ result: { registered: boolean } }>(
        'select public.trustleaf_cannabis_waitlist_signup($1, $2) as result', [audience, email],
      );
      if (rows[0]?.result.registered !== true) throw new Error('LOCAL_WAITLIST_WRITE_FAILED');
    },
    close: () => db.close(),
  };
}
