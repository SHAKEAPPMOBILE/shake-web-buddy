-- Messages reference event_chats.id (uuid). event_chats keeps Ticketmaster event_id as stable external key.
-- RLS: membership is still keyed by event_chat_members.event_id matching event_chats.event_id.

-- 1) Surrogate PK on event_chats
ALTER TABLE public.event_chats ADD COLUMN IF NOT EXISTS id uuid;

UPDATE public.event_chats SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.event_chats ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.event_chats ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2) Drop FKs that point at event_chats(event_id)
ALTER TABLE public.event_chat_messages DROP CONSTRAINT IF EXISTS event_chat_messages_event_id_fkey;
ALTER TABLE public.event_chat_members DROP CONSTRAINT IF EXISTS event_chat_members_event_id_fkey;

-- 3) Replace primary key on event_chats
ALTER TABLE public.event_chats DROP CONSTRAINT IF EXISTS event_chats_pkey;
ALTER TABLE public.event_chats ADD PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS event_chats_event_id_key ON public.event_chats (event_id);

-- 4) Restore member FK to external event_id (unchanged semantics for payments / RLS join)
ALTER TABLE public.event_chat_members
  ADD CONSTRAINT event_chat_members_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.event_chats (event_id) ON DELETE CASCADE;

-- 5) Migrate messages to event_chat_id → event_chats.id
ALTER TABLE public.event_chat_messages ADD COLUMN IF NOT EXISTS event_chat_id uuid;

UPDATE public.event_chat_messages m
SET event_chat_id = c.id
FROM public.event_chats c
WHERE c.event_id = m.event_id;

DELETE FROM public.event_chat_messages WHERE event_chat_id IS NULL;

ALTER TABLE public.event_chat_messages ALTER COLUMN event_chat_id SET NOT NULL;

-- Must drop every policy that references event_chat_messages.event_id (repo + dashboard names).
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_chat_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_chat_messages', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.event_chat_messages DROP COLUMN IF EXISTS event_id;

ALTER TABLE public.event_chat_messages
  ADD CONSTRAINT event_chat_messages_event_chat_id_fkey
  FOREIGN KEY (event_chat_id) REFERENCES public.event_chats (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.idx_event_chat_messages_event_id_created_at;

CREATE INDEX IF NOT EXISTS idx_event_chat_messages_event_chat_id_created_at
  ON public.event_chat_messages (event_chat_id, created_at DESC);

-- 6) RLS: same rule via join event_chats.event_id = members.event_id
CREATE POLICY "Members can view event_chat_messages"
ON public.event_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.event_chat_members m
    JOIN public.event_chats c ON c.event_id = m.event_id
    WHERE c.id = event_chat_messages.event_chat_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send event_chat_messages"
ON public.event_chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.event_chat_members m
    JOIN public.event_chats c ON c.event_id = m.event_id
    WHERE c.id = event_chat_messages.event_chat_id
      AND m.user_id = auth.uid()
  )
);
