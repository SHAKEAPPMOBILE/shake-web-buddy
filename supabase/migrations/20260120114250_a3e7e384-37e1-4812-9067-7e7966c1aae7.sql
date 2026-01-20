-- Add nationality and occupation columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN nationality text,
ADD COLUMN occupation text;