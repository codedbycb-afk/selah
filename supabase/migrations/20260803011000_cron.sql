-- ============================================================
-- Selah — schedule the reminder sender
-- Runs every 10 minutes. daily-push resolves each device's local
-- time from its own timezone, so a 07:00 reminder lands 07:00-07:15.
--
-- The shared secret is read from Supabase Vault at run time, so it
-- never appears in this file (which lives in a public repo).
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('selah-daily-push')
where exists (select 1 from cron.job where jobname = 'selah-daily-push');

select cron.schedule(
  'selah-daily-push',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url     := 'https://kooikpwljxwsrokonpth.supabase.co/functions/v1/daily-push',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', (select decrypted_secret
                                     from vault.decrypted_secrets
                                    where name = 'selah_cron_secret')),
    body    := '{}'::jsonb
  );
  $job$
);
