-- Register nightly pg_cron job to purge expired activity_joins rows.
--
-- WHY THIS IS A SEPARATE FILE:
-- Migration ...002 included "CREATE EXTENSION IF NOT EXISTS pg_cron" before the
-- cron.schedule() call.  In Supabase, pg_cron is a managed system extension
-- (already installed — confirmed by 5 existing jobs in cron.job).  Running
-- CREATE EXTENSION on a managed extension from a migration aborts the statement
-- batch before cron.schedule() executes, so the job was never registered.
-- This file calls cron.schedule() directly with no extension DDL.
--
-- IDEMPOTENT: unschedule any pre-existing job with this name first so re-running
-- the migration never creates a duplicate.  The SELECT…FROM cron.job approach is
-- used instead of cron.unschedule('name') directly because cron.unschedule raises
-- an error when the job does not exist.

SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname = 'purge-expired-activity-joins';

-- Schedule: 03:00 UTC daily.  Grace period of 1 h avoids racing with in-flight
-- join operations that are close to their expiry window.
-- NOTE: single-quoted string avoids dollar-quoting issues in some migration runners.
SELECT cron.schedule(
  'purge-expired-activity-joins',
  '0 3 * * *',
  'DELETE FROM activity_joins WHERE expires_at < now() - interval ''1 hour'''
);
