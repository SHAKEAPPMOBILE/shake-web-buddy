-- Add feedback_sent flag to user_activities so we only send the post-activity
-- push notification once per activity instance.
ALTER TABLE user_activities
  ADD COLUMN IF NOT EXISTS feedback_sent boolean NOT NULL DEFAULT false;

-- Index to efficiently find activities that need feedback sent
CREATE INDEX IF NOT EXISTS idx_user_activities_feedback_pending
  ON user_activities (activity_type, scheduled_for)
  WHERE feedback_sent = false AND is_active = true;
