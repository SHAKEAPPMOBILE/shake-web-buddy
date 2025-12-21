-- Add social media link columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN instagram_url text,
ADD COLUMN linkedin_url text,
ADD COLUMN twitter_url text;