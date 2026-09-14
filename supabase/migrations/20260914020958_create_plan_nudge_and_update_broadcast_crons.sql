-- Daily "take the initiative, create a plan" nudge — runs the
-- create-plan-nudge edge function once a day; the function itself scopes
-- who actually gets notified (day-5 / month-3 / month-6 tenure stages).
--
-- Auth header is pulled from Vault (vault.decrypted_secrets, name
-- 'SUPABASE_SERVICE_ROLE_KEY') rather than embedded as a literal — GitHub's
-- secret-scanning push protection rejects a commit with a real key in it,
-- and this is the same indirection post-activity-feedback's cron job
-- already uses (see 20260529000005_feedback_cron.sql).
select cron.schedule(
  'create-plan-nudge-daily',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://mpgrjzubegorcijgfjri.supabase.co/functions/v1/create-plan-nudge',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    timeout_milliseconds := 120000
  );
  $$
);

-- One-time "update the app" broadcast for 2026-09-19 at 14:00 UTC. This job
-- unschedules itself right after firing — it is a single blast, not a
-- yearly recurrence, so it must not sit around and fire again next Sep 19.
select cron.schedule(
  'broadcast-app-update-sep19',
  '0 14 19 9 *',
  $$
  select net.http_post(
    url := 'https://mpgrjzubegorcijgfjri.supabase.co/functions/v1/broadcast-app-update',
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    timeout_milliseconds := 120000
  );
  select cron.unschedule('broadcast-app-update-sep19');
  $$
);
