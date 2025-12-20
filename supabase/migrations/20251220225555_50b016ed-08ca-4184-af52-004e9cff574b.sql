-- Add muted column to activity_read_status table for mute functionality
ALTER TABLE public.activity_read_status 
ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false;

-- Add audio_url column to activity_messages for voice notes
ALTER TABLE public.activity_messages 
ADD COLUMN IF NOT EXISTS audio_url text;

-- Create storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for voice notes - allow authenticated users to upload
CREATE POLICY "Users can upload voice notes"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'voice-notes' AND auth.uid() IS NOT NULL);

-- Create storage policy for voice notes - allow public read
CREATE POLICY "Voice notes are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'voice-notes');