-- User-created plans (ProposePlanPage/CreateActivityDialog) with no explicit
-- capacity should be unlimited. The hardcoded cap of 7 stays only as the
-- fallback for standard auto-generated dinner/drinks/brunch groups
-- (is_auto_generated = true), matching MAX_GROUP_CAPACITY in
-- src/lib/activityGroups.ts. Any activity that sets an explicit capacity is
-- still enforced regardless of is_auto_generated.
CREATE OR REPLACE FUNCTION check_activity_group_cap()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_capacity INTEGER;
  explicit_capacity INTEGER;
  auto_generated BOOLEAN;
BEGIN
  SELECT capacity, is_auto_generated INTO explicit_capacity, auto_generated
  FROM user_activities
  WHERE id = NEW.activity_id;

  IF explicit_capacity IS NULL AND NOT COALESCE(auto_generated, false) THEN
    RETURN NEW;
  END IF;

  max_capacity := COALESCE(explicit_capacity, 7);

  SELECT COUNT(*) INTO current_count
  FROM activity_joins
  WHERE activity_id = NEW.activity_id
    AND (expires_at IS NULL OR expires_at > now());

  IF current_count >= max_capacity THEN
    RAISE EXCEPTION 'Activity is full (max % participants)', max_capacity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
