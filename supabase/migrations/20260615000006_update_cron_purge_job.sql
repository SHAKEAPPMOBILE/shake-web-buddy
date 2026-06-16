-- Updates the nightly purge job registered in 20260615000004 so that the DB
-- deletion boundary matches the feed visibility rule in get_my_active_plans v2.
--
-- NEW PURGE RULE (single definition of "expired"):
--   • Real-plan joins  (activity_id IS NOT NULL):
--       delete when ua.scheduled_for + 24 hours < now()
--       (rows whose plan has no scheduled_for are left alone — open-ended)
--   • Carousel joins   (activity_id IS NULL):
--       keep the existing expires_at-based rule (their own rolling window)
--
-- Unschedule the old job first (idempotent), then register the new command.

SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname = 'purge-expired-activity-joins';

SELECT cron.schedule(
  'purge-expired-activity-joins',
  '0 3 * * *',
  'DELETE FROM activity_joins
   WHERE (activity_id IS NOT NULL
          AND activity_id IN (
            SELECT id FROM user_activities
            WHERE scheduled_for + interval ''24 hours'' < now()
          ))
      OR (activity_id IS NULL
          AND expires_at IS NOT NULL
          AND expires_at < now() - interval ''1 hour'')'
);
