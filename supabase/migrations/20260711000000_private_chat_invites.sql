-- Track whether a user has accepted or declined an unsolicited first-time DM
-- from someone else. Absence of a row means "pending" (invite gate should show).
-- user_id = the person being asked to accept/decline ("me" in the UI).
-- other_user_id = the person who sent the first message ("them").
CREATE TABLE IF NOT EXISTS public.private_chat_invites (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_user_id UUID NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('accepted', 'declined')),
  responded_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_user_id)
);

CREATE INDEX IF NOT EXISTS idx_pci_user ON public.private_chat_invites(user_id);

ALTER TABLE public.private_chat_invites ENABLE ROW LEVEL SECURITY;

-- Each user can only see their own invite decisions.
CREATE POLICY "pci_select_own"
ON public.private_chat_invites FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can only record decisions for themselves.
CREATE POLICY "pci_insert_own"
ON public.private_chat_invites FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Accept/decline can change (e.g. re-inviting after a decline).
CREATE POLICY "pci_update_own"
ON public.private_chat_invites FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
