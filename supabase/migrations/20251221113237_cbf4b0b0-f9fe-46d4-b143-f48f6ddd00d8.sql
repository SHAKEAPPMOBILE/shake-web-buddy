-- Create profiles_private table for sensitive user data
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;