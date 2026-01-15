-- Allow new activity type: brunch

-- 1) activity_joins: used when joining carousel/city-wide activities
ALTER TABLE public.activity_joins
  DROP CONSTRAINT IF EXISTS activity_joins_activity_type_check;

ALTER TABLE public.activity_joins
  ADD CONSTRAINT activity_joins_activity_type_check
  CHECK (activity_type IN (
    'lunch','dinner','drinks','brunch','hike',
    'surf','run','co-working','basketball','tennis-padel','football','shopping','arts','sunset','dance'
  ));

-- 2) activity_messages: chat messages for city-wide activities
ALTER TABLE public.activity_messages
  DROP CONSTRAINT IF EXISTS activity_messages_activity_type_check;

ALTER TABLE public.activity_messages
  ADD CONSTRAINT activity_messages_activity_type_check
  CHECK (activity_type IN (
    'lunch','dinner','drinks','brunch','hike',
    'surf','run','co-working','basketball','tennis-padel','football','shopping','arts','sunset','dance'
  ));

-- 3) activity_read_status: read/mute state for activity chats
ALTER TABLE public.activity_read_status
  DROP CONSTRAINT IF EXISTS activity_read_status_activity_type_check;

ALTER TABLE public.activity_read_status
  ADD CONSTRAINT activity_read_status_activity_type_check
  CHECK (activity_type IN (
    'lunch','dinner','drinks','brunch','hike',
    'surf','run','co-working','basketball','tennis-padel','football','shopping','arts','sunset','dance'
  ));

-- 4) user_activities: planned activities (ensure brunch is allowed if used there)
ALTER TABLE public.user_activities
  DROP CONSTRAINT IF EXISTS user_activities_activity_type_check;

ALTER TABLE public.user_activities
  ADD CONSTRAINT user_activities_activity_type_check
  CHECK (activity_type IN (
    'lunch','dinner','drinks','brunch','hike',
    'surf','run','co-working','basketball','tennis-padel','football','shopping','arts','sunset','dance'
  ));
