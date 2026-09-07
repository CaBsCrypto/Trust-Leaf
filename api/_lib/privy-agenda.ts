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
  const result = await response.json();
  if (['reserve', 'cancel-booking'].includes(input.action) && input.env.GOOGLE_CALENDAR_AUTOMATION_ENABLED === 'true') {
    try {
      const { calendarWorkStore } = await import('./google-calendar-store.js');
      const { processCalendarJob } = await import('./google-calendar-worker.js');
      await processCalendarJob(calendarWorkStore(input.env, fetcher), fetcher);
    } catch {
      // The database transaction is committed; the durable job remains retryable.
    }
  }
  if (input.action === 'list' && input.env.GOOGLE_CALENDAR_ENABLED === 'true' && Array.isArray(result.slots)) {
    const refs = result.slots.map((slot: any) => slot.bookingRef).filter(Boolean);
    if (refs.length) {
      try {
        const calendar = await fetcher(new URL('/rest/v1/rpc/trustleaf_calendar_participant', input.env.SUPABASE_URL ?? input.env.VITE_SUPABASE_URL), {
          method: 'POST', headers: { apikey: (input.env.SUPABASE_SECRET_KEY ?? input.env.SUPABASE_SERVICE_ROLE_KEY)!.trim(), 'content-type': 'application/json' },
          body: JSON.stringify({ p_subject: principal.subject, p_booking_refs: refs }), signal: AbortSignal.timeout(5000),
        });
        if (!calendar.ok) throw new Error('CALENDAR_UNAVAILABLE');
        const rows = await calendar.json();
        if (!Array.isArray(rows)) throw new Error('CALENDAR_UNAVAILABLE');
        result.slots = result.slots.map((slot: any) => ({ ...slot, conference: rows.find((row: any) => row.bookingRef === slot.bookingRef) ?? null }));
      } catch {
        result.slots = result.slots.map((slot: any) => ({ ...slot, conference: slot.bookingRef ? { state: 'unavailable' } : null }));
      }
    }
  }
  return result;
}
function failure(statusCode: number) { return Object.assign(new Error('Agenda unavailable'), { statusCode, code: statusCode === 409 ? 'AGENDA_CONFLICT' : 'AGENDA_UNAVAILABLE' }); }
