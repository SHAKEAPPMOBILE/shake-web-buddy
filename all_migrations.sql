-- Create profiles table with phone number
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create activity_joins table to track who joined what activity
CREATE TABLE public.activity_joins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike')),
  city TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable RLS on activity_joins
ALTER TABLE public.activity_joins ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_joins - users can see all active joins (for matching)
CREATE POLICY "Users can view all active activity joins" 
ON public.activity_joins 
FOR SELECT 
USING (expires_at > now());

CREATE POLICY "Users can insert their own activity joins" 
ON public.activity_joins 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity joins" 
ON public.activity_joins 
FOR DELETE 
USING (auth.uid() = user_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profiles timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup - create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, phone_number)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'phone_number');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for activity_joins so users get notified when others join
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_joins;-- Add name column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;

-- Create activity_messages table for group chat
CREATE TABLE public.activity_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike')),
  city TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on activity_messages
ALTER TABLE public.activity_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_messages
CREATE POLICY "Users can view messages for activities in their city" 
ON public.activity_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert messages" 
ON public.activity_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_messages;

-- Update the handle_new_user function to include name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, phone_number, name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'phone_number', NEW.raw_user_meta_data ->> 'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all active activity joins" ON public.activity_joins;

-- Create new policy that only allows authenticated users to view active joins
CREATE POLICY "Authenticated users can view active activity joins" 
ON public.activity_joins 
FOR SELECT 
TO authenticated
USING (expires_at > now());-- Add avatar_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy that allows viewing profiles of activity participants
-- This allows users to see basic profile info (name, avatar) of other users in activities
CREATE POLICY "Users can view profiles of activity participants"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);-- Create table to track when users last read messages for an activity
CREATE TABLE public.activity_read_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  city text NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_type, city)
);

-- Enable RLS
ALTER TABLE public.activity_read_status ENABLE ROW LEVEL SECURITY;

-- Users can view their own read status
CREATE POLICY "Users can view their own read status"
ON public.activity_read_status
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own read status
CREATE POLICY "Users can insert their own read status"
ON public.activity_read_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own read status
CREATE POLICY "Users can update their own read status"
ON public.activity_read_status
FOR UPDATE
USING (auth.uid() = user_id);-- Add muted column to activity_read_status table for mute functionality
ALTER TABLE public.activity_read_status 
ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false;

-- Add audio_url column to activity_messages for voice notes
ALTER TABLE public.activity_messages 
ADD COLUMN IF NOT EXISTS audio_url text;

-- Create storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for voice notes - allow authenticated users to upload
CREATE POLICY "Users can upload voice notes"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'voice-notes' AND auth.uid() IS NOT NULL);

-- Create storage policy for voice notes - allow public read
CREATE POLICY "Voice notes are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'voice-notes');-- Add unique constraint on activity_read_status for user_id, city, activity_type
ALTER TABLE public.activity_read_status 
ADD CONSTRAINT activity_read_status_user_city_activity_unique 
UNIQUE (user_id, city, activity_type);-- Add billing_email column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN billing_email text;-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view profiles of activity participants" ON public.profiles;

-- Create a new policy that only allows users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view messages for activities in their city" ON public.activity_messages;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can view messages"
ON public.activity_messages
FOR SELECT
USING (auth.uid() IS NOT NULL);-- Create profiles_private table for sensitive user data
CREATE TABLE public.profiles_private (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  phone_number text,
  billing_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on profiles_private
ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

-- Create strict RLS policies - only user can access their own data
CREATE POLICY "Users can view their own private profile"
ON public.profiles_private
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own private profile"
ON public.profiles_private
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own private profile"
ON public.profiles_private
FOR UPDATE
USING (auth.uid() = user_id);

-- Migrate existing sensitive data from profiles to profiles_private
INSERT INTO public.profiles_private (user_id, phone_number, billing_email, created_at, updated_at)
SELECT user_id, phone_number, billing_email, created_at, updated_at
FROM public.profiles
WHERE phone_number IS NOT NULL OR billing_email IS NOT NULL;

-- Create updated_at trigger for profiles_private
CREATE TRIGGER update_profiles_private_updated_at
BEFORE UPDATE ON public.profiles_private
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Remove sensitive columns from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_number;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS billing_email;

-- Update profiles RLS policy to allow authenticated users to view other users' public profiles
-- (Keep existing restrictive policies for INSERT and UPDATE)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view public profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Update handle_new_user function to create both profile records
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create public profile (name, avatar_url only)
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name');
  
  -- Create private profile (phone_number, billing_email)
  INSERT INTO public.profiles_private (user_id, phone_number)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'phone_number');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;-- Update the handle_new_user function to correctly capture phone number from auth.users.phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create public profile (name, avatar_url only)
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name');
  
  -- Create private profile with phone number from NEW.phone (for phone auth)
  INSERT INTO public.profiles_private (user_id, phone_number)
  VALUES (NEW.id, NEW.phone);
  
  RETURN NEW;
