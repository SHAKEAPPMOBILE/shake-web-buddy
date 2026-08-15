-- Add venue_lat/venue_lng to get_my_active_plans so "My Plans" entries can be
-- placed at their exact tagged location on the map, matching city-discovery
-- plans (which already carry these via a plain `select("*")`). Additive
-- trailing columns only — existing callers reading known columns are
-- unaffected. Postgres won't let CREATE OR REPLACE change a RETURNS TABLE
-- shape, so the function must be dropped and recreated; grants are
-- reapplied explicitly since DROP FUNCTION clears them.
DROP FUNCTION IF EXISTS public.get_my_active_plans(uuid);

CREATE FUNCTION public.get_my_active_plans(p_user_id uuid)
RETURNS TABLE(
  join_id uuid,
  activity_id uuid,
  activity_type text,
  city text,
  expires_at timestamp with time zone,
  joined_at timestamp with time zone,
  plan_id uuid,
  plan_user_id uuid,
  scheduled_for timestamp with time zone,
  is_active boolean,
  note text,
  price_amount text,
  group_number integer,
  is_auto_generated boolean,
  created_at timestamp with time zone,
  is_carousel boolean,
  audience text,
  venue_lat double precision,
  venue_lng double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    (aj.activity_id IS NULL)     AS is_carousel,
    ua.audience,
    ua.venue_lat,
    ua.venue_lng
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_active_plans(uuid) TO anon, authenticated, service_role;
