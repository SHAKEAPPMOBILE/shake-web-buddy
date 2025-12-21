-- Create greetings table to track "Say Hi" requests
CREATE TABLE public.greetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (from_user_id, to_user_id)
);

-- Enable RLS
ALTER TABLE public.greetings ENABLE ROW LEVEL SECURITY;

-- Users can view greetings they sent or received
CREATE POLICY "Users can view their greetings"
ON public.greetings
FOR SELECT
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can insert greetings from themselves
CREATE POLICY "Users can send greetings"
ON public.greetings
FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

-- Users can delete greetings they sent
CREATE POLICY "Users can delete greetings they sent"
ON public.greetings
FOR DELETE
USING (auth.uid() = from_user_id);

-- Create private messages table for matched users
CREATE TABLE public.private_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- Function to check if two users have matched (both said hi to each other)
CREATE OR REPLACE FUNCTION public.users_matched(user1 UUID, user2 UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.greetings g1
    WHERE g1.from_user_id = user1 AND g1.to_user_id = user2
  ) AND EXISTS (
    SELECT 1 FROM public.greetings g2
    WHERE g2.from_user_id = user2 AND g2.to_user_id = user1
  )
$$;

-- Users can view messages where they are sender or receiver AND users are matched
CREATE POLICY "Users can view their matched messages"
ON public.private_messages
FOR SELECT
USING (
  (auth.uid() = sender_id OR auth.uid() = receiver_id)
  AND public.users_matched(sender_id, receiver_id)
);

-- Users can send messages only to matched users
CREATE POLICY "Users can send messages to matched users"
ON public.private_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.users_matched(sender_id, receiver_id)
);

-- Users can update read_at for messages they received
CREATE POLICY "Users can mark messages as read"
ON public.private_messages
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.greetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;