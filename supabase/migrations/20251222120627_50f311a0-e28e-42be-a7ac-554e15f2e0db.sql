-- Create a table for plan-specific messages (messages for user-created activities)
CREATE TABLE public.plan_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.user_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.plan_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view messages for activities they've joined or created
CREATE POLICY "Users can view plan messages for their activities"
ON public.plan_messages
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- User is the activity creator
    EXISTS (
      SELECT 1 FROM public.user_activities 
      WHERE id = activity_id AND user_id = auth.uid()
    )
    OR
    -- User has joined this activity
    EXISTS (
      SELECT 1 FROM public.activity_joins 
      WHERE activity_id = plan_messages.activity_id AND user_id = auth.uid()
    )
  )
);

-- Users can insert messages for activities they've joined or created
CREATE POLICY "Users can send plan messages"
ON public.plan_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    -- User is the activity creator
    EXISTS (
      SELECT 1 FROM public.user_activities 
      WHERE id = activity_id AND user_id = auth.uid()
    )
    OR
    -- User has joined this activity
    EXISTS (
      SELECT 1 FROM public.activity_joins 
      WHERE activity_id = plan_messages.activity_id AND user_id = auth.uid()
    )
  )
);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own plan messages"
ON public.plan_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for plan messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_messages;