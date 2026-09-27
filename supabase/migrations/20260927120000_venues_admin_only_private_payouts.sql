-- Follow-up to 20260925120000_security_hardening.sql.

-- ---------------------------------------------------------------------------
-- 1. venues: anyone holding the public anon key (i.e. anyone) could insert,
--    edit or delete every venue. Admin writes now go through the
--    password-checked seed-test-users function (action=venues), which uses the
--    service role and bypasses RLS. Reads are unchanged.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can insert venues" ON public.venues;
DROP POLICY IF EXISTS "Anyone can update venues" ON public.venues;
DROP POLICY IF EXISTS "Anyone can delete venues" ON public.venues;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.venues FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. profiles is readable by everyone (even logged out), so payout handles and
--    face data stored there were public. Payout handles move to
--    profiles_private (owner-only). Face login is off (face-auth returns 410),
--    so face descriptors are no longer stored at all.
--
--    Older app builds still write payout_* / face_descriptor to profiles; the
--    trigger below redirects payout values to profiles_private and drops face
--    data, so those builds keep working without leaking anything.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles_private
  ADD COLUMN IF NOT EXISTS payout_paypal text,
  ADD COLUMN IF NOT EXISTS payout_bank text,
  ADD COLUMN IF NOT EXISTS payout_venmo text,
  ADD COLUMN IF NOT EXISTS payout_cashapp text;

UPDATE public.profiles_private pp
SET payout_paypal  = coalesce(pp.payout_paypal,  p.payout_paypal),
    payout_bank    = coalesce(pp.payout_bank,    p.payout_bank),
    payout_venmo   = coalesce(pp.payout_venmo,   p.payout_venmo),
    payout_cashapp = coalesce(pp.payout_cashapp, p.payout_cashapp)
FROM public.profiles p
WHERE p.user_id = pp.user_id
  AND coalesce(p.payout_paypal, p.payout_bank, p.payout_venmo, p.payout_cashapp) IS NOT NULL;

-- Payout handles for users without a profiles_private row yet.
INSERT INTO public.profiles_private (user_id, payout_paypal, payout_bank, payout_venmo, payout_cashapp)
SELECT p.user_id, p.payout_paypal, p.payout_bank, p.payout_venmo, p.payout_cashapp
FROM public.profiles p
WHERE coalesce(p.payout_paypal, p.payout_bank, p.payout_venmo, p.payout_cashapp) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles_private pp WHERE pp.user_id = p.user_id);

CREATE OR REPLACE FUNCTION public.keep_sensitive_fields_off_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.face_descriptor := NULL;
  NEW.face_auth_enabled := false;

  IF NEW.payout_paypal IS NOT NULL OR NEW.payout_bank IS NOT NULL
     OR NEW.payout_venmo IS NOT NULL OR NEW.payout_cashapp IS NOT NULL THEN
    INSERT INTO public.profiles_private (user_id, payout_paypal, payout_bank, payout_venmo, payout_cashapp)
    VALUES (NEW.user_id, NEW.payout_paypal, NEW.payout_bank, NEW.payout_venmo, NEW.payout_cashapp)
    ON CONFLICT (user_id) DO UPDATE SET
      payout_paypal  = coalesce(EXCLUDED.payout_paypal,  profiles_private.payout_paypal),
      payout_bank    = coalesce(EXCLUDED.payout_bank,    profiles_private.payout_bank),
      payout_venmo   = coalesce(EXCLUDED.payout_venmo,   profiles_private.payout_venmo),
      payout_cashapp = coalesce(EXCLUDED.payout_cashapp, profiles_private.payout_cashapp);
    NEW.payout_paypal := NULL;
    NEW.payout_bank := NULL;
    NEW.payout_venmo := NULL;
    NEW.payout_cashapp := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.keep_sensitive_fields_off_profiles() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS keep_sensitive_fields_off_profiles ON public.profiles;
CREATE TRIGGER keep_sensitive_fields_off_profiles
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.keep_sensitive_fields_off_profiles();

-- Clear what's already there (fires the trigger, which is a no-op for payouts
-- already copied above since coalesce keeps the private value).
UPDATE public.profiles
SET payout_paypal = NULL, payout_bank = NULL, payout_venmo = NULL, payout_cashapp = NULL,
    face_descriptor = NULL, face_auth_enabled = false
WHERE coalesce(payout_paypal, payout_bank, payout_venmo, payout_cashapp) IS NOT NULL
   OR face_descriptor IS NOT NULL
   OR face_auth_enabled;
