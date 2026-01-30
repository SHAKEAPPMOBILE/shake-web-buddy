-- Create table to track manual payouts made by admins
CREATE TABLE public.creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payout_method TEXT NOT NULL, -- 'stripe', 'paypal', 'bank_transfer'
  payout_email TEXT,
  stripe_account_id TEXT,
  activity_ids UUID[] DEFAULT '{}',
  notes TEXT,
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_by TEXT, -- admin identifier
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

-- Only allow access via service role (admin edge functions)
-- No public access policies needed since this is admin-only data