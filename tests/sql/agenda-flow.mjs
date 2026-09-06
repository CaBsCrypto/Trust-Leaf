import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function testAgenda(db, subjects) {
  const call = async (subject, action, input, role = 'service_role') => {
    await db.exec(`set role ${role}`);
    try { return (await db.query('select public.trustleaf_privy_agenda($1,$2,$3) as data', [subject, action, input])).rows[0].data; }
    finally { await db.exec('reset role'); }
  };
  const tomorrow = new Date(Date.now()+86400000); tomorrow.setUTCHours(14,0,0,0);
  const from = new Date(tomorrow.getTime()-3600000).toISOString();
  const to = new Date(tomorrow.getTime()+86400000).toISOString();
  const slot = { slotRef: randomUUID(), startsAt: tomorrow.toISOString(), endsAt: new Date(tomorrow.getTime()+1800000).toISOString(), operationId: randomUUID() };
  const list = subject => call(subject, 'list', { from, to });
  for (const role of ['admin','dispensary']) await assert.rejects(list(subjects[role]), { code:'42501' });
  for (const role of ['anon','authenticated']) await assert.rejects(call(subjects.doctor,'list',{from,to},role),{code:'42501'});
  await assert.rejects(call(subjects.patient,'publish',slot),{code:'42501'});
  await assert.rejects(call(subjects.doctor,'publish',{...slot,startsAt:null}),{code:'22023'});
  await assert.rejects(call(subjects.doctor,'publish',{...slot,startsAt:'2020-01-01',endsAt:'2020-01-02'}),{code:'22023'});
  await call(subjects.doctor,'publish',slot);
  assert.equal((await call(subjects.doctor,'publish',slot)).replayed,true);
  await assert.rejects(call(subjects.doctor,'publish',{...slot,slotRef:randomUUID(),operationId:randomUUID()}),{code:'40001'});
  assert.equal((await list(subjects.patient)).slots.length,1);
  const patient2 = 'did:privy:agenda-patient-two';
  await db.query('select * from public.trustleaf_enroll_privy_actor($1,$2)',[patient2,'patient']);
  const reserve = { slotRef:slot.slotRef, bookingRef:randomUUID(),version:1,operationId:randomUUID() };
  // PGlite serializes statements; this validates the competing requests' SQL
  // outcome, not multi-connection lock scheduling on hosted Postgres.
  const results = await Promise.allSettled([
    db.query('select public.trustleaf_privy_agenda($1,$2,$3)',[subjects.patient,'reserve',reserve]),
    db.query('select public.trustleaf_privy_agenda($1,$2,$3)',[patient2,'reserve',{...reserve,bookingRef:randomUUID(),operationId:randomUUID()}]),
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected')[0].reason.code,'40001');
  assert.equal((await call(subjects.patient,'reserve',reserve)).replayed,true);
  assert.equal((await list(subjects.patient)).slots[0].bookingRef,reserve.bookingRef);
  assert.equal((await list(subjects.doctor)).slots[0].bookingRef,reserve.bookingRef);
  assert.equal((await list(patient2)).slots.length,0,'another patient cannot see booked slots');
  await assert.rejects(call(patient2,'cancel-booking',{...reserve,version:2,operationId:randomUUID()}),{code:'42501'});
  await call(subjects.patient,'cancel-booking',{...reserve,version:2,operationId:randomUUID()});
  assert.equal((await list(patient2)).slots[0].state,'published');
  const reserve2={...reserve,bookingRef:randomUUID(),version:3,operationId:randomUUID()};
  await call(patient2,'reserve',reserve2);
  await call(subjects.doctor,'cancel-booking',{...reserve2,version:4,operationId:randomUUID()});
  assert.equal((await list(subjects.doctor)).slots[0].state,'cancelled');
  assert.equal((await list(patient2)).slots[0].bookingState,'cancelled','patient retains cancellation history');
  assert.equal((await db.query('select count(*)::int n from trustleaf_private.appointment_bookings where slot_ref=$1',[slot.slotRef])).rows[0].n,2,'cancelled history retained');
  const pending='did:privy:agenda-pending';
  await db.query('select * from public.trustleaf_enroll_privy_actor($1,$2)',[pending,'doctor']);
  await assert.rejects(list(pending),{code:'42501'});
  // Promote a separate synthetic fixture only inside this ephemeral database.
  const otherDoctor='did:privy:agenda-other-doctor';
  const other=(await db.query('select * from public.trustleaf_enroll_privy_actor($1,$2)',[otherDoctor,'doctor'])).rows[0];
  await db.query("update trustleaf_private.actor_bindings set state='active' where actor_ref=$1",[other.actor_ref]);
  const slot2={...slot,slotRef:randomUUID(),operationId:randomUUID()};
  await call(subjects.doctor,'publish',slot2);
  assert.equal((await list(otherDoctor)).slots.length,0,'doctor cannot list another agenda');
  await assert.rejects(call(otherDoctor,'cancel-slot',{slotRef:slot2.slotRef,version:1,operationId:randomUUID()}),{code:'42501'});
  const slot3={...slot,slotRef:randomUUID(),operationId:randomUUID()};
  await call(otherDoctor,'publish',slot3);
  await call(subjects.patient,'reserve',{slotRef:slot2.slotRef,bookingRef:randomUUID(),version:1,operationId:randomUUID()});
  await assert.rejects(call(subjects.patient,'reserve',{slotRef:slot3.slotRef,bookingRef:randomUUID(),version:1,operationId:randomUUID()}),{code:'40001'});
  await db.query("update trustleaf_private.actor_bindings set state='suspended' where actor_ref=$1",[other.actor_ref]);
  await assert.rejects(list(otherDoctor),{code:'42501'});
  await assert.rejects(call(patient2,'reserve',{slotRef:slot3.slotRef,bookingRef:randomUUID(),version:1,operationId:randomUUID()}),{code:'40001'});
  await assert.rejects(call(subjects.patient,'list',{from,to:new Date(Date.now()+100*86400000).toISOString()}),{code:'22023'});
  console.log('PASS: SQL Privy agenda publish, overlap, competing reservations, role isolation, replay, cancellation and rebooking.');
}