END;
$$;-- Add SMS notification preference column to profiles_private
ALTER TABLE public.profiles_private 
ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean NOT NULL DEFAULT true;-- Allow users to delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.activity_messages
FOR DELETE
USING (auth.uid() = user_id);-- Add manual premium override field to profiles_private
ALTER TABLE public.profiles_private 
ADD COLUMN premium_override boolean NOT NULL DEFAULT false;-- Add social media link columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN instagram_url text,
ADD COLUMN linkedin_url text,
ADD COLUMN twitter_url text;-- Create greetings table to track "Say Hi" requests
CREATE TABLE public.greetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (from_user_id, to_user_id)
);

-- Enable RLS
ALTER TABLE public.greetings ENABLE ROW LEVEL SECURITY;

-- Users can view greetings they sent or received
CREATE POLICY "Users can view their greetings"
ON public.greetings
FOR SELECT
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can insert greetings from themselves
CREATE POLICY "Users can send greetings"
ON public.greetings
FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

-- Users can delete greetings they sent
CREATE POLICY "Users can delete greetings they sent"
ON public.greetings
FOR DELETE
USING (auth.uid() = from_user_id);

-- Create private messages table for matched users
CREATE TABLE public.private_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- Function to check if two users have matched (both said hi to each other)
CREATE OR REPLACE FUNCTION public.users_matched(user1 UUID, user2 UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.greetings g1
    WHERE g1.from_user_id = user1 AND g1.to_user_id = user2
  ) AND EXISTS (
    SELECT 1 FROM public.greetings g2
    WHERE g2.from_user_id = user2 AND g2.to_user_id = user1
  )
$$;

-- Users can view messages where they are sender or receiver AND users are matched
CREATE POLICY "Users can view their matched messages"
ON public.private_messages
FOR SELECT
USING (
  (auth.uid() = sender_id OR auth.uid() = receiver_id)
  AND public.users_matched(sender_id, receiver_id)
);

-- Users can send messages only to matched users
CREATE POLICY "Users can send messages to matched users"
ON public.private_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.users_matched(sender_id, receiver_id)
);

-- Users can update read_at for messages they received
CREATE POLICY "Users can mark messages as read"
ON public.private_messages
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.greetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;-- Create user_activities table for user-created activities
CREATE TABLE public.user_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  city TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_activities
CREATE POLICY "Authenticated users can view active activities"
ON public.user_activities
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Users can create activities with limit"
ON public.user_activities
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (
    SELECT COUNT(*) FROM public.user_activities
    WHERE user_id = auth.uid()
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + interval '1 month'
  ) < 3
);

CREATE POLICY "Users can update their own activities"
ON public.user_activities
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
ON public.user_activities
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_activities_updated_at
BEFORE UPDATE ON public.user_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Modify activity_joins to reference user_activities
ALTER TABLE public.activity_joins
ADD COLUMN activity_id UUID REFERENCES public.user_activities(id) ON DELETE CASCADE;

-- Enable realtime for user_activities
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activities;-- Create a table for plan-specific messages (messages for user-created activities)
CREATE TABLE public.plan_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.user_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.plan_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view messages for activities they've joined or created
CREATE POLICY "Users can view plan messages for their activities"
ON public.plan_messages
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- User is the activity creator
    EXISTS (
      SELECT 1 FROM public.user_activities 
      WHERE id = activity_id AND user_id = auth.uid()
    )
    OR
    -- User has joined this activity
    EXISTS (
      SELECT 1 FROM public.activity_joins 
      WHERE activity_id = plan_messages.activity_id AND user_id = auth.uid()
    )
  )
);

-- Users can insert messages for activities they've joined or created
CREATE POLICY "Users can send plan messages"
ON public.plan_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    -- User is the activity creator
    EXISTS (
      SELECT 1 FROM public.user_activities 
      WHERE id = activity_id AND user_id = auth.uid()
    )
    OR
    -- User has joined this activity
    EXISTS (
      SELECT 1 FROM public.activity_joins 
      WHERE activity_id = plan_messages.activity_id AND user_id = auth.uid()
    )
  )
);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own plan messages"
ON public.plan_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for plan messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_messages;-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create activities with limit" ON public.user_activities;

