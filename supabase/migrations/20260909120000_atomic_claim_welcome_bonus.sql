-- claim_welcome_bonus previously did SELECT welcome_bonus_claimed, then a
-- separate UPDATE — under READ COMMITTED, two concurrent calls (e.g. two
-- mounted hook instances) could both read "not yet claimed" before either
-- commits, and both return true. Collapse the check-and-set into one atomic
-- UPDATE ... WHERE welcome_bonus_claimed = false RETURNING, so only the
-- transaction that actually flips the row ever gets true back.
CREATE OR REPLACE FUNCTION public.claim_welcome_bonus(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_now boolean;
BEGIN
  IF NOT public.is_profile_complete(target_user_id) THEN
    RETURN false;
  END IF;

  UPDATE public.profiles_private
  SET welcome_bonus_claimed = true
  WHERE user_id = target_user_id
    AND welcome_bonus_claimed = false
  RETURNING true INTO claimed_now;

  RETURN COALESCE(claimed_now, false);
END;
$$;
