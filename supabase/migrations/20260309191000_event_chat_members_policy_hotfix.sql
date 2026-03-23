-- Hotfix recursive/unsafe SELECT policies on event_chat_members.
-- Keep only a non-recursive own-membership policy.

DROP POLICY IF EXISTS "Users can view chat members" ON public.event_chat_members;
DROP POLICY IF EXISTS "Users can check membership" ON public.event_chat_members;
DROP POLICY IF EXISTS "Users can view members of chats they belong to" ON public.event_chat_members;
DROP POLICY IF EXISTS "Users can view event chat members" ON public.event_chat_members;
DROP POLICY IF EXISTS "Members can view event_chat_members" ON public.event_chat_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON public.event_chat_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.event_chat_members;

CREATE POLICY "Users can view event chat members"
ON public.event_chat_members
FOR SELECT
USING (auth.uid() = user_id);

