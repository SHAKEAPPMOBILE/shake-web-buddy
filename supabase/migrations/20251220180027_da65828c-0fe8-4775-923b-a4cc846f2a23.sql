-- Add name column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;

-- Create activity_messages table for group chat
CREATE TABLE public.activity_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('lunch', 'dinner', 'drinks', 'hike')),
  city TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on activity_messages
ALTER TABLE public.activity_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_messages
CREATE POLICY "Users can view messages for activities in their city" 
ON public.activity_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert messages" 
ON public.activity_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_messages;

-- Update the handle_new_user function to include name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, phone_number, name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'phone_number', NEW.raw_user_meta_data ->> 'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;