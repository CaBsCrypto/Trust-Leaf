import { createPrivyRbacAuthorizer, createSupabasePrivyActorStore } from './privy-supabase-rbac.js';
import type { PrivyIdentity } from './privy-identity.ts';

export async function executePrivyAgenda(input: {
  token: string; action: string; input: Record<string, unknown>;
  env: Record<string, string | undefined>;
  verifier: { verify(token: string): Promise<PrivyIdentity> }; fetcher?: typeof fetch;
}) {
  const fetcher = input.fetcher ?? fetch;
  if (!['list', 'publish', 'reserve', 'cancel-slot', 'cancel-booking'].includes(input.action)) throw failure(400);
  const roles = input.action === 'publish' || input.action === 'cancel-slot' ? ['doctor'] as const
    : input.action === 'reserve' ? ['patient'] as const : ['doctor', 'patient'] as const;
  const principal = await createPrivyRbacAuthorizer({ verifier: input.verifier, store: createSupabasePrivyActorStore(input.env, fetcher) }).authorize(input.token, [...roles]);
  const response = await fetcher(new URL('/rest/v1/rpc/trustleaf_privy_agenda', input.env.SUPABASE_URL ?? input.env.VITE_SUPABASE_URL), {
    method: 'POST', headers: { apikey: (input.env.SUPABASE_SECRET_KEY ?? input.env.SUPABASE_SERVICE_ROLE_KEY)!.trim(), 'content-type': 'application/json' },
    // The subject is derived from a verified token, never the browser payload.
    body: JSON.stringify({ p_subject: principal.subject, p_action: input.action, p_input: input.input }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const diagnostic = await response.json().catch(() => ({}));
    const status = diagnostic.code === '42501' ? 403 : ['40001', '23505'].includes(diagnostic.code) ? 409
      : String(diagnostic.code).startsWith('22') ? 400 : 503;
    throw failure(status);
  }
  return response.json();
}
function failure(statusCode: number) { return Object.assign(new Error('Agenda unavailable'), { statusCode, code: statusCode === 409 ? 'AGENDA_CONFLICT' : 'AGENDA_UNAVAILABLE' }); }
