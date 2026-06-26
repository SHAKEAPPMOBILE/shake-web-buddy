-- Scope check_one_active_per_type to auto-generated plans only.
--
-- Previously the trigger blocked any second active join of the same
-- activity_type for a given user, regardless of whether the plan was
-- auto-generated (dinner slot, brunch slot) or user-created (e.g. two
-- different volleyball plans posted by different people).
--
-- Fix: mirror the guard already used in check_activity_group_cap
-- (migration 20260620000000). Look up is_auto_generated on user_activities
-- via NEW.activity_id:
--   • is_auto_generated = true  → enforce one-per-type (unchanged behaviour)
--   • is_auto_generated = false/null → RETURN NEW (allow the insert)
--   • activity_id IS NULL (carousel join) → is_system is NULL → IS NOT TRUE
--     → RETURN NEW (carousel slots are type-level interest, not event joins)
--
-- The trigger binding (enforce_one_active_per_type BEFORE INSERT) is unchanged.

CREATE OR REPLACE FUNCTION check_one_active_per_type()
RETURNS TRIGGER AS $$
DECLARE
  is_system BOOLEAN;
BEGIN
  -- Resolve whether the plan being joined is auto-generated.
  -- activity_id IS NULL for carousel joins; the subquery returns NULL in that
  -- case, so is_system stays NULL, and IS NOT TRUE fires → allow.
  SELECT is_auto_generated INTO is_system
  FROM user_activities
  WHERE id = NEW.activity_id;

  -- Only enforce one-per-type for system (auto-generated) plans.
  -- User-created plans (false/null) and carousel joins (NULL) skip the check.
  IF is_system IS NOT TRUE THEN
    RETURN NEW;
  END IF;

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
