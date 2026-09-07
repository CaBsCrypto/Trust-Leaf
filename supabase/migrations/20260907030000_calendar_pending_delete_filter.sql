begin;
-- PostgREST safeupdate requires an explicit filter even for retiring OAuth attempts.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.trustleaf_central_calendar_connection(text,text,text,text)'::regprocedure);
  if position('delete from public.trustleaf_central_calendar_oauth;' in definition) = 0 then
    raise exception 'Unexpected central calendar function definition';
  end if;
  execute replace(definition,
    'delete from public.trustleaf_central_calendar_oauth;',
    'delete from public.trustleaf_central_calendar_oauth where expires_at is not null;');
end $$;
commit;
