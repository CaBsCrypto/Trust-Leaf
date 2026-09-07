import assert from 'node:assert/strict';
import { processCalendarJob, type CalendarWorkStore } from '../api/_lib/google-calendar-worker.ts';
let desired: 'confirmed' | 'cancelled' = 'confirmed';
let finished: any;
const store: CalendarWorkStore = {
  async claim() { return { booking_ref:'booking', revision:2, lease_id:'lease', desired_state:desired }; },
  async credentials() { return {clientId:'id',clientSecret:'secret',refreshToken:'refresh',calendarId:'calendar'}; },
  async booking() { return {bookingRef:'booking', startsAt:'2026-09-09T12:00:00Z',endsAt:'2026-09-09T12:30:00Z',doctorEmail:'doctor@example.com',patientEmail:'patient@example.com'}; },
  async finish(value) { finished=value; },
};
let replies: Response[]=[];
const fetcher: typeof fetch=async()=>{assert.ok(replies.length);return replies.shift()!;};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
replies=[json({access_token:'access'}),json({conferenceProperties:{allowedConferenceSolutionTypes:['hangoutsMeet']}}),json({},404),json({conferenceData:{entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}})];
assert.deepEqual(await processCalendarJob(store,fetcher),{processed:true,state:'ready'});
assert.equal(finished.leaseId,'lease');
assert.equal(finished.revision,2);
assert.equal(finished.meetUrl,'https://meet.google.com/abc-defg-hij');
replies=[json({error:'invalid_grant'},400)];
assert.equal((await processCalendarJob(store,fetcher)).state,'error');
assert.equal(finished.meetUrl,undefined);
desired='cancelled';
replies=[json({access_token:'access'}),new Response(null,{status:204})];
assert.equal((await processCalendarJob(store,fetcher)).state,'cancelled');
for (const status of [404, 410]) {
  replies=[json({access_token:'access'}),new Response(null,{status})];
  assert.equal((await processCalendarJob(store,fetcher)).state,'cancelled');
  assert.equal(finished.meetUrl,undefined);
}
replies=[json({access_token:'access'}),json({error:'temporary provider failure'},503)];
assert.equal((await processCalendarJob(store,fetcher)).state,'error');
assert.deepEqual(finished,{bookingRef:'booking',revision:2,leaseId:'lease',state:'error'});
replies=[json({access_token:'access'}),new Response(null,{status:204})];
assert.equal((await processCalendarJob(store,fetcher)).state,'cancelled');

desired='confirmed';
replies=[json({access_token:'access'}),json({conferenceProperties:{allowedConferenceSolutionTypes:['hangoutsMeet']}}),json({conferenceData:{createRequest:{status:{statusCode:'pending'}}}})];
assert.equal((await processCalendarJob(store,fetcher)).state,'pending');
assert.equal((finished as Parameters<CalendarWorkStore['finish']>[0]).meetUrl,null);
replies=[json({access_token:'access'}),json({conferenceProperties:{allowedConferenceSolutionTypes:['hangoutsMeet']}}),json({conferenceData:{entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}})];
assert.equal((await processCalendarJob(store,fetcher)).state,'ready');
assert.equal((finished as Parameters<CalendarWorkStore['finish']>[0]).meetUrl,'https://meet.google.com/abc-defg-hij');

replies=[json({access_token:'access'}),json({conferenceProperties:{allowedConferenceSolutionTypes:['hangoutsMeet']}}),json({conferenceData:{entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}})];
await assert.rejects(processCalendarJob({...store,finish:async()=>{throw new Error('storage unavailable');}},fetcher),/storage unavailable/);
assert.deepEqual(await processCalendarJob({...store,claim:async()=>null},fetcher),{processed:false});
console.log('PASS: worker event creation, cancellation, reconnect failure and empty queue');
