-- Drop existing trigger if any
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_updated();