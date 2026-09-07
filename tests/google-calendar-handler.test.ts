import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
const hooks = registerHooks({ resolve(specifier, context, next) {
  return next(context.parentURL?.includes('/api/_lib/') && specifier.startsWith('./') && specifier.endsWith('.js') ? specifier.replace(/\.js$/, '.ts') : specifier, context);
} });
const { googleCalendarHandler } = await import('../api/_lib/google-calendar-handler.ts');
hooks.deregister();
const env = { GOOGLE_CALENDAR_ENABLED: 'true', GOOGLE_CALENDAR_ENCRYPTION_KEY: 'ab'.repeat(32), GOOGLE_CALENDAR_CLIENT_SECRET: 'fake', GOOGLE_CALENDAR_CLIENT_ID: 'fake.apps.googleusercontent.com', GOOGLE_CALENDAR_REDIRECT_URI: 'https://www.trustleaf.org/api/google-calendar/callback', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'fake' };
const verifier = { async verify() { return { subject: 'did:privy:doctor', emails: [] }; } };
const pending = new Map();
let activeRole = 'admin'; let saved = ''; let exchanges = 0;
const fetcher: typeof fetch = async (url, init) => {
  if (String(url).includes('resolve_privy')) return Response.json([{ actor_ref: '11111111-1111-4111-8111-111111111111', role: activeRole, actor_state: 'active' }]);
  if (String(url).includes('oauth2.googleapis.com')) { exchanges++; return Response.json({ refresh_token: 'refresh-test', scope: 'https://www.googleapis.com/auth/calendar.app.created' }); }
  const body = JSON.parse(String(init?.body));
  if (body.p_action === 'start') pending.set(body.p_key, { payload: body.p_value, subject: body.p_subject });
  if (body.p_action === 'consume') { const value = pending.get(body.p_key); pending.delete(body.p_key); return value ? Response.json(value) : new Response('', { status: 400 }); }
  if (body.p_action === 'save') saved = body.p_value;
  return Response.json({});
};
function response() { return { headers: {} as Record<string,string>, code: 200, body: null as any, location: '', setHeader(k:string,v:string){this.headers[k]=v;}, status(c:number){this.code=c;return this;}, json(v:any){this.body=v;return this;}, end(){}, redirect(c:number,l:string){this.code=c;this.location=l;} }; }
const request = { method: 'POST', headers: { origin: 'https://www.trustleaf.org', 'privy-id-token': 'fake' }, query: {} };
async function run(req:any, action:string) { const res=response(); await googleCalendarHandler(req,res,action,{env,verifier,fetcher});return res; }
assert.equal((await run({...request,headers:{}},'start')).code,403);
for (const role of ['patient','doctor','dispensary']) { activeRole=role; assert.equal((await run(request,'start')).code,403); }
activeRole='admin';
const start=await run(request,'start'); assert.equal(start.code,200);
assert.equal(start.headers['Cache-Control'],'no-store');
const cookie=start.headers['Set-Cookie'].split(';')[0];
const state=new URL(start.body.url).searchParams.get('state');
const callback={method:'GET',headers:{cookie},query:{state,code:'fake-code'}};
assert.equal((await run({...callback,headers:{}},'callback')).location,'/admin?calendar=error');
assert.equal(exchanges,0);
assert.equal((await run(callback,'callback')).location,'/admin?calendar=connected');
assert.ok(saved && !saved.includes('refresh-test'));
assert.equal((await run(callback,'callback')).location,'/admin?calendar=error');
assert.equal(exchanges,1);
console.log('PASS: admin-only central connection, browser binding, encrypted persistence and replay rejection');
