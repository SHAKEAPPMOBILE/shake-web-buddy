-- Add manual payout method fields to profiles table.
-- These are filled by creators; we pay them manually from the dashboard.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_paypal  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_bank    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_venmo   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_cashapp text;
