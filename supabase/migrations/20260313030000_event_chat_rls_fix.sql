-- Relaxed and explicit RLS policies for event chat tables

-- event_chats: anyone can view (already enabled), keep as-is for backwards compatibility
-- Ensure authenticated users can always see chats they are members of
DROP POLICY IF EXISTS "Anyone can view event_chats" ON public.event_chats;
CREATE POLICY "Anyone can view event_chats"
ON public.event_chats FOR SELECT
USING (true);

-- event_chat_members: members can see their own membership rows
DROP POLICY IF EXISTS "Members can view event_chat_members" ON public.event_chat_members;
CREATE POLICY "Members can view event_chat_members"
ON public.event_chat_members FOR SELECT
USING (user_id = auth.uid());

-- event_chat_messages: only members of the event chat can read/send messages
DROP POLICY IF EXISTS "Members can view event_chat_messages" ON public.event_chat_messages;
CREATE POLICY "Members can view event_chat_messages"
ON public.event_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_chat_members m
    WHERE m.event_id = event_chat_messages.event_id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can send event_chat_messages" ON public.event_chat_messages;
CREATE POLICY "Members can send event_chat_messages"
ON public.event_chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.event_chat_members m
    WHERE m.event_id = event_chat_messages.event_id AND m.user_id = auth.uid()
  )
);

