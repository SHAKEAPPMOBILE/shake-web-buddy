-- Add SMS notification preference column to profiles_private
ALTER TABLE public.profiles_private 
ADD COLUMN IF NOT EXISTS sms_notifications_enabled boolean NOT NULL DEFAULT true;