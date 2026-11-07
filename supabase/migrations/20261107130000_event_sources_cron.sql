-- Refresh every connected event source once a day.
select cron.schedule(
  'sync-event-sources-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://mpgrjzubegorcijgfjri.supabase.co/functions/v1/sync-event-source',
    body := '{"all": true}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    timeout_milliseconds := 120000
  );
  $$
);
