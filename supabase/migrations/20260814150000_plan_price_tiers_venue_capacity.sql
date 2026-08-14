-- Adds three independent plan-creation features:
--   1. Multiple named price tiers per activity (e.g. "Girls $10 / Boys $15")
--   2. A tagged venue (name/address/coordinates) separate from the broad city
--   3. A configurable participant capacity (replacing the hardcoded 7-cap
--      for user-created plans, while leaving standard Dinner/Brunch/etc.
--      activities on the existing default of 7)
--
-- price_amount stays as the source of truth for "is this activity paid" and
-- as the display/payout fallback — existing code across the app reads it.
-- price_tiers is purely additive: when present, the payment flow charges the
-- selected tier's amount instead of parsing price_amount.

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS price_tiers jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS capacity integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS venue_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS venue_address text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS venue_lat double precision DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS venue_lng double precision DEFAULT NULL;

COMMENT ON COLUMN public.user_activities.price_tiers IS
  'Optional array of {label, amount} price options, e.g. [{"label":"Girls","amount":10},{"label":"Boys","amount":15}]. NULL means single-price (see price_amount) or free.';
COMMENT ON COLUMN public.user_activities.capacity IS
  'Optional max participant count for user-created plans. NULL falls back to the standard 7-person group cap enforced by check_activity_group_cap().';

-- Records what was actually charged per join, so payout math can sum real
-- amounts instead of assuming every participant paid the same price —
-- required once an activity can have multiple price tiers.
ALTER TABLE public.activity_joins
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_tier_label text DEFAULT NULL;

COMMENT ON COLUMN public.activity_joins.amount_paid_cents IS
  'Actual amount charged for this join (cents, USD), set by the Stripe webhook on paid joins. NULL for free joins or joins predating this column.';
COMMENT ON COLUMN public.activity_joins.price_tier_label IS
  'Which price_tiers label (if any) this join paid for, e.g. "Girls".';

-- Extend the existing capacity-cap trigger to respect a per-activity
-- `capacity` value instead of a hardcoded 7 — falls back to 7 when NULL so
-- standard Dinner/Brunch/etc. activities (which never set capacity) are
-- unaffected.
CREATE OR REPLACE FUNCTION check_activity_group_cap()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_capacity INTEGER;
BEGIN
  SELECT COALESCE(capacity, 7) INTO max_capacity
  FROM user_activities
  WHERE id = NEW.activity_id;

  SELECT COUNT(*) INTO current_count
  FROM activity_joins
  WHERE activity_id = NEW.activity_id
    AND (expires_at IS NULL OR expires_at > now());

  IF current_count >= COALESCE(max_capacity, 7) THEN
    RAISE EXCEPTION 'Activity is full (max % participants)', COALESCE(max_capacity, 7);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
