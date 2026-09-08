begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

-- Business conflicts are terminal HTTP 409s, not retryable serialization errors.
-- Preserve both reviewed function bodies and ACLs; replace only explicit raises.
do $migration$
declare
  target record;
  definition text;
  marker constant text := 'using errcode=''40001''';
begin
  for target in select * from (values
    ('public.trustleaf_operations_pilot(text,text,jsonb)', 14),
    ('trustleaf_private.pilot_booking_cancel_guard()', 1)
  ) as functions(signature, expected_count) loop
    select pg_get_functiondef(target.signature::regprocedure) into definition;
    if (length(definition) - length(replace(definition, marker, ''))) / length(marker)
      <> target.expected_count then
      raise exception 'PILOT_CONFLICT_MIGRATION_DEFINITION_CHANGED';
    end if;
    execute replace(definition, marker, 'using errcode=''PT409''');
  end loop;
end $migration$;

notify pgrst, 'reload schema';
commit;
