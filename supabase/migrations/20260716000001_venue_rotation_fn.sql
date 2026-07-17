-- Weekly venue rotation function.
--
-- Advances is_current to the next venue (by sort_order) for each city +
-- venue_type group.  Designed to run at the start of each week (e.g. Monday
-- 00:00 UTC) via the rotate-venues Edge Function or pg_cron.
--
-- Safety guarantee:
--   Cities that already have one or more active activity_joins within the
--   current week window are SKIPPED — their is_current is left untouched.
--   This prevents mid-week disruption for groups that are already live.
--
-- To test without side effects, call in a transaction and ROLLBACK:
--   BEGIN; SELECT rotate_venues(); ROLLBACK;

CREATE OR REPLACE FUNCTION public.rotate_venues()
RETURNS TABLE(city text, venue_type text, old_venue text, new_venue text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r           record;
  venues_list record[];
  v           record;
  old_idx     int;
  new_idx     int;
  live_joins  int;
  week_start  timestamptz;
BEGIN
  week_start := date_trunc('week', now() AT TIME ZONE 'UTC');

  -- Iterate over every (city, venue_type) that has at least one active venue
  FOR r IN
    SELECT DISTINCT v.city, v.venue_type
    FROM public.venues v
    WHERE v.is_active = true
    ORDER BY v.city, v.venue_type
  LOOP
    -- Check whether this city already has live activity joins this week.
    -- If so, skip rotation to avoid changing venue mid-week for active groups.
    SELECT COUNT(*) INTO live_joins
    FROM public.activity_joins aj
    JOIN public.user_activities ua ON ua.id = aj.activity_id
    WHERE ua.city = r.city
      AND ua.is_active = true
      AND (
        -- venue_type → activity_type mapping
        (r.venue_type = 'lunch_dinner' AND ua.activity_type IN ('lunch', 'dinner'))
        OR (r.venue_type = 'brunch'       AND ua.activity_type = 'brunch')
        OR (r.venue_type = 'drinks'       AND ua.activity_type = 'drinks')
      )
      AND aj.created_at >= week_start;

    IF live_joins > 0 THEN
      CONTINUE; -- skip — live group exists
    END IF;

    -- Fetch all active venues for this city+type ordered by sort_order
    SELECT array_agg(v ORDER BY v.sort_order ASC)
    INTO venues_list
    FROM public.venues v
    WHERE v.city = r.city
      AND v.venue_type = r.venue_type
      AND v.is_active = true;

    IF venues_list IS NULL OR array_length(venues_list, 1) < 2 THEN
      CONTINUE; -- nothing to rotate (0 or 1 venue)
    END IF;

    -- Find current index (the venue with is_current = true, else default to 0)
    old_idx := 0;
    FOR i IN 1..array_length(venues_list, 1) LOOP
      IF (venues_list[i]).is_current THEN
        old_idx := i;
        EXIT;
      END IF;
    END LOOP;

    -- Advance to next (wraps around)
    new_idx := (old_idx % array_length(venues_list, 1)) + 1;

    -- Clear all is_current for this group, then set the new one
    UPDATE public.venues
    SET is_current = false
    WHERE city = r.city
      AND venue_type = r.venue_type
      AND is_active = true;

    UPDATE public.venues
    SET is_current = true
    WHERE id = (venues_list[new_idx]).id;

    -- Return audit row
    RETURN QUERY SELECT
      r.city::text,
      r.venue_type::text,
      (venues_list[old_idx]).name::text,
      (venues_list[new_idx]).name::text;
  END LOOP;
END;
$$;

-- Grant execute to the service-role so the Edge Function can call it
GRANT EXECUTE ON FUNCTION public.rotate_venues() TO service_role;

COMMENT ON FUNCTION public.rotate_venues() IS
  'Advances is_current to the next venue (by sort_order) for each city + venue_type, '
  'skipping any city that already has active joins this week.  '
  'Safe to run weekly via Edge Function or pg_cron.';
