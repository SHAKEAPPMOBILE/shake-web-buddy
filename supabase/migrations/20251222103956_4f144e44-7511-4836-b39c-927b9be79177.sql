-- Create user_activities table for user-created activities
CREATE TABLE public.user_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  city TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_activities
CREATE POLICY "Authenticated users can view active activities"
ON public.user_activities
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Users can create activities with limit"
ON public.user_activities
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (
    SELECT COUNT(*) FROM public.user_activities
    WHERE user_id = auth.uid()
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + interval '1 month'
  ) < 3
);

CREATE POLICY "Users can update their own activities"
ON public.user_activities
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
ON public.user_activities
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_activities_updated_at
BEFORE UPDATE ON public.user_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Modify activity_joins to reference user_activities
ALTER TABLE public.activity_joins
ADD COLUMN activity_id UUID REFERENCES public.user_activities(id) ON DELETE CASCADE;

-- Enable realtime for user_activities
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_activities;