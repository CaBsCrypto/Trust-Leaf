import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const id = '11111111-1111-4111-8111-111111111111';
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema trustleaf_private;
    create table public.trustleaf_central_calendar(singleton boolean,refresh_ciphertext text);
    create table trustleaf_private.actor_bindings(actor_ref uuid primary key, role text, state text, valid_until timestamptz);
    create table trustleaf_private.external_identity_bindings(actor_ref uuid,provider text,state text,external_subject text);
    create table trustleaf_private.availability_slots(slot_ref uuid primary key,doctor_actor_ref uuid,starts_at timestamptz,ends_at timestamptz);
    create table trustleaf_private.appointment_bookings(booking_ref uuid primary key, state text,slot_ref uuid,patient_actor_ref uuid);
    create function trustleaf_private.resolve_privy_actor(text) returns table(actor_ref uuid,role text,actor_state text,valid_until timestamptz)
      language sql as $$ select a.actor_ref,a.role,a.state,a.valid_until from trustleaf_private.actor_bindings a
      join trustleaf_private.external_identity_bindings i using(actor_ref) where i.external_subject=$1 and i.state='active' $$;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20260907040000_calendar_booking_outbox.sql',import.meta.url),'utf8'));
  const rpc = async (action,input={}) => (await db.query('select public.trustleaf_calendar_job($1,$2) as value',[action,input])).rows[0].value;
  const doctor='22222222-2222-4222-8222-222222222222', patient='33333333-3333-4333-8333-333333333333';
  const stranger='44444444-4444-4444-8444-444444444444', slot='55555555-5555-4555-8555-555555555555';
  for(const [actor,role,subject] of [[doctor,'doctor','doctor'],[patient,'patient','patient'],[stranger,'patient','stranger']]) {
    await db.query("insert into trustleaf_private.actor_bindings values($1,$2,'active',null)",[actor,role]);
    await db.query("insert into trustleaf_private.external_identity_bindings values($1,'privy','active',$2)",[actor,subject]);
  }
  await db.query("insert into trustleaf_private.availability_slots values($1,$2,now()+interval '1 day',now()+interval '1 day 30 minutes')",[slot,doctor]);
  await db.query("insert into trustleaf_private.appointment_bookings values($1,'confirmed',$2,$3)",[id,slot,patient]);
  const participant=async subject=>(await db.query('select public.trustleaf_calendar_participant($1,$2) value',[subject,[id]])).rows[0].value;
  const first = await rpc('claim');
  assert.equal(first.desired_state,'confirmed');
  const booking=await rpc('booking',{bookingRef:id,leaseId:first.lease_id,revision:first.revision});
  assert.equal(booking.doctor_subject,'doctor');
  assert.equal(booking.patient_subject,'patient');
  assert.deepEqual(await participant('stranger'),[]);
  await db.query("update trustleaf_private.calendar_booking_jobs set state='ready',meet_url='https://meet.google.com/abc-defg-hij' where booking_ref=$1",[id]);
  assert.equal((await participant('doctor'))[0].meetUrl,'https://meet.google.com/abc-defg-hij');
  assert.equal((await participant('patient'))[0].meetUrl,'https://meet.google.com/abc-defg-hij');
  await db.query("update trustleaf_private.actor_bindings set state='suspended' where actor_ref=$1",[patient]);
  await assert.rejects(participant('patient'),{code:'42501'});
  await assert.rejects(rpc('booking',{bookingRef:id,leaseId:first.lease_id,revision:first.revision}),{code:'42501'});
  await db.query("update trustleaf_private.actor_bindings set state='active' where actor_ref=$1",[patient]);
  assert.equal(await rpc('claim'),null);
  await db.query("update trustleaf_private.appointment_bookings set state='cancelled' where booking_ref=$1",[id]);
  assert.equal(await rpc('claim'),null,'cancellation waits for the insertion worker');
  await rpc('finish',{bookingRef:id,leaseId:first.lease_id,revision:first.revision,state:'ready',meetUrl:'https://meet.google.com/abc-defg-hij'});
  const second=await rpc('claim');
  assert.equal(second.desired_state,'cancelled');
  assert.equal(second.meet_url,null);
  assert.equal((await participant('patient'))[0].meetUrl,null);
  await assert.rejects(rpc('finish',{bookingRef:id,leaseId:first.lease_id,revision:first.revision,state:'ready'}));
  await rpc('finish',{bookingRef:id,leaseId:second.lease_id,revision:second.revision,state:'cancelled'});
  assert.equal(await rpc('claim'),null);
  await db.exec('set role anon');
  await assert.rejects(rpc('claim'));
  await db.exec('reset role');
  console.log('PASS: transactional enqueue, claim exclusion, stale result fencing, cancellation and RPC permissions');
} finally { await db.close(); }
