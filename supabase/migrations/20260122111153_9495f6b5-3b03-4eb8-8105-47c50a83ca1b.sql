-- Phone number change (verified) requests
CREATE TABLE IF NOT EXISTS public.phone_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_number text NOT NULL,
  code_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_sent_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  verify_attempts integer NOT NULL DEFAULT 0,
  verified_at timestamp with time zone NULL
);

CREATE INDEX IF NOT EXISTS idx_phone_change_requests_user_id_created_at
  ON public.phone_change_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_change_requests_phone_number_created_at
  ON public.phone_change_requests (phone_number, created_at DESC);

ALTER TABLE public.phone_change_requests ENABLE ROW LEVEL SECURITY;

-- (Re)create RLS policies
DROP POLICY IF EXISTS "Users can view their own phone change requests" ON public.phone_change_requests;
DROP POLICY IF EXISTS "Users can create their own phone change requests" ON public.phone_change_requests;
DROP POLICY IF EXISTS "Users can update their own phone change requests" ON public.phone_change_requests;

CREATE POLICY "Users can view their own phone change requests"
ON public.phone_change_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own phone change requests"
ON public.phone_change_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phone change requests"
ON public.phone_change_requests
FOR UPDATE
USING (auth.uid() = user_id);
