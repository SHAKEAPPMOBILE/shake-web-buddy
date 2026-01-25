-- Create status_videos table
CREATE TABLE public.status_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Enable Row Level Security
ALTER TABLE public.status_videos ENABLE ROW LEVEL SECURITY;

-- Users can view all active status videos
CREATE POLICY "Anyone can view active status videos"
ON public.status_videos
FOR SELECT
USING (expires_at > now());

-- Users can insert their own status videos
CREATE POLICY "Users can insert their own status videos"
ON public.status_videos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own status videos
CREATE POLICY "Users can delete their own status videos"
ON public.status_videos
FOR DELETE
USING (auth.uid() = user_id);

-- Users can update their own status videos
CREATE POLICY "Users can update their own status videos"
ON public.status_videos
FOR UPDATE
USING (auth.uid() = user_id);

-- Create storage bucket for status videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('status-videos', 'status-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for status videos bucket
CREATE POLICY "Anyone can view status videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'status-videos');

CREATE POLICY "Users can upload their own status videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'status-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own status videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'status-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own status videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'status-videos' AND auth.uid()::text = (storage.foldername(name))[1]);