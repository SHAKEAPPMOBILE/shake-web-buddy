-- Add price_amount column to user_activities for paid activities
-- Using text type for flexible pricing (e.g., "$5", "€10", "Free")
ALTER TABLE public.user_activities 
ADD COLUMN price_amount text DEFAULT NULL;

-- Add stripe_account_id to profiles_private for creators who have connected Stripe
ALTER TABLE public.profiles_private 
ADD COLUMN stripe_account_id text DEFAULT NULL;

-- Add stripe_account_status to track onboarding status
ALTER TABLE public.profiles_private 
ADD COLUMN stripe_account_status text DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.user_activities.price_amount IS 'Price for joining the activity (free text, e.g., "$5"). NULL means free.';
COMMENT ON COLUMN public.profiles_private.stripe_account_id IS 'Connected Stripe account ID for receiving payouts';
COMMENT ON COLUMN public.profiles_private.stripe_account_status IS 'Stripe Connect onboarding status: pending, complete, or null';