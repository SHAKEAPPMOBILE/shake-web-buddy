-- Drop existing constraints
ALTER TABLE activity_messages DROP CONSTRAINT IF EXISTS activity_messages_activity_type_check;
ALTER TABLE activity_joins DROP CONSTRAINT IF EXISTS activity_joins_activity_type_check;
ALTER TABLE activity_read_status DROP CONSTRAINT IF EXISTS activity_read_status_activity_type_check;
ALTER TABLE user_activities DROP CONSTRAINT IF EXISTS user_activities_activity_type_check;

-- Re-add constraints with all valid types (including shopping)
ALTER TABLE activity_messages ADD CONSTRAINT activity_messages_activity_type_check 
  CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'sunset', 'dance', 'shopping'));

ALTER TABLE activity_joins ADD CONSTRAINT activity_joins_activity_type_check 
  CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'sunset', 'dance', 'shopping'));

ALTER TABLE activity_read_status ADD CONSTRAINT activity_read_status_activity_type_check 
  CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'sunset', 'dance', 'shopping'));

ALTER TABLE user_activities ADD CONSTRAINT user_activities_activity_type_check 
  CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'sunset', 'dance', 'shopping'));