-- Add group_number to user_activities for overflow groups (max 7 per group)
ALTER TABLE user_activities ADD COLUMN IF NOT EXISTS group_number integer DEFAULT 1;

-- Index for efficient sibling group queries
CREATE INDEX IF NOT EXISTS user_activities_group_lookup
  ON user_activities (activity_type, city, scheduled_for, group_number)
  WHERE is_active = true;
