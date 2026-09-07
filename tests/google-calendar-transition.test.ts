import assert from 'node:assert/strict';
import { setupCentralCalendar } from '../api/_lib/google-calendar-setup.ts';
import { seal } from '../api/_lib/google-calendar-security.ts';
const key='ab'.repeat(32);
const env={SUPABASE_URL:'https://example.test',SUPABASE_SECRET_KEY:'test',GOOGLE_CALENDAR_CLIENT_ID:'test',
  GOOGLE_CALENDAR_CLIENT_SECRET:'test',GOOGLE_CALENDAR_ENCRYPTION_KEY:key};
for(const supported of [true,false]) {
  const actions:string[]=[];
  const fetcher=(async (url:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(url);
    if(path.includes('/rpc/')) {
      const body=JSON.parse(String(init?.body)); actions.push(body.p_action);
      if(body.p_action==='setup-credentials') return Response.json({connection_ref:'candidate',refresh_ciphertext:seal('refresh',key,'central-calendar:refresh')});
      assert.equal(body.p_input.connectionRef,'candidate');
      return Response.json(body.p_action==='setup-claim'?{claimed:true}:{saved:true});
    }
    if(path.includes('oauth2')) return Response.json({access_token:'test'});
    if(init?.method==='POST') return Response.json({id:'new-calendar'});
    actions.push('verify');
    return Response.json({conferenceProperties:{allowedConferenceSolutionTypes:supported?['hangoutsMeet']:[]}});
  }) as typeof fetch;
  if(supported) {
    assert.deepEqual(await setupCentralCalendar(env,fetcher),{ready:true});
    assert.ok(actions.indexOf('verify')<actions.indexOf('setup-save'));
  } else {
    await assert.rejects(setupCentralCalendar(env,fetcher),/CALENDAR_MEET_UNAVAILABLE/);
    assert.ok(!actions.includes('setup-save'));
  }
}
console.log('PASS: candidate promotion requires successful Meet verification');
