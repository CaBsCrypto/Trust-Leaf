begin;
create table public.trustleaf_central_calendar (
  singleton boolean primary key default true check (singleton),
  connected_by text not null,
  refresh_ciphertext text not null,
  updated_at timestamptz not null default now()
);
create table public.trustleaf_central_calendar_oauth (
  state_hash text primary key,
  subject text not null,
  payload text not null,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
alter table public.trustleaf_central_calendar enable row level security;
alter table public.trustleaf_central_calendar_oauth enable row level security;
revoke all on public.trustleaf_central_calendar, public.trustleaf_central_calendar_oauth from public, anon, authenticated;

create function public.trustleaf_central_calendar_connection(p_action text, p_subject text, p_key text, p_value text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_payload text; v_subject text;
begin
  if p_action = 'consume' then
    delete from public.trustleaf_central_calendar_oauth where state_hash = p_key and expires_at > now()
      returning payload, subject into v_payload, v_subject;
    if v_payload is null then raise exception 'OAuth request unavailable'; end if;
    return jsonb_build_object('payload', v_payload, 'subject', v_subject);
  end if;
  if not exists(select 1 from public.trustleaf_resolve_privy_actor(p_subject) a
    where a.role = 'admin' and a.actor_state = 'active') then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if p_action = 'start' then
    -- Retire pending attempts when another administrator starts authorization.
    perform pg_advisory_xact_lock(709070200);
    delete from public.trustleaf_central_calendar_oauth;
    insert into public.trustleaf_central_calendar_oauth(state_hash, subject, payload) values(p_key,p_subject,p_value);
    return '{}'::jsonb;
  elsif p_action = 'save' then
    insert into public.trustleaf_central_calendar(singleton,connected_by,refresh_ciphertext) values(true,p_subject,p_value)
      on conflict(singleton) do update set connected_by=excluded.connected_by, refresh_ciphertext=excluded.refresh_ciphertext, updated_at=now();
    return '{}'::jsonb;
  elsif p_action = 'status' then
    return jsonb_build_object('connected',exists(select 1 from public.trustleaf_central_calendar));
  else
    raise exception 'Unsupported operation';
  end if;
end $$;
revoke all on function public.trustleaf_central_calendar_connection(text,text,text,text) from public, anon, authenticated;
grant execute on function public.trustleaf_central_calendar_connection(text,text,text,text) to service_role;
commit;
