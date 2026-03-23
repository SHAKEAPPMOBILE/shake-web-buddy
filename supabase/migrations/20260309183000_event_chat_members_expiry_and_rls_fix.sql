-- Fix recursive RLS on event_chat_members and add explicit membership-expiry fields.

ALTER TABLE public.event_chat_members
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS event_name text,
  ADD COLUMN IF NOT EXISTS event_venue text,
  ADD COLUMN IF NOT EXISTS event_starts_at timestamp with time zone;

-- Backfill where possible.
UPDATE public.event_chat_members m
SET paid_at = COALESCE(m.paid_at, m.joined_at, now())
WHERE m.paid_at IS NULL;

UPDATE public.event_chat_members m
SET expires_at = COALESCE(
  m.expires_at,
  c.expires_at,
  CASE
    WHEN m.event_starts_at IS NOT NULL THEN m.event_starts_at + interval '12 hours'
    WHEN m.paid_at IS NOT NULL THEN m.paid_at + interval '24 hours'
    ELSE now() + interval '24 hours'
  END
)
FROM public.event_chats c
WHERE c.event_id = m.event_id
  AND m.expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_chat_members_user_event_expires
  ON public.event_chat_members (user_id, event_id, expires_at);

-- RLS: remove recursive policy and replace with non-recursive own-row policy.
DROP POLICY IF EXISTS "Members can view event_chat_members" ON public.event_chat_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.event_chat_members;
CREATE POLICY "Users can view their own memberships"
ON public.event_chat_members FOR SELECT
USING (auth.uid() = user_id);

