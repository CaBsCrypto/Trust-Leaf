import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const hooks=registerHooks({resolve(specifier,context,next){return next(specifier==='./privy-supabase-rbac.js' && context.parentURL?.endsWith('/privy-agenda.ts')?'./privy-supabase-rbac.ts':specifier,context);}});
const {executePrivyAgenda}=await import('../api/_lib/privy-agenda.ts');hooks.deregister();
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'synthetic'};
const subject='did:privy:agenda-fixture';
const verifier={async verify(){return {subject,emails:[]};}};
const binding=(role:string,state='active')=>[{actor_ref:'11111111-1111-4111-8111-111111111111',role,actor_state:state}];
const selectedBookingRef='22222222-2222-4222-8222-222222222222';

test('historical selection validates input before requesting data',async()=>{
  for (const selected of ['', 'bad-ref', ['bad-ref']]) {
    let calls=0;
    await assert.rejects(executePrivyAgenda({token:'fixture',action:'list',input:{selectedBookingRef:selected},env,verifier,fetcher:async()=>{calls++;return Response.json({});}}),{statusCode:400});
    assert.equal(calls,0);
  }
});

test('historical read uses verified identity, strips extra fields and never runs calendar worker',async()=>{
  const expected={bookingRef:selectedBookingRef,slotRef:'slot',doctorRef:'doctor',startsAt:'2026-09-10T12:00:00Z',endsAt:'2026-09-10T12:30:00Z',bookingState:'cancelled'};
  for (const value of [null,{...expected,conference:{meetUrl:'secret'},patientRef:'other'}]) {
    const paths:string[]=[];
    const result=await executePrivyAgenda({token:'fixture',action:'list',input:{selectedBookingRef,subject:'forged'},env:{...env,GOOGLE_CALENDAR_AUTOMATION_ENABLED:'true'},verifier,fetcher:async(url,init)=>{
      const path=new URL(String(url)).pathname;paths.push(path);
      if(path.includes('resolve_privy'))return Response.json(binding('doctor'));
      const body=JSON.parse(String(init?.body));assert.equal(body.p_subject,subject);
      if(path.endsWith('trustleaf_privy_agenda_booking')) {assert.equal(body.p_booking_ref,selectedBookingRef);return Response.json(value);}
      assert.ok(path.endsWith('trustleaf_privy_agenda'));return Response.json({slots:[]});
    }});
    assert.deepEqual(result.selectedBooking,value===null?null:expected);
    assert.equal(paths.length,3);
  }
});

test('historical failure and malformed response cannot become a missing booking',async()=>{
  for(const value of [{},[],{bookingRef:'wrong'}]) {
    await assert.rejects(executePrivyAgenda({token:'fixture',action:'list',input:{selectedBookingRef},env,verifier,fetcher:async url=>{
      if(String(url).includes('resolve_privy'))return Response.json(binding('patient'));
      return Response.json(String(url).endsWith('agenda_booking')?value:{slots:[]});
    }}),{statusCode:503});
  }
  for(const [code,statusCode] of [['XX000',503],['42501',403]]) {
    await assert.rejects(executePrivyAgenda({token:'fixture',action:'list',input:{selectedBookingRef},env,verifier,fetcher:async url=>{
      if(String(url).includes('resolve_privy'))return Response.json(binding('patient'));
      return String(url).endsWith('agenda_booking')?Response.json({code},{status:400}):Response.json({slots:[]});
    }}),{statusCode});
  }
});
test('agenda derives subject from verified identity, not submitted actor',async()=>{
  const fetcher:typeof fetch=async(url,init)=>{
    if(String(url).includes('resolve_privy'))return Response.json(binding('patient'));
    const body=JSON.parse(String(init?.body));assert.equal(body.p_subject,subject);assert.equal(body.p_action,'reserve');
    return Response.json({resourceRef:'fixture',replayed:false});
  };
  await executePrivyAgenda({token:'fixture',action:'reserve',input:{subject:'did:privy:someone-else'},env,verifier,fetcher});
});
test('wrong role and pending accounts never reach agenda mutation',async()=>{
  for(const [role,state,action] of [['patient','active','publish'],['doctor','active','reserve'],['doctor','pending','list'],['admin','active','list']]){
    let calls=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json(binding(role,state));};
    await assert.rejects(executePrivyAgenda({token:'fixture',action,input:{},env,verifier,fetcher}));assert.equal(calls,1);
  }
});
test('SQL conflicts and failures expose categories only and are never retried',async()=>{
  for(const [code,statusCode] of [['PT409',409],['40001',409],['23505',409],['42501',403],['22023',400],['XX000',503]] as const){
    let commands=0;const fetcher:typeof fetch=async url=>{if(String(url).includes('resolve_privy'))return Response.json(binding('doctor'));commands++;return Response.json({code,message:'sensitive internal details'},{status:400});};
    await assert.rejects(executePrivyAgenda({token:'fixture',action:'publish',input:{},env,verifier,fetcher}),{statusCode,message:'Agenda unavailable'});assert.equal(commands,1);
  }
});