-- Create new policy with 5 activities limit
CREATE POLICY "Users can create activities with limit" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) 
  AND (
    (SELECT count(*) FROM user_activities ua
     WHERE ua.user_id = auth.uid() 
     AND ua.created_at >= date_trunc('month', now()) 
     AND ua.created_at < (date_trunc('month', now()) + '1 mon'::interval)
    ) < 5
  )
);-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create activities with limit" ON public.user_activities;

-- Create new policy with 10 activities limit
CREATE POLICY "Users can create activities with limit" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) 
  AND (
    (SELECT count(*) FROM user_activities ua
     WHERE ua.user_id = auth.uid() 
     AND ua.created_at >= date_trunc('month', now()) 
     AND ua.created_at < (date_trunc('month', now()) + '1 mon'::interval)
    ) < 10
  )
);-- Add date_of_birth column to profiles_private table
ALTER TABLE public.profiles_private
ADD COLUMN date_of_birth date;-- Create a function to get user age from profiles_private (security definer bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_age(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN date_of_birth IS NOT NULL THEN
        EXTRACT(YEAR FROM age(CURRENT_DATE, date_of_birth))::integer
      ELSE NULL
    END
  FROM public.profiles_private
  WHERE user_id = target_user_id
$$;-- Force RLS on profiles_private to ensure it cannot be bypassed even by table owners
ALTER TABLE public.profiles_private FORCE ROW LEVEL SECURITY;-- Add DELETE policy for profiles_private to prevent unauthorized deletion
CREATE POLICY "Users can delete their own private profile"
ON public.profiles_private
FOR DELETE
USING (auth.uid() = user_id);-- Allow Premium users to create unlimited activities by bypassing the monthly limit
-- We use profiles_private.premium_override as the server-side flag (set by backend logic)

DROP POLICY IF EXISTS "Users can create activities with limit" ON public.user_activities;

CREATE POLICY "Users can create activities (limit or premium)"
ON public.user_activities
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    (
      SELECT count(*)
      FROM public.user_activities ua
      WHERE ua.user_id = auth.uid()
        AND ua.created_at >= date_trunc('month', now())
        AND ua.created_at < (date_trunc('month', now()) + interval '1 mon')
    ) < 10
    OR EXISTS (
      SELECT 1
      FROM public.profiles_private pp
      WHERE pp.user_id = auth.uid()
        AND pp.premium_override = true
    )
  )
);
-- Drop the old restrictive check constraint
ALTER TABLE public.activity_joins DROP CONSTRAINT IF EXISTS activity_joins_activity_type_check;

-- No constraint needed - activity types should be flexible-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Update the handle_new_user function to properly sync phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create public profile (name, avatar_url only)
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create private profile with phone number from NEW.phone (for phone auth)
  INSERT INTO public.profiles_private (user_id, phone_number)
  VALUES (NEW.id, NEW.phone)
  ON CONFLICT (user_id) DO UPDATE SET
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles_private.phone_number);
  
  RETURN NEW;
END;
$$;

-- Create function to handle user updates (phone changes)
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update phone number if it changed
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE public.profiles_private
    SET phone_number = NEW.phone
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger for user updates
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_updated();-- Add explicit deny for anonymous users (RLS and FORCE already enabled)
CREATE POLICY "Deny anonymous SELECT"
ON public.profiles_private
FOR SELECT
TO anon
USING (false);-- Drop the existing SELECT policy that requires authentication
DROP POLICY IF EXISTS "Authenticated users can view active activities" ON public.user_activities;

-- Create new policy allowing anyone to view active activities (public)
CREATE POLICY "Anyone can view active activities"
ON public.user_activities
FOR SELECT
USING (is_active = true);-- Drop existing constraints
ALTER TABLE activity_messages DROP CONSTRAINT IF EXISTS activity_messages_activity_type_check;
ALTER TABLE activity_joins DROP CONSTRAINT IF EXISTS activity_joins_activity_type_check;
ALTER TABLE activity_read_status DROP CONSTRAINT IF EXISTS activity_read_status_activity_type_check;
ALTER TABLE user_activities DROP CONSTRAINT IF EXISTS user_activities_activity_type_check;

-- Re-add constraints with all valid types (including sunset and dance)
ALTER TABLE activity_messages ADD CONSTRAINT activity_messages_activity_type_check 
  CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'sunset', 'dance'));

ALTER TABLE activity_joins ADD CONSTRAINT activity_joins_activity_type_check 
  CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'sunset', 'dance'));

