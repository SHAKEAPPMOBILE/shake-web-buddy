-- Add an explicit onboarding-completed flag to profiles.
--
-- The signup wizard's completeness gate previously inferred "onboarding
-- done" from name + avatar being present. Several unrelated code paths
-- (a DB trigger default avatar, a client fallback that wrote the email
-- prefix as name) could independently satisfy that heuristic, silently
-- skipping the question wizard for users who never actually went through
-- it. onboarding_completed_at is set exactly once, only by the wizard's
-- own "Complete Setup" save, so completeness no longer depends on
-- inferring intent from other columns' contents.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Backfill: profiles that already look complete (real name + real avatar,
-- and the name isn't the auto-generated email-prefix pattern) are treated
-- as having finished onboarding as of their last update, so existing users
-- aren't re-shown the wizard.
UPDATE public.profiles p
SET onboarding_completed_at = COALESCE(p.updated_at, p.created_at)
WHERE p.onboarding_completed_at IS NULL
  AND p.name IS NOT NULL
  AND btrim(p.name) <> ''
  AND p.avatar_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p.user_id
      AND lower(btrim(p.name)) = lower(split_part(u.email, '@', 1))
  );
