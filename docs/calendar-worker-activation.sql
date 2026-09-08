-- Operational activation, not a general migration. Apply only after deploying
-- /api/calendar-worker and storing the same CRON_SECRET in Vercel and Vault.
-- Vault secret name: trustleaf_calendar_worker_secret. Never put its value here.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name='trustleaf_calendar_worker_secret') then
    raise exception 'Calendar worker secret is not configured';
  end if;
end $$;

select cron.schedule('trustleaf-calendar-worker','* * * * *', $job$
  select net.http_get(
    url := 'https://www.trustleaf.org/api/calendar-worker',
    headers := jsonb_build_object('Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='trustleaf_calendar_worker_secret')),
    timeout_milliseconds := 60000
  );
$job$);
