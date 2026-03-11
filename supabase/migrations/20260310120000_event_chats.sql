-- Event group chats: paid members only, auto-expire 12h after event start.
-- event_chats: one row per event (external id e.g. from Ticketmaster).
CREATE TABLE IF NOT EXISTS public.event_chats (
  event_id text PRIMARY KEY,
  name text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- event_chat_members: users who paid $1 to join (only they can read/write messages).
CREATE TABLE IF NOT EXISTS public.event_chat_members (
  event_id text NOT NULL REFERENCES public.event_chats(event_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_chat_members_user_id
  ON public.event_chat_members (user_id);

-- event_chat_messages: messages in the event chat (respect expires_at in app).
CREATE TABLE IF NOT EXISTS public.event_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL REFERENCES public.event_chats(event_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_chat_messages_event_id_created_at
  ON public.event_chat_messages (event_id, created_at DESC);

ALTER TABLE public.event_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;

-- event_chats: anyone can read (to show name/expires_at); only service or first member creates.
CREATE POLICY "Anyone can view event_chats"
ON public.event_chats FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create event_chats"
ON public.event_chats FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- event_chat_members: only members can see who is in the chat.
CREATE POLICY "Members can view event_chat_members"
ON public.event_chat_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_chat_members m
    WHERE m.event_id = event_chat_members.event_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join event chat (payment enforced in app)"
ON public.event_chat_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- event_chat_messages: only members can read/write.
CREATE POLICY "Members can view event_chat_messages"
ON public.event_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_chat_members m
    WHERE m.event_id = event_chat_messages.event_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send event_chat_messages"
ON public.event_chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.event_chat_members m
    WHERE m.event_id = event_chat_messages.event_id AND m.user_id = auth.uid()
  )
);

-- Realtime for event chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages;
