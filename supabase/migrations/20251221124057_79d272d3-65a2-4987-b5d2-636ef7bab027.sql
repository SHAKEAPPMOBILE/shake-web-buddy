-- Update the handle_new_user function to correctly capture phone number from auth.users.phone
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
$$;