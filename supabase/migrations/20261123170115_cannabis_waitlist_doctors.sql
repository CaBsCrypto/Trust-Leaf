begin;

alter table trustleaf_private.cannabis_waitlist
  drop constraint cannabis_waitlist_audience_check,
  add constraint cannabis_waitlist_supported_audience_check
    check (audience in ('patient', 'doctor', 'dispensary'));

create or replace function public.trustleaf_cannabis_waitlist_signup(p_audience text, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(regexp_replace(p_email, '^[[:space:]]+|[[:space:]]+$', '', 'g'));
begin
  if p_audience is null or p_audience not in ('patient', 'doctor', 'dispensary')
    or normalized_email is null or char_length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'CANNABIS_WAITLIST_INVALID_SIGNUP' using errcode = '22023';
  end if;

  insert into trustleaf_private.cannabis_waitlist (audience, email)
    values (p_audience, normalized_email)
    on conflict (audience, email) do nothing;
  return jsonb_build_object('registered', true);
end $$;

commit;
