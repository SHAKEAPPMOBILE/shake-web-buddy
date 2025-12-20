-- Add billing_email column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN billing_email text;