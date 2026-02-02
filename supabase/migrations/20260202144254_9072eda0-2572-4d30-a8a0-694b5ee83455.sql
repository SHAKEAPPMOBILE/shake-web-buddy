-- Add onboarding_completed field to profiles_private
ALTER TABLE public.profiles_private 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;