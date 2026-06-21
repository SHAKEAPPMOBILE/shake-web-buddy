-- Fix check_activity_group_cap: enforce 7-person cap only on system-generated
-- (is_auto_generated = true) plans. User-created plans (is_auto_generated false/null)
-- have no cap and can accept any number of joins.

CREATE OR REPLACE FUNCTION check_activity_group_cap()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  is_system BOOLEAN;
BEGIN
  SELECT is_auto_generated INTO is_system
  FROM user_activities WHERE id = NEW.activity_id;

  -- No cap on user-created plans (is_auto_generated false or null)
  IF is_system IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM activity_joins WHERE activity_id = NEW.activity_id;

  IF current_count >= 7 THEN
    RAISE EXCEPTION 'Activity group is full (max 7 participants)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger binding is unchanged — still BEFORE INSERT on activity_joins.
DROP TRIGGER IF EXISTS enforce_activity_cap ON activity_joins;
CREATE TRIGGER enforce_activity_cap
  BEFORE INSERT ON activity_joins
  FOR EACH ROW EXECUTE FUNCTION check_activity_group_cap();
