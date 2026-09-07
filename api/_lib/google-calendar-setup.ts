import { calendarProvider, refreshCalendarToken } from './google-calendar-provider.js';
import { unseal } from './google-calendar-security.js';

export async function setupCentralCalendar(env: Record<string,string|undefined>, fetcher:typeof fetch=fetch) {
  async function rpc(action:string,input:unknown={}) {
    const response=await fetcher(new URL('/rest/v1/rpc/trustleaf_calendar_job',env.SUPABASE_URL??env.VITE_SUPABASE_URL),{
      method:'POST',headers:{apikey:(env.SUPABASE_SECRET_KEY??env.SUPABASE_SERVICE_ROLE_KEY??'').trim(),'content-type':'application/json'},
      body:JSON.stringify({p_action:action,p_input:input}),signal:AbortSignal.timeout(10000),
    });
    if(!response.ok) throw new Error('CALENDAR_SETUP_STORAGE_FAILED');
    return response.json();
  }
  const existing=await rpc('credentials');
  if(!existing?.refresh_ciphertext || !env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET) throw new Error('CALENDAR_CONNECTION_REQUIRED');
  const token=await refreshCalendarToken({clientId:env.GOOGLE_CALENDAR_CLIENT_ID,clientSecret:env.GOOGLE_CALENDAR_CLIENT_SECRET,
    refreshToken:unseal(existing.refresh_ciphertext,env.GOOGLE_CALENDAR_ENCRYPTION_KEY??'','central-calendar:refresh')},fetcher);
  const provider=calendarProvider(token,fetcher);
  if(existing.calendar_id) {
    await provider.verifyMeet(existing.calendar_id);
    return {ready:true};
  }
  const claim=await rpc('setup-claim');
  if(!claim?.claimed) throw new Error('CALENDAR_SETUP_REVIEW_REQUIRED');
  // Calendar insertion has no idempotency key. Never automatically repeat an ambiguous creation.
  const id=await provider.create();
  await rpc('setup-save',{calendarId:id});
  await provider.verifyMeet(id);
  return {ready:true};
}
