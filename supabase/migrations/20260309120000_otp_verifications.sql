-- OTP verification codes for login/signup/forgot-password (used by send-bird-otp / verify-bird-otp).
-- Only edge functions (service role) use this table; no client access needed.
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id uuid PRIMARY KEY,
  phone_number text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL DEFAULT 'auth',
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone_created
  ON public.otp_verifications (phone_number, created_at DESC);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (edge functions) can access. Anon key cannot read/write.
