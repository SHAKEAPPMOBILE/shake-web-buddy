-- v4: remove the "joined_at > now() - 24h" clause that kept past-dated events
-- visible in My Plans for 24 hours after joining.
--
-- A joined plan now shows ONLY if:
--   1. activity_id IS NULL  → carousel slot (no fixed event date, own rule above)
--   2. scheduled_for IS NULL → standing/open-ended plan
--   3. scheduled_for + 24h > now() → event is upcoming or within 24h grace window
--
-- The joined_at clause was originally added in v3 to prevent an empty feed when
-- all plans were past-dated, but that problem was resolved by ensuring carousel
-- joins (activity_id IS NULL) and open-ended plans (scheduled_for IS NULL) are
-- always shown. Removing it prevents stale past events appearing in My Plans.

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
    -- show the join only when the event is still relevant:
    --   • carousel join (activity_id IS NULL) — always shown
    --   • no event date (scheduled_for IS NULL) — open-ended, always shown
    --   • event ended less than 24 h ago (grace window)
    AND (
      aj.activity_id IS NULL
      OR ua.scheduled_for IS NULL
      OR ua.scheduled_for + INTERVAL '24 hours' > now()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_active_plans(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_active_plans(uuid) TO authenticated;