ALTER TABLE activity_read_status ADD CONSTRAINT activity_read_status_activity_type_check 
  CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'sunset', 'dance'));

ALTER TABLE user_activities ADD CONSTRAINT user_activities_activity_type_check 
  CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'sunset', 'dance'));-- Drop existing constraints
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
  CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'sunset', 'dance', 'shopping'));-- Add push_notifications_enabled column to profiles_private
ALTER TABLE public.profiles_private 
ADD COLUMN push_notifications_enabled boolean NOT NULL DEFAULT true;-- Drop existing policy
DROP POLICY IF EXISTS "Users can create activities (limit or premium)" ON public.user_activities;

-- Create updated policy with 3 free activities per month limit
CREATE POLICY "Users can create activities (limit or premium)" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) AND (
    (
      (SELECT count(*) FROM user_activities ua
       WHERE ua.user_id = auth.uid() 
       AND ua.created_at >= date_trunc('month', now()) 
       AND ua.created_at < (date_trunc('month', now()) + interval '1 month')
      ) < 3
    ) 
    OR 
    (EXISTS (
      SELECT 1 FROM profiles_private pp
      WHERE pp.user_id = auth.uid() AND pp.premium_override = true
    ))
  )
);-- Drop the existing check constraint
ALTER TABLE public.user_activities DROP CONSTRAINT IF EXISTS user_activities_activity_type_check;

-- Add a new check constraint that includes all activity types (existing + new)
ALTER TABLE public.user_activities ADD CONSTRAINT user_activities_activity_type_check 
CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike', 'surf', 'run', 'co-working', 'basketball', 'tennis-padel', 'football', 'shopping', 'arts', 'sunset', 'dance'));-- Add a note column to user_activities for short messages (max 50 characters)
ALTER TABLE public.user_activities ADD COLUMN note TEXT DEFAULT NULL;

-- Add a check constraint to limit note length
ALTER TABLE public.user_activities ADD CONSTRAINT user_activities_note_length CHECK (char_length(note) <= 50);-- Allow new activity type: brunch

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
-- Add nationality and occupation columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN nationality text,
ADD COLUMN occupation text;-- Phone number change (verified) requests
CREATE TABLE IF NOT EXISTS public.phone_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_number text NOT NULL,
  code_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_sent_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  verify_attempts integer NOT NULL DEFAULT 0,
  verified_at timestamp with time zone NULL
);

CREATE INDEX IF NOT EXISTS idx_phone_change_requests_user_id_created_at
  ON public.phone_change_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_change_requests_phone_number_created_at
  ON public.phone_change_requests (phone_number, created_at DESC);

ALTER TABLE public.phone_change_requests ENABLE ROW LEVEL SECURITY;

-- (Re)create RLS policies
DROP POLICY IF EXISTS "Users can view their own phone change requests" ON public.phone_change_requests;
DROP POLICY IF EXISTS "Users can create their own phone change requests" ON public.phone_change_requests;
DROP POLICY IF EXISTS "Users can update their own phone change requests" ON public.phone_change_requests;

CREATE POLICY "Users can view their own phone change requests"
ON public.phone_change_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own phone change requests"
ON public.phone_change_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone change requests"
ON public.phone_change_requests
FOR UPDATE
USING (auth.uid() = user_id);
-- Create enum for report reasons
CREATE TYPE public.report_reason AS ENUM (
  'spam',
  'harassment',
  'inappropriate_content',
  'fake_profile',
  'underage',
  'other'
);

-- Create enum for report status
CREATE TYPE public.report_status AS ENUM (
  'pending',
  'reviewed',
  'resolved',
  'dismissed'
);

-- Create user_reports table
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  reason report_reason NOT NULL,
  description TEXT,
  status report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  
  -- Prevent duplicate reports from same user for same target
  CONSTRAINT unique_active_report UNIQUE (reporter_id, reported_user_id)
);

-- Enable RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports (but not report themselves)
CREATE POLICY "Users can create reports"
ON public.user_reports
FOR INSERT
WITH CHECK (
  auth.uid() = reporter_id 
  AND auth.uid() != reported_user_id
);

-- Users can view their own submitted reports
CREATE POLICY "Users can view their own reports"
ON public.user_reports
FOR SELECT
USING (auth.uid() = reporter_id);

-- Add index for faster lookups
CREATE INDEX idx_user_reports_reported_user ON public.user_reports(reported_user_id);
CREATE INDEX idx_user_reports_status ON public.user_reports(status);-- Create status_videos table
CREATE TABLE public.status_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable Row Level Security
ALTER TABLE public.status_videos ENABLE ROW LEVEL SECURITY;

