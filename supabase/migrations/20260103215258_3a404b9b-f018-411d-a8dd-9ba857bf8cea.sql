-- Add push_notifications_enabled column to profiles_private
ALTER TABLE public.profiles_private 
ADD COLUMN push_notifications_enabled boolean NOT NULL DEFAULT true;