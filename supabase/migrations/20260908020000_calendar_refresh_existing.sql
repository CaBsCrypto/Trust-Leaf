begin;
alter function public.trustleaf_calendar_job(text,jsonb) rename to trustleaf_calendar_job_ownership;
revoke all on function public.trustleaf_calendar_job_ownership(text,jsonb) from public,anon,authenticated,service_role;
create function public.trustleaf_calendar_job(p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate trustleaf_private.calendar_candidate%rowtype; target trustleaf_private.calendar_connections%rowtype;
begin
  if p_action='renew-target' then
    return (select jsonb_build_object('calendar_id',c.calendar_id,'connection_ref',c.connection_ref)
      from public.trustleaf_central_calendar c where c.calendar_id is not null);
  elsif p_action='renew-save' then
    perform pg_advisory_xact_lock(709080100);
    select * into candidate from trustleaf_private.calendar_candidate
      where connection_ref=(p_input->>'candidateRef')::uuid and not setup_started for update;
    if not found then raise exception 'CALENDAR_SETUP_CONFLICT'; end if;
    select * into target from trustleaf_private.calendar_connections
      where connection_ref=(p_input->>'connectionRef')::uuid and calendar_id=p_input->>'calendarId' for update;
    if not found then raise exception 'CALENDAR_SETUP_CONFLICT'; end if;
    update trustleaf_private.calendar_connections set refresh_ciphertext=candidate.refresh_ciphertext
      where connection_ref=target.connection_ref;
    update public.trustleaf_central_calendar set refresh_ciphertext=candidate.refresh_ciphertext,updated_at=now()
      where connection_ref=target.connection_ref;
    delete from trustleaf_private.calendar_candidate where connection_ref=candidate.connection_ref;
    return jsonb_build_object('saved',true);
  end if;
  return public.trustleaf_calendar_job_ownership(p_action,p_input);
end $$;
revoke all on function public.trustleaf_calendar_job(text,jsonb) from public,anon,authenticated;
grant execute on function public.trustleaf_calendar_job(text,jsonb) to service_role;
commit;