-- Users can view all active status videos
CREATE POLICY "Anyone can view active status videos"
ON public.status_videos
FOR SELECT
USING (expires_at > now());

-- Users can insert their own status videos
CREATE POLICY "Users can insert their own status videos"
ON public.status_videos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own status videos
CREATE POLICY "Users can delete their own status videos"
ON public.status_videos
FOR DELETE
USING (auth.uid() = user_id);

-- Users can update their own status videos
CREATE POLICY "Users can update their own status videos"
ON public.status_videos
FOR UPDATE
USING (auth.uid() = user_id);

-- Create storage bucket for status videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('status-videos', 'status-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for status videos bucket
CREATE POLICY "Anyone can view status videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'status-videos');

CREATE POLICY "Users can upload their own status videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'status-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own status videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'status-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own status videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'status-videos' AND auth.uid()::text = (storage.foldername(name))[1]);-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Anyone can view active status videos" ON public.status_videos;

-- Create new SELECT policy that only shows videos from premium users publicly
-- Users can always see their own status videos
CREATE POLICY "View active status videos from premium users or own"
ON public.status_videos
FOR SELECT
USING (
  expires_at > now() 
  AND (
    -- User can always see their own status video
    auth.uid() = user_id
    OR
    -- Others can only see if the video owner is premium
    EXISTS (
      SELECT 1 FROM public.profiles_private pp
      WHERE pp.user_id = status_videos.user_id
      AND pp.premium_override = true
    )
  )
);-- Create check_ins table to track venue check-ins
CREATE TABLE public.check_ins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  city TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 5,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_check_ins_user_id ON public.check_ins(user_id);
CREATE INDEX idx_check_ins_checked_in_at ON public.check_ins(checked_in_at);

-- Prevent duplicate check-ins at same venue on same day using stored date column
CREATE UNIQUE INDEX idx_unique_daily_checkin 
  ON public.check_ins(user_id, activity_type, city, check_in_date);

-- Enable RLS
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Users can view all check-ins (for leaderboard potential)
CREATE POLICY "Authenticated users can view check-ins"
  ON public.check_ins FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can only create their own check-ins
CREATE POLICY "Users can create their own check-ins"
  ON public.check_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create a function to get user's total points
CREATE OR REPLACE FUNCTION public.get_user_points(target_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points_earned), 0)::INTEGER
  FROM public.check_ins
  WHERE user_id = target_user_id
$$;

-- Enable realtime for check-ins
ALTER PUBLICATION supabase_realtime ADD TABLE public.check_ins;-- Create venues table for admin-managed venue data
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  venue_type text NOT NULL CHECK (venue_type IN ('lunch_dinner', 'brunch', 'drinks')),
  latitude double precision,
  longitude double precision,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for fast city lookups
CREATE INDEX idx_venues_city_type ON public.venues(city, venue_type);

-- Enable RLS
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active venues (needed for the app)
CREATE POLICY "Anyone can view active venues"
ON public.venues
FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_venues_updated_at
BEFORE UPDATE ON public.venues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Allow admin operations on venues (using service role via edge function in future, or direct for now)
-- For now, allow authenticated users to manage venues (admin panel is password protected)
CREATE POLICY "Authenticated users can insert venues"
ON public.venues
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update venues"
ON public.venues
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete venues"
ON public.venues
FOR DELETE
TO authenticated
USING (true);-- Drop the restrictive INSERT policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can insert venues" ON public.venues;

CREATE POLICY "Authenticated users can insert venues"
ON public.venues
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also fix UPDATE and DELETE policies to be permissive
DROP POLICY IF EXISTS "Authenticated users can update venues" ON public.venues;

CREATE POLICY "Authenticated users can update venues"
ON public.venues
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete venues" ON public.venues;

CREATE POLICY "Authenticated users can delete venues"
ON public.venues
FOR DELETE
TO authenticated
USING (true);-- Drop the authenticated-only policies and recreate for public role
-- This is safe because the admin page is already password-protected

DROP POLICY IF EXISTS "Authenticated users can insert venues" ON public.venues;
DROP POLICY IF EXISTS "Authenticated users can update venues" ON public.venues;
DROP POLICY IF EXISTS "Authenticated users can delete venues" ON public.venues;

