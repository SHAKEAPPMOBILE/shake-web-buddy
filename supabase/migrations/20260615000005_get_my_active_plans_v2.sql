-- Replaces v1 (20260615000001).
-- Adds the "scheduled_for + 24 hours" expiry rule for real-plan joins so that
-- a plan whose event ended more than 24 h ago is hidden from the feed.
--
-- Rule:
--   • Real-plan join (activity_id IS NOT NULL):
--       hidden when ua.scheduled_for + 24h < now()
--       always shown when ua.scheduled_for IS NULL (open-ended plan)
--   • Carousel join (activity_id IS NULL):
--       always shown (no event date to check; governed by expires_at elsewhere)

CREATE OR REPLACE FUNCTION public.get_my_active_plans(p_user_id uuid)
RETURNS TABLE (
  join_id           uuid,
  activity_id       uuid,
  activity_type     text,
  city              text,
  expires_at        timestamptz,
  joined_at         timestamptz,
  -- linked plan (NULL for carousel joins)
  plan_id           uuid,
  plan_user_id      uuid,
  scheduled_for     timestamptz,
  is_active         boolean,
  note              text,
  price_amount      text,
  group_number      integer,
  is_auto_generated boolean,
  created_at        timestamptz,
  -- true when this is an open-interest carousel join (activity_id IS NULL)
  is_carousel       boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    aj.id                        AS join_id,
    aj.activity_id,
    aj.activity_type,
    aj.city,
    aj.expires_at::timestamptz,
    aj.joined_at::timestamptz,
    ua.id                        AS plan_id,
    ua.user_id                   AS plan_user_id,
    ua.scheduled_for::timestamptz,
    ua.is_active,
    ua.note,
    ua.price_amount,
    ua.group_number,
    ua.is_auto_generated,
    ua.created_at::timestamptz,
    (aj.activity_id IS NULL)     AS is_carousel
  FROM public.activity_joins aj
  LEFT JOIN public.user_activities ua ON ua.id = aj.activity_id
  WHERE
    -- caller must be the queried user
    aj.user_id   = p_user_id
    AND auth.uid() = p_user_id
    -- non-expired carousel joins (NULL expiry = permanent)
    AND (aj.expires_at IS NULL OR aj.expires_at > now())
    -- for real-plan joins: plan must still exist and be active
    AND (
      aj.activity_id IS NULL
      OR (ua.id IS NOT NULL AND ua.is_active = true)
    )
    -- ── NEW: hide real-plan joins whose event ended more than 24 h ago ──────
    -- Carousel joins (activity_id IS NULL) are always shown.
    -- Plans with no scheduled_for are always shown (open-ended).
    AND (
      aj.activity_id IS NULL
      OR ua.scheduled_for IS NULL
      OR ua.scheduled_for + INTERVAL '24 hours' > now()
    );
$$;

-- Permissions unchanged from v1.
REVOKE EXECUTE ON FUNCTION public.get_my_active_plans(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_active_plans(uuid) TO authenticated;
