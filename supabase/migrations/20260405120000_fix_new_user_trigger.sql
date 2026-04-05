-- Harden auth->profile sync so signup/login OTP never fails with
-- "Database error saving new user" when trigger-side profile writes fail.

-- 1) Make new-user trigger resilient to RLS/schema/runtime issues.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Public profile
  BEGIN
    INSERT INTO public.profiles (user_id, name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name')
    ON CONFLICT (user_id) DO UPDATE
      SET name = COALESCE(public.profiles.name, EXCLUDED.name);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profiles upsert failed for user %: %', NEW.id, SQLERRM;
  END;

  -- Private profile
  BEGIN
    INSERT INTO public.profiles_private (user_id, phone_number, billing_email)
    VALUES (NEW.id, NEW.phone, NEW.email)
    ON CONFLICT (user_id) DO UPDATE
      SET phone_number = COALESCE(EXCLUDED.phone_number, public.profiles_private.phone_number),
          billing_email = COALESCE(EXCLUDED.billing_email, public.profiles_private.billing_email);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profiles_private upsert failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 2) Keep auth updates resilient as well.
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone OR NEW.email IS DISTINCT FROM OLD.email THEN
    BEGIN
      UPDATE public.profiles_private
      SET phone_number = COALESCE(NEW.phone, phone_number),
          billing_email = COALESCE(NEW.email, billing_email)
      WHERE user_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_user_updated: profiles_private update failed for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) If auth admin role exists, explicitly allow trigger writes under FORCE RLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'profiles_private'
        AND policyname = 'Auth admin can insert private profiles'
    ) THEN
      EXECUTE 'CREATE POLICY "Auth admin can insert private profiles"
               ON public.profiles_private
               FOR INSERT
               TO supabase_auth_admin
               WITH CHECK (true)';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'profiles_private'
        AND policyname = 'Auth admin can update private profiles'
    ) THEN
      EXECUTE 'CREATE POLICY "Auth admin can update private profiles"
               ON public.profiles_private
               FOR UPDATE
               TO supabase_auth_admin
               USING (true)
               WITH CHECK (true)';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'profiles'
        AND policyname = 'Auth admin can insert public profiles'
    ) THEN
      EXECUTE 'CREATE POLICY "Auth admin can insert public profiles"
               ON public.profiles
               FOR INSERT
               TO supabase_auth_admin
               WITH CHECK (true)';
    END IF;
  END IF;
END;
$$;