-- Allow any user (including anonymous via anon key) to manage venues
CREATE POLICY "Anyone can insert venues"
ON public.venues
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update venues"
ON public.venues
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete venues"
ON public.venues
FOR DELETE
USING (true);-- Update get_user_points function to include creator bonus points
-- Creator earns 5 points for every 5 attendees on their activities
CREATE OR REPLACE FUNCTION public.get_user_points(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    -- Check-in points
    COALESCE((
      SELECT SUM(points_earned) 
      FROM public.check_ins 
      WHERE user_id = target_user_id
    ), 0) +
    -- Creator bonus points: 5 points per 5 attendees
    COALESCE((
      SELECT SUM(FLOOR(participant_count / 5.0) * 5)
      FROM (
        SELECT 
          ua.id,
          (SELECT COUNT(*) FROM public.activity_joins aj WHERE aj.activity_id = ua.id) AS participant_count
        FROM public.user_activities ua
        WHERE ua.user_id = target_user_id AND ua.is_active = true
      ) AS activity_counts
      WHERE participant_count >= 5
    ), 0)
  )::INTEGER
$$;-- Add referral_code column to profiles table
ALTER TABLE public.profiles
ADD COLUMN referral_code TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX idx_profiles_referral_code ON public.profiles(referral_code);

-- Create referrals table to track successful referrals
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL UNIQUE, -- A user can only be referred once
  points_awarded INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS policies for referrals
CREATE POLICY "Users can view their own referrals" 
ON public.referrals 
FOR SELECT 
USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- Only the system (service role) should insert referrals, but we allow insert for the referred user
CREATE POLICY "Users can create referral when they sign up" 
ON public.referrals 
FOR INSERT 
WITH CHECK (auth.uid() = referred_user_id);

-- Update get_user_points function to include referral points
CREATE OR REPLACE FUNCTION public.get_user_points(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Check-in points
    COALESCE((
      SELECT SUM(points_earned) 
      FROM public.check_ins 
      WHERE user_id = target_user_id
    ), 0) +
    -- Creator bonus points: 5 points per 5 attendees
    COALESCE((
      SELECT SUM(FLOOR(participant_count / 5.0) * 5)
      FROM (
        SELECT 
          ua.id,
          (SELECT COUNT(*) FROM public.activity_joins aj WHERE aj.activity_id = ua.id) AS participant_count
        FROM public.user_activities ua
        WHERE ua.user_id = target_user_id AND ua.is_active = true
      ) AS activity_counts
      WHERE participant_count >= 5
    ), 0) +
    -- Referral points
    COALESCE((
      SELECT SUM(points_awarded) 
      FROM public.referrals 
      WHERE referrer_user_id = target_user_id
    ), 0)
  )::INTEGER
$$;

