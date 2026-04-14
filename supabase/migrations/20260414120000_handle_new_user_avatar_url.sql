-- Backfill avatar_url from OAuth provider metadata and assign a random preset
-- avatar for users (e.g. Apple) who have no picture in their metadata.
--
-- Changes to handle_new_user:
--   1. Reads avatar_url from raw_user_meta_data ->> 'picture' (Google) or
--      raw_user_meta_data ->> 'avatar_url' (other providers).
--   2. Falls back to a randomly chosen preset avatar (/avatars/avatar-new-1.png
--      through /avatars/avatar-new-8.png) when no picture is available (Apple).
--   3. Uses ON CONFLICT ... DO UPDATE so the trigger is safe to re-run and also
--      backfills name/avatar_url on existing rows where those columns are NULL.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name       text;
  v_avatar_url text;
BEGIN
  -- Resolve display name from metadata
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), '')
  );

  -- Resolve avatar: prefer provider picture, fall back to a random preset
  v_avatar_url := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'picture'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'avatar_url'), ''),
    '/avatars/avatar-new-' || (floor(random() * 8) + 1)::int || '.png'
  );

  -- Public profile
  BEGIN
    INSERT INTO public.profiles (user_id, name, avatar_url)
    VALUES (NEW.id, v_name, v_avatar_url)
    ON CONFLICT (user_id) DO UPDATE
      SET name       = COALESCE(public.profiles.name, EXCLUDED.name),
          avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profiles upsert failed for user %: %', NEW.id, SQLERRM;
  END;

  -- Private profile
  BEGIN
    INSERT INTO public.profiles_private (user_id, phone_number, billing_email)
    VALUES (NEW.id, NEW.phone, NEW.email)
    ON CONFLICT (user_id) DO UPDATE
      SET phone_number  = COALESCE(EXCLUDED.phone_number, public.profiles_private.phone_number),
          billing_email = COALESCE(EXCLUDED.billing_email, public.profiles_private.billing_email);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profiles_private upsert failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
