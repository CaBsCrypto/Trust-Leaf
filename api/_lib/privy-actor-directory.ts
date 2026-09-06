import { createPrivyRbacAuthorizer, createSupabasePrivyActorStore } from './privy-supabase-rbac.ts';
import type { PrivyIdentity } from './privy-identity.ts';

const PAGE_SIZE = 25;

export async function readActorDirectory(input: {
  token: string;
  offset: number;
  env: Record<string, string | undefined>;
  verifier: { verify(token: string): Promise<PrivyIdentity> };
  fetcher?: typeof fetch;
}) {
  const fetcher = input.fetcher ?? fetch;
  if (!Number.isSafeInteger(input.offset) || input.offset < 0 || input.offset > 100000) throw new Error('INVALID_PAGE');
  const store = createSupabasePrivyActorStore(input.env, fetcher);
  const admin = await createPrivyRbacAuthorizer({ verifier: input.verifier, store }).authorize(input.token, ['admin']);
  const response = await fetcher(new URL('/rest/v1/rpc/trustleaf_privy_actor_directory', input.env.SUPABASE_URL ?? input.env.VITE_SUPABASE_URL), {
    method: 'POST',
    headers: { apikey: (input.env.SUPABASE_SECRET_KEY ?? input.env.SUPABASE_SERVICE_ROLE_KEY)!.trim(), 'content-type': 'application/json' },
    body: JSON.stringify({ admin_subject: admin.subject, page_offset: input.offset }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('DIRECTORY_UNAVAILABLE');
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length > PAGE_SIZE + 1) throw new Error('DIRECTORY_INVALID');
  const actors: Array<{ actorRef: string; role: string; state: string; email: string | null }> = [];
  // Bound provider concurrency and return only contact information, never full user objects.
  for (let start = 0; start < Math.min(rows.length, PAGE_SIZE); start += 5) {
    actors.push(...await Promise.all(rows.slice(start, Math.min(start + 5, PAGE_SIZE)).map(async row => {
      if (!row || typeof row.actor_ref !== 'string' || !['doctor', 'patient', 'dispensary', 'admin'].includes(row.role)
        || !['pending', 'active', 'suspended', 'revoked', 'expired'].includes(row.actor_state)
        || typeof row.external_subject !== 'string' || !/^did:privy:[A-Za-z0-9._:-]{6,500}$/.test(row.external_subject)) throw new Error('DIRECTORY_INVALID');
      let email: string | null = null;
      try {
        const userResponse = await fetcher(`https://api.privy.io/v1/users/${encodeURIComponent(row.external_subject)}`, {
          headers: {
            authorization: `Basic ${Buffer.from(`${input.env.PRIVY_APP_ID}:${input.env.PRIVY_APP_SECRET}`).toString('base64')}`,
            'privy-app-id': input.env.PRIVY_APP_ID!,
          }, signal: AbortSignal.timeout(5000),
        });
        if (userResponse.ok) {
          const user = await userResponse.json();
          if (user.id === row.external_subject && Array.isArray(user.linked_accounts)) {
            for (const account of user.linked_accounts) {
              const candidate = account?.type === 'email' ? account.address : account?.type === 'google_oauth' ? account.email : null;
              if (typeof candidate === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.trim())) {
                email = candidate.trim().toLowerCase();
                break;
              }
            }
          }
        }
      } catch { /* Provider failure must not hide the actor's authorization state. */ }
      return { actorRef: row.actor_ref, role: row.role, state: row.actor_state, email };
    })));
  }
  return { actors, nextOffset: rows.length > PAGE_SIZE ? input.offset + PAGE_SIZE : null };
}
