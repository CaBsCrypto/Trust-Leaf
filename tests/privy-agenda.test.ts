import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const hooks=registerHooks({resolve(specifier,context,next){return next(specifier==='./privy-supabase-rbac.js' && context.parentURL?.endsWith('/privy-agenda.ts')?'./privy-supabase-rbac.ts':specifier,context);}});
const {executePrivyAgenda}=await import('../api/_lib/privy-agenda.ts');hooks.deregister();
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'synthetic'};
const subject='did:privy:agenda-fixture';
const verifier={async verify(){return {subject,emails:[]};}};
const binding=(role:string,state='active')=>[{actor_ref:'11111111-1111-4111-8111-111111111111',role,actor_state:state}];
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
  for(const [code,statusCode] of [['40001',409],['23505',409],['42501',403],['22023',400],['XX000',503]] as const){
    let commands=0;const fetcher:typeof fetch=async url=>{if(String(url).includes('resolve_privy'))return Response.json(binding('doctor'));commands++;return Response.json({code,message:'sensitive internal details'},{status:400});};
    await assert.rejects(executePrivyAgenda({token:'fixture',action:'publish',input:{},env,verifier,fetcher}),{statusCode,message:'Agenda unavailable'});assert.equal(commands,1);
  }
});
