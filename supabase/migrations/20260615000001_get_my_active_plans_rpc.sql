-- Single source of truth for "what plans am I currently in?"
-- Used by both the Plans feed and the join guard so they can never disagree.
--
-- SECURITY DEFINER lets the function bypass the `is_active = true` RLS on
-- user_activities so a participant can still see their own joined-but-soft-deleted
-- plan data (e.g. to show a "this plan was cancelled" notice).  The WHERE clause
-- hard-checks auth.uid() = p_user_id so callers can never read another user's rows.
--
-- Returns one row per active join:
--   • Real-plan joins  (activity_id NOT NULL): all user_activities columns populated,
--     plan is excluded when is_active = false or the row was hard-deleted.
--   • Carousel joins   (activity_id IS NULL):  plan_* columns are all NULL,
--     is_carousel = true.  No >=3 threshold here — it is MY join.

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
    -- non-expired joins only (NULL expiry = permanent carousel join)
    AND (aj.expires_at IS NULL OR aj.expires_at > now())
    -- for real-plan joins: plan must still exist and be active
    AND (
      aj.activity_id IS NULL
      OR (ua.id IS NOT NULL AND ua.is_active = true)
    );
$$;

-- Only authenticated users may call this; they can only see their own rows anyway.
REVOKE EXECUTE ON FUNCTION public.get_my_active_plans(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_active_plans(uuid) TO authenticated;
