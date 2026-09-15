begin;

create function public.trustleaf_privy_agenda_booking(p_subject text, p_booking_ref uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor record;
  v_result jsonb;
begin
  select * into v_actor from trustleaf_private.resolve_privy_actor(p_subject);
  if not found or v_actor.actor_state <> 'active' or v_actor.role not in ('doctor','patient')
    or (v_actor.valid_until is not null and v_actor.valid_until <= statement_timestamp()) then
    raise exception 'AGENDA_FORBIDDEN' using errcode = '42501';
  end if;
  select jsonb_build_object('slotRef',s.slot_ref,'bookingRef',b.booking_ref,
    'doctorRef',s.doctor_actor_ref,'startsAt',s.starts_at,'endsAt',s.ends_at,
    'bookingState',b.state)
  into v_result
  from trustleaf_private.appointment_bookings b
  join trustleaf_private.availability_slots s on s.slot_ref=b.slot_ref
  where b.booking_ref=p_booking_ref and
    ((v_actor.role='doctor' and s.doctor_actor_ref=v_actor.actor_ref)
     or (v_actor.role='patient' and b.patient_actor_ref=v_actor.actor_ref));
  return v_result;
end;
$$;
revoke all on function public.trustleaf_privy_agenda_booking(text,uuid) from public,anon,authenticated;
grant execute on function public.trustleaf_privy_agenda_booking(text,uuid) to service_role;

commit;
