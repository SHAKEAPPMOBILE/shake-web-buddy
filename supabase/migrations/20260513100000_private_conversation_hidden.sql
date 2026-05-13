-- Track conversations a user has "left" (soft-delete per user).
-- When a row exists, that conversation is hidden from that user's Chat tab.
CREATE TABLE IF NOT EXISTS public.private_conversation_hidden (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_user_id UUID NOT NULL,
  hidden_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_user_id)
);

CREATE INDEX IF NOT EXISTS idx_pch_user ON public.private_conversation_hidden(user_id);

ALTER TABLE public.private_conversation_hidden ENABLE ROW LEVEL SECURITY;

-- Each user can only see their own hidden records.
CREATE POLICY "pch_select_own"
ON public.private_conversation_hidden FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can only insert for themselves.
CREATE POLICY "pch_insert_own"
ON public.private_conversation_hidden FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can only delete their own (used to "unhide" / re-join).
CREATE POLICY "pch_delete_own"
ON public.private_conversation_hidden FOR DELETE
TO authenticated
USING (user_id = auth.uid());