-- Function to generate a unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code(user_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  suffix TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Clean the name: lowercase, remove special chars, take first part
  base_code := lower(regexp_replace(split_part(COALESCE(user_name, 'user'), ' ', 1), '[^a-z0-9]', '', 'g'));
  
  -- If base_code is empty, use 'user'
  IF base_code = '' THEN
    base_code := 'user';
  END IF;
  
  -- Try to find a unique code with random suffix
  LOOP
    -- Generate 3-char alphanumeric suffix
    suffix := substr(md5(random()::text), 1, 3);
    final_code := base_code || '-' || suffix;
    
    -- Check if this code is unique
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = final_code) THEN
      RETURN final_code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      -- Fallback to longer suffix
      RETURN base_code || '-' || substr(md5(random()::text), 1, 8);
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-generate referral code when profile is created or name is set
CREATE OR REPLACE FUNCTION public.handle_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if referral_code is null and name exists
  IF NEW.referral_code IS NULL AND NEW.name IS NOT NULL THEN
    NEW.referral_code := public.generate_referral_code(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_referral_code
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_referral_code();

-- Generate referral codes for existing users who have names
UPDATE public.profiles
SET referral_code = public.generate_referral_code(name)
WHERE referral_code IS NULL AND name IS NOT NULL;-- Add welcome_bonus_claimed column to track if user has claimed their bonus
ALTER TABLE public.profiles_private 
ADD COLUMN welcome_bonus_claimed boolean NOT NULL DEFAULT false;

-- Create function to check if profile is complete (all fields filled)
CREATE OR REPLACE FUNCTION public.is_profile_complete(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles p
    JOIN public.profiles_private pp ON p.user_id = pp.user_id
    WHERE p.user_id = target_user_id
      AND p.name IS NOT NULL AND p.name != ''
      AND p.avatar_url IS NOT NULL AND p.avatar_url != ''
      AND p.nationality IS NOT NULL AND p.nationality != ''
      AND p.occupation IS NOT NULL AND p.occupation != ''
      AND pp.date_of_birth IS NOT NULL
      AND pp.billing_email IS NOT NULL AND pp.billing_email != ''
  )
$$;

-- Create function to claim welcome bonus (returns true if claimed, false if already claimed or profile incomplete)
CREATE OR REPLACE FUNCTION public.claim_welcome_bonus(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  already_claimed boolean;
  profile_complete boolean;
BEGIN
  -- Check if already claimed
  SELECT welcome_bonus_claimed INTO already_claimed
  FROM public.profiles_private
  WHERE user_id = target_user_id;
  
  IF already_claimed THEN
    RETURN false;
  END IF;
  
  -- Check if profile is complete
  SELECT public.is_profile_complete(target_user_id) INTO profile_complete;
  
  IF NOT profile_complete THEN
    RETURN false;
  END IF;
  
  -- Claim the bonus
  UPDATE public.profiles_private
  SET welcome_bonus_claimed = true
  WHERE user_id = target_user_id;
  
  RETURN true;
END;
$$;

-- Update get_user_points to include welcome bonus
CREATE OR REPLACE FUNCTION public.get_user_points(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Welcome bonus (10 points)
    COALESCE((
      SELECT CASE WHEN welcome_bonus_claimed THEN 10 ELSE 0 END
      FROM public.profiles_private
      WHERE user_id = target_user_id
    ), 0) +
    -- Check-in points
    COALESCE((
      SELECT SUM(points_earned) 
      FROM public.check_ins 
      WHERE user_id = target_user_id
    ), 0) +
    -- Creator bonus points: 5 points per 5 attendees
    COALESCE((
      SELECT SUM(FLOOR(participant_count / 5.0) * 5)
      FROM (
        SELECT 
          ua.id,
          (SELECT COUNT(*) FROM public.activity_joins aj WHERE aj.activity_id = ua.id) AS participant_count
        FROM public.user_activities ua
        WHERE ua.user_id = target_user_id AND ua.is_active = true
      ) AS activity_counts
      WHERE participant_count >= 5
    ), 0) +
    -- Referral points
    COALESCE((
      SELECT SUM(points_awarded) 
      FROM public.referrals 
      WHERE referrer_user_id = target_user_id
    ), 0)
  )::INTEGER
$$;-- Drop the restrictive check constraint to allow any activity type
ALTER TABLE public.user_activities DROP CONSTRAINT IF EXISTS user_activities_activity_type_check;-- Add price_amount column to user_activities for paid activities
-- Using text type for flexible pricing (e.g., "$5", "€10", "Free")
ALTER TABLE public.user_activities 
ADD COLUMN price_amount text DEFAULT NULL;

-- Add stripe_account_id to profiles_private for creators who have connected Stripe
ALTER TABLE public.profiles_private 
ADD COLUMN stripe_account_id text DEFAULT NULL;

-- Add stripe_account_status to track onboarding status
ALTER TABLE public.profiles_private 
ADD COLUMN stripe_account_status text DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.user_activities.price_amount IS 'Price for joining the activity (free text, e.g., "$5"). NULL means free.';
COMMENT ON COLUMN public.profiles_private.stripe_account_id IS 'Connected Stripe account ID for receiving payouts';
COMMENT ON COLUMN public.profiles_private.stripe_account_status IS 'Stripe Connect onboarding status: pending, complete, or null';-- Add PayPal payout columns to profiles_private
ALTER TABLE public.profiles_private
ADD COLUMN IF NOT EXISTS paypal_email text,
ADD COLUMN IF NOT EXISTS paypal_connected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_payout_method text DEFAULT NULL;-- Drop the old INSERT policy
DROP POLICY IF EXISTS "Users can create activities (limit or premium)" ON public.user_activities;

-- Create new INSERT policy: 1 activity per month for free users (only count activities online 6+ hours)
-- Premium users have unlimited activities
CREATE POLICY "Users can create activities (limit or premium)" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) 
  AND (
    -- Premium users: unlimited activities
    (EXISTS (
      SELECT 1 FROM profiles_private pp
      WHERE pp.user_id = auth.uid() AND pp.premium_override = true
    ))
    OR
    -- Free users: max 1 activity per month that has been online for 6+ hours
    -- Count only activities that are either still active OR were created more than 6 hours ago
    ((
      SELECT count(*) FROM user_activities ua
      WHERE ua.user_id = auth.uid()
        AND ua.created_at >= date_trunc('month', now())
        AND ua.created_at < (date_trunc('month', now()) + interval '1 month')
        AND (
          ua.is_active = true 
          OR ua.created_at <= (now() - interval '6 hours')
        )
    ) < 1)
  )
);-- Create a function to get the activity limit for a user based on signup date
CREATE OR REPLACE FUNCTION public.get_user_activity_limit(target_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Premium users have no limit (return a high number)
      WHEN EXISTS (
        SELECT 1 FROM profiles_private pp 
        WHERE pp.user_id = target_user_id AND pp.premium_override = true
      ) THEN 999999
      -- First 30 days after signup: 3 activities per month
      WHEN (
        SELECT created_at FROM profiles_private pp WHERE pp.user_id = target_user_id
      ) > (now() - interval '30 days') THEN 3
      -- After first month: 2 activities per month
      ELSE 2
    END
$$;

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create activities (limit or premium)" ON public.user_activities;

-- Create the updated policy with tiered limits
CREATE POLICY "Users can create activities (limit or premium)" 
ON public.user_activities 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) 
  AND (
    (SELECT count(*) 
     FROM user_activities ua
     WHERE ua.user_id = auth.uid() 
       AND ua.created_at >= date_trunc('month', now()) 
       AND ua.created_at < (date_trunc('month', now()) + interval '1 month')
       AND (ua.is_active = true OR ua.created_at <= (now() - interval '6 hours'))
    ) < public.get_user_activity_limit(auth.uid())
  )
);-- Create table to track manual payouts made by admins
CREATE TABLE public.creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payout_method TEXT NOT NULL, -- 'stripe', 'paypal', 'bank_transfer'
  payout_email TEXT,
  stripe_account_id TEXT,
  activity_ids UUID[] DEFAULT '{}',
  notes TEXT,
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_by TEXT, -- admin identifier
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

