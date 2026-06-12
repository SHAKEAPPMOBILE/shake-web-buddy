-- Replace the static UNIQUE constraint with a trigger-based active-only check.
--
-- Problem: UNIQUE (user_id, activity_type) blocked any user who had a previous
-- expired join from ever joining again — expired rows count against the constraint
-- even though the app treats them as gone.
--
-- Fix 1: Drop the unique constraint; enforce the one-active-per-type rule in a
-- BEFORE INSERT trigger that only looks at rows where expires_at IS NULL OR
-- expires_at > now().
--
-- Fix 2: Update check_activity_group_cap to count only active joins so that
-- groups with expired members can accept new ones.

-- ── 1. Drop the static unique constraint ────────────────────────────────────
ALTER TABLE public.activity_joins
  DROP CONSTRAINT IF EXISTS one_activity_per_user_per_type;

-- ── 2. Active-only duplicate check trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION check_one_active_per_type()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM activity_joins
    WHERE user_id       = NEW.user_id
      AND activity_type = NEW.activity_type
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION
      'User already has an active join for activity type %', NEW.activity_type
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_one_active_per_type ON activity_joins;
CREATE TRIGGER enforce_one_active_per_type
  BEFORE INSERT ON activity_joins
  FOR EACH ROW EXECUTE FUNCTION check_one_active_per_type();

-- ── 3. Active-only capacity cap trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION check_activity_group_cap()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM activity_joins
  WHERE activity_id = NEW.activity_id
    AND (expires_at IS NULL OR expires_at > now());

  IF current_count >= 7 THEN
    RAISE EXCEPTION 'Activity group is full (max 7 participants)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists (enforce_activity_cap); replace function is enough.
-- Re-create the trigger to be safe.
DROP TRIGGER IF EXISTS enforce_activity_cap ON activity_joins;
CREATE TRIGGER enforce_activity_cap
  BEFORE INSERT ON activity_joins
  FOR EACH ROW EXECUTE FUNCTION check_activity_group_cap();
