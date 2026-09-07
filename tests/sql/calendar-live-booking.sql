-- Explicit integration fixture for the previously validated test participants.
-- This triggers Calendar invitations, not a clinical consultation.
do $$
declare d text; p text; s uuid := 'e8c77373-b490-4e55-96ab-3bb8a56ca138'; b uuid := '88bb2f83-1b5b-48be-9404-5d9015a27b44'; t timestamptz;
begin
 if exists(select 1 from trustleaf_private.appointment_bookings where booking_ref=b) then return; end if;
 select di.external_subject,pi.external_subject into strict d,p from trustleaf_private.appointment_bookings ab
 join trustleaf_private.availability_slots sl using(slot_ref)
 join trustleaf_private.external_identity_bindings di on di.actor_ref=sl.doctor_actor_ref and di.provider='privy' and di.state='active'
 join trustleaf_private.external_identity_bindings pi on pi.actor_ref=ab.patient_actor_ref and pi.provider='privy' and pi.state='active'
 where ab.booking_ref='93accfc8-6657-4c63-ae87-7fbf77d59346';
 t := date_trunc('hour',now())+interval '26 hours';
 perform public.trustleaf_privy_agenda(d,'publish',jsonb_build_object('operationId','calendar-test-publish-20260907','slotRef',s,'startsAt',t,'endsAt',t+interval '30 minutes'));
 perform public.trustleaf_privy_agenda(p,'reserve',jsonb_build_object('operationId','calendar-test-reserve-20260907','slotRef',s,'bookingRef',b,'version',1));
end $$;
select booking_ref,state,desired_state from trustleaf_private.calendar_booking_jobs where booking_ref='88bb2f83-1b5b-48be-9404-5d9015a27b44';
