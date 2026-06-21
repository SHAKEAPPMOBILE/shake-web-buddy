-- Plan moderation: report table + auto-hide trigger
-- A plan is hidden automatically when it receives reports from >= 2 distinct users.

-- 1. New table: plan_reports
CREATE TABLE IF NOT EXISTS plan_reports (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id      uuid        NOT NULL,
  reporter_id  uuid        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, reporter_id)
);

-- 2. RLS on plan_reports
ALTER TABLE plan_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own report only
CREATE POLICY "Users can report a plan"
  ON plan_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- No SELECT policy → no one can read individual reports
-- (counts are read by the trigger running as SECURITY DEFINER)

-- 3. Add is_hidden to user_activities (idempotent)
ALTER TABLE user_activities
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- 4. Trigger function: auto-hide when distinct report count >= 2
CREATE OR REPLACE FUNCTION auto_hide_reported_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT reporter_id)
  INTO report_count
  FROM plan_reports
  WHERE plan_id = NEW.plan_id;

  IF report_count >= 2 THEN
    UPDATE user_activities
    SET is_hidden = true
    WHERE id = NEW.plan_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Bind trigger
DROP TRIGGER IF EXISTS trg_auto_hide_reported_plan ON plan_reports;
CREATE TRIGGER trg_auto_hide_reported_plan
  AFTER INSERT ON plan_reports
  FOR EACH ROW
  EXECUTE FUNCTION auto_hide_reported_plan();
