-- Create city_events table for Claude-powered weekly event discovery
CREATE TABLE city_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  venue TEXT,
  address TEXT,
  event_date TIMESTAMPTZ,
  event_url TEXT,
  image_url TEXT,
  source TEXT DEFAULT 'claude_web_search',
  week_of DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE city_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view city events" ON city_events FOR SELECT USING (true);

-- Add title and is_auto_generated to user_activities for city event group chats
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT NULL;

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false;

-- Allow NULL user_id for system-generated activities (city events)
ALTER TABLE public.user_activities
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.user_activities
  ADD CONSTRAINT user_activities_user_id_required
  CHECK (user_id IS NOT NULL OR is_auto_generated = true);
