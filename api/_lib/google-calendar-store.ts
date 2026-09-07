import { unseal } from './google-calendar-security.js';
import type { CalendarJob, CalendarWorkStore } from './google-calendar-worker.js';

export function calendarWorkStore(env: Record<string, string | undefined>, fetcher: typeof fetch = fetch): CalendarWorkStore {
  async function rpc(action: string, input: unknown = {}) {
    const response = await fetcher(new URL('/rest/v1/rpc/trustleaf_calendar_job', env.SUPABASE_URL ?? env.VITE_SUPABASE_URL), {
      method: 'POST', headers: { apikey: (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(), 'content-type': 'application/json' },
      body: JSON.stringify({p_action:action,p_input:input}), signal:AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('CALENDAR_STORAGE_UNAVAILABLE');
    return response.json();
  }
  async function email(subject: string) {
    if (!/^did:privy:[A-Za-z0-9._:-]{6,500}$/.test(subject)) throw new Error('CALENDAR_IDENTITY_INVALID');
    const response=await fetcher(`https://api.privy.io/v1/users/${encodeURIComponent(subject)}`, {
      headers: {authorization:`Basic ${Buffer.from(`${env.PRIVY_APP_ID}:${env.PRIVY_APP_SECRET}`).toString('base64')}`, 'privy-app-id':env.PRIVY_APP_ID!},
      signal:AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('CALENDAR_PARTICIPANT_UNAVAILABLE');
    const user=await response.json();
    if(user.id !== subject || !Array.isArray(user.linked_accounts)) throw new Error('CALENDAR_IDENTITY_INVALID');
    for(const account of user.linked_accounts) {
      const candidate=account?.type==='email'?account.address:account?.type==='google_oauth'?account.email:null;
      if(typeof candidate==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.trim())) return candidate.trim().toLowerCase();
    }
    throw new Error('CALENDAR_PARTICIPANT_EMAIL_REQUIRED');
  }
  return {
    claim:()=>rpc('claim'),
    finish:input=>rpc('finish',input),
    async credentials() {
      const data=await rpc('credentials');
      if(!data || typeof data.refresh_ciphertext!=='string' || typeof data.calendar_id!=='string') throw new Error('CALENDAR_SETUP_REQUIRED');
      if(!env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET) throw new Error('CALENDAR_SETUP_REQUIRED');
      return {clientId:env.GOOGLE_CALENDAR_CLIENT_ID,clientSecret:env.GOOGLE_CALENDAR_CLIENT_SECRET,
        refreshToken:unseal(data.refresh_ciphertext,env.GOOGLE_CALENDAR_ENCRYPTION_KEY??'','central-calendar:refresh'),calendarId:data.calendar_id};
    },
    async booking(job:CalendarJob) {
      const row=await rpc('booking',{bookingRef:job.booking_ref,leaseId:job.lease_id,revision:job.revision});
      return {bookingRef:job.booking_ref,startsAt:row.starts_at,endsAt:row.ends_at,
        doctorEmail:await email(row.doctor_subject),patientEmail:await email(row.patient_subject)};
    },
  };
}
