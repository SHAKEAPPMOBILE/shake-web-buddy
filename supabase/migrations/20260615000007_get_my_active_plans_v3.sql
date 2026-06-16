-- v3: relaxes the scheduled_for expiry filter so a join is shown when ANY of:
--   1. joined_at within the last 24 h (recently joined, event may be same-day)
--   2. scheduled_for IS NULL (open-ended plan)
--   3. scheduled_for + 24 h > now() (event ended less than 24 h ago)
-- This prevents the feed going empty when all plans are past-dated but joins are recent.

CREATE OR REPLACE FUNCTION public.get_my_active_plans(p_user_id uuid)
RETURNS TABLE (
  join_id           uuid,
  activity_id       uuid,
  activity_type     text,
  city              text,
  expires_at        timestamptz,
  joined_at         timestamptz,
  plan_id           uuid,
  plan_user_id      uuid,
  scheduled_for     timestamptz,
  is_active         boolean,
  note              text,
  price_amount      text,
  group_number      integer,
  is_auto_generated boolean,
  created_at        timestamptz,
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
    aj.user_id   = p_user_id
    AND auth.uid() = p_user_id
    -- non-expired carousel joins
    AND (aj.expires_at IS NULL OR aj.expires_at > now())
    -- real-plan joins: plan must exist and be active
    AND (
      aj.activity_id IS NULL
      OR (ua.id IS NOT NULL AND ua.is_active = true)
    )
    -- show the join when ANY of these is true:
    --   • joined recently (within 24 h) — catches same-day joins on past events
    --   • no event date — open-ended plan always shown
    --   • event ended less than 24 h ago
    AND (
      aj.activity_id IS NULL                                   -- carousel: own rule above
      OR aj.joined_at > now() - INTERVAL '24 hours'           -- recently joined
      OR ua.scheduled_for IS NULL                             -- no date set
      OR ua.scheduled_for + INTERVAL '24 hours' > now()       -- event recent enough
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_active_plans(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_active_plans(uuid) TO authenticated;
