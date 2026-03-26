-- Track paid amount; allow users to upsert-update their own membership row after Stripe return.
ALTER TABLE public.event_chat_members
  ADD COLUMN IF NOT EXISTS amount_cents integer;

COMMENT ON COLUMN public.event_chat_members.amount_cents IS 'One-time event chat payment amount in cents (e.g. 100 = $1.00).';

DROP POLICY IF EXISTS "Users can update own event_chat_members" ON public.event_chat_members;
CREATE POLICY "Users can update own event_chat_members"
ON public.event_chat_members FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
