-- Add manual premium override field to profiles_private
ALTER TABLE public.profiles_private 
ADD COLUMN premium_override boolean NOT NULL DEFAULT false;