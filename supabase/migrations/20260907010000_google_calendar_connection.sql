begin;
create table public.trustleaf_calendar_oauth (
  state_hash text primary key,
  subject text not null,
  payload text not null,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create table public.trustleaf_calendar_connections (
  subject text primary key,
  refresh_ciphertext text not null,
  updated_at timestamptz not null default now()
);
alter table public.trustleaf_calendar_oauth enable row level security;
alter table public.trustleaf_calendar_connections enable row level security;
revoke all on public.trustleaf_calendar_oauth, public.trustleaf_calendar_connections from public, anon, authenticated;

create function public.trustleaf_calendar_connection(p_action text, p_subject text, p_key text, p_value text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_payload text; v_subject text;
begin
  if p_action = 'consume' then
    delete from public.trustleaf_calendar_oauth where state_hash = p_key and expires_at > now()
      returning payload, subject into v_payload, v_subject;
    if v_payload is null then raise exception 'OAuth request unavailable'; end if;
    return jsonb_build_object('payload', v_payload, 'subject', v_subject);
  elsif p_action = 'start' then
    delete from public.trustleaf_calendar_oauth where expires_at <= now() or subject = p_subject;
    insert into public.trustleaf_calendar_oauth(state_hash, subject, payload) values(p_key, p_subject, p_value);
    return '{}'::jsonb;
  elsif p_action = 'save' then
    insert into public.trustleaf_calendar_connections(subject, refresh_ciphertext) values(p_subject, p_value)
      on conflict(subject) do update set refresh_ciphertext = excluded.refresh_ciphertext, updated_at = now();
    return '{}'::jsonb;
  elsif p_action = 'status' then
    return jsonb_build_object('connected', exists(select 1 from public.trustleaf_calendar_connections where subject = p_subject));
  else
    raise exception 'Unsupported operation';
  end if;
end $$;
revoke all on function public.trustleaf_calendar_connection(text,text,text,text) from public, anon, authenticated;
grant execute on function public.trustleaf_calendar_connection(text,text,text,text) to service_role;
commit;