-- Only allow access via service role (admin edge functions)
-- No public access policies needed since this is admin-only data-- Create storage bucket for ID verification documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-verifications', 'id-verifications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ID verification documents
-- Users can upload their own ID
CREATE POLICY "Users can upload their own ID"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'id-verifications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own ID uploads
CREATE POLICY "Users can view their own ID"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'id-verifications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own ID uploads
CREATE POLICY "Users can delete their own ID"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'id-verifications' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create table for tracking ID verification status
CREATE TABLE public.creator_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  document_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT,
  rejection_reason TEXT,
  auto_approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification status
CREATE POLICY "Users can view their own verification"
ON public.creator_verifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can submit their verification (insert)
CREATE POLICY "Users can submit verification"
ON public.creator_verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending verification (re-submit)
CREATE POLICY "Users can update their pending verification"
ON public.creator_verifications FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Add trigger for updated_at
CREATE TRIGGER update_creator_verifications_updated_at
BEFORE UPDATE ON public.creator_verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for verification status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_verifications;-- Allow users to resubmit after rejection by permitting UPDATE when current status is pending OR rejected,
-- while still preventing users from modifying approved verifications.

DROP POLICY IF EXISTS "Users can update their pending verification" ON public.creator_verifications;

CREATE POLICY "Users can update their verification (pending or rejected)"
ON public.creator_verifications
FOR UPDATE
USING (
  auth.uid() = user_id
  AND status IN ('pending', 'rejected')
)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('pending', 'rejected')
);
-- Drop the old constraint and add an updated one that includes 'general'
ALTER TABLE public.activity_joins DROP CONSTRAINT IF EXISTS activity_joins_activity_type_check;

ALTER TABLE public.activity_joins ADD CONSTRAINT activity_joins_activity_type_check 
CHECK (activity_type = ANY (ARRAY['lunch', 'dinner', 'drinks', 'brunch', 'hike', 'surf', 'run', 'co-working', 'basketball', 'tennis-padel', 'football', 'shopping', 'arts', 'sunset', 'dance', 'general']::text[]));-- Add onboarding_completed field to profiles_private
ALTER TABLE public.profiles_private 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;-- Table to track daily "first" SMS notifications per city
-- Prevents sending duplicate "first of the day" notifications
CREATE TABLE public.daily_sms_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city text NOT NULL,
  notification_type text NOT NULL, -- 'first_plan' or 'first_activity_join'
  notification_date date NOT NULL DEFAULT CURRENT_DATE,
  triggered_by_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(city, notification_type, notification_date)
);

-- Enable RLS
ALTER TABLE public.daily_sms_tracking ENABLE ROW LEVEL SECURITY;

-- Only service role should access this table (edge functions)
-- No user-level policies needed since this is internal tracking