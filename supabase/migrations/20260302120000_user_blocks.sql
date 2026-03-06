-- User blocks: blocker can block another user; blocked user is hidden from blocker's feed and notifies developer
CREATE TABLE public.user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Users can insert their own blocks
CREATE POLICY "Users can block others"
ON public.user_blocks
FOR INSERT
WITH CHECK (auth.uid() = blocker_id AND auth.uid() != blocked_id);

-- Users can view their own blocks (who they have blocked)
CREATE POLICY "Users can view own blocks"
ON public.user_blocks
FOR SELECT
USING (auth.uid() = blocker_id);

-- Users can delete their own blocks (unblock)
CREATE POLICY "Users can unblock"
ON public.user_blocks
FOR DELETE
USING (auth.uid() = blocker_id);
