-- Remove shake/match requirement from private_messages RLS.
-- Any authenticated user can now message any other user directly.

-- Drop all existing policies on private_messages
DROP POLICY IF EXISTS "Users can view their matched messages" ON public.private_messages;
DROP POLICY IF EXISTS "Users can send messages to matched users" ON public.private_messages;
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.private_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.private_messages;
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.private_messages;
DROP POLICY IF EXISTS "Users can send messages to shakers" ON public.private_messages;
DROP POLICY IF EXISTS "Users can read messages from shakers" ON public.private_messages;

-- New open policies: any authenticated user can message any other user
CREATE POLICY "authenticated users can send messages"
ON public.private_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "authenticated users can view their messages"
ON public.private_messages
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "authenticated users can update their messages"
ON public.private_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
