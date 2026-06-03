-- private_message_reactions: emoji reactions on DM messages
CREATE TABLE IF NOT EXISTS public.private_message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.private_message_reactions ENABLE ROW LEVEL SECURITY;

-- Both participants in a conversation can view reactions
CREATE POLICY "Users can view reactions on their messages"
  ON public.private_message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.private_messages pm
      WHERE pm.id = message_id
        AND (pm.sender_id = auth.uid() OR pm.receiver_id = auth.uid())
    )
  );

-- Users can add their own reactions
CREATE POLICY "Users can add their own reactions"
  ON public.private_message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can delete their own reactions"
  ON public.private_message_reactions FOR DELETE
  USING (auth.uid() = user_id);
