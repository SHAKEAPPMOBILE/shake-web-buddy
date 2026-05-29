CREATE OR REPLACE FUNCTION check_activity_group_cap()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM activity_joins
  WHERE activity_id = NEW.activity_id;

  IF current_count >= 7 THEN
    RAISE EXCEPTION 'Activity group is full (max 7 participants)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_activity_cap ON activity_joins;
CREATE TRIGGER enforce_activity_cap
  BEFORE INSERT ON activity_joins
  FOR EACH ROW EXECUTE FUNCTION check_activity_group_cap();
