-- Emoji reactions on event chat messages (toggle per user per emoji).
-- After deploy: in SQL Editor run once if PostgREST cache is stale: NOTIFY pgrst, 'reload schema';
CREATE TABLE public.event_chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.event_chat_messages (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  emoji text NOT NULL,
  CONSTRAINT event_chat_reactions_message_user_emoji_key UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_event_chat_reactions_message_id ON public.event_chat_reactions (message_id);

ALTER TABLE public.event_chat_reactions ENABLE ROW LEVEL SECURITY;

-- Chat members can read reactions on messages in their event chat.
CREATE POLICY "Members can view event_chat_reactions"
ON public.event_chat_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.event_chat_messages msg
    JOIN public.event_chats c ON c.id = msg.event_chat_id
    JOIN public.event_chat_members m ON m.event_id = c.event_id AND m.user_id = auth.uid()
    WHERE msg.id = event_chat_reactions.message_id
  )
);

-- Members can add their own reaction rows only.
CREATE POLICY "Members can insert own event_chat_reactions"
ON public.event_chat_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.event_chat_messages msg
    JOIN public.event_chats c ON c.id = msg.event_chat_id
    JOIN public.event_chat_members m ON m.event_id = c.event_id AND m.user_id = auth.uid()
    WHERE msg.id = event_chat_reactions.message_id
  )
);

-- Users can remove only their own reactions.
CREATE POLICY "Users can delete own event_chat_reactions"
ON public.event_chat_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_chat_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_reactions;
  END IF;
END $$;
