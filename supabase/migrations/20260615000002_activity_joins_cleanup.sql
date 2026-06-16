-- ── 1. Cascade cleanup trigger ───────────────────────────────────────────────
-- When a plan is soft-deleted (is_active: true → false), immediately delete all
-- activity_joins rows pointing at it.  Without this, participants are left with
-- orphaned join rows that block them from joining other plans of the same type.
-- (Hard-deletes are already handled by the FK ON DELETE CASCADE on activity_id.)

CREATE OR REPLACE FUNCTION public.cleanup_joins_on_plan_deactivate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    DELETE FROM public.activity_joins WHERE activity_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_joins_on_deactivate ON public.user_activities;

CREATE TRIGGER trg_cleanup_joins_on_deactivate
AFTER UPDATE OF is_active ON public.user_activities
FOR EACH ROW EXECUTE FUNCTION public.cleanup_joins_on_plan_deactivate();


-- ── 2. Nightly pg_cron purge ─────────────────────────────────────────────────
-- Removes expired activity_joins rows (expires_at < now - 1 h) every day at
-- 03:00 UTC.  The 1-hour grace window avoids racing with in-flight operations.
-- pg_cron must be enabled on the Supabase project (Dashboard → Extensions).

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-expired-activity-joins',   -- job name (idempotent re-runs replace it)
  '0 3 * * *',                      -- 03:00 UTC daily
  $$
    DELETE FROM public.activity_joins
    WHERE  expires_at IS NOT NULL
      AND  expires_at < now() - INTERVAL '1 hour';
  $$
);
