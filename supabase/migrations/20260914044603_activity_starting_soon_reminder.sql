-- Tracks whether the "starts in 1 hour" push has already gone out for an
-- activity, mirroring feedback_sent's already-established pattern.
alter table public.user_activities
  add column if not exists starting_soon_reminder_sent boolean not null default false;

-- Runs every 15 minutes, same cadence as post-activity-feedback.
select cron.schedule(
  'activity-starting-soon-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://mpgrjzubegorcijgfjri.supabase.co/functions/v1/activity-starting-soon-reminder',
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
