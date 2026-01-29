-- Add PayPal payout columns to profiles_private
ALTER TABLE public.profiles_private
ADD COLUMN IF NOT EXISTS paypal_email text,
ADD COLUMN IF NOT EXISTS paypal_connected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_payout_method text DEFAULT NULL;