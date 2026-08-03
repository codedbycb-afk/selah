create or replace function public._selah_cron_check()
returns table(jobname text, schedule text, active boolean)
language sql security definer set search_path = public, cron as
$$ select j.jobname::text, j.schedule::text, j.active from cron.job j where j.jobname like 'selah%' $$;
grant execute on function public._selah_cron_check() to service_role;
