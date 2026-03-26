-- Ensure event-chat-videos exists and policies allow upload + public playback.
-- (Fixes "Bucket not found" when the bucket was never created on a project.)

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-chat-videos', 'event-chat-videos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "event_chat_videos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "event_chat_videos_member_upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event chat videos" ON storage.objects;
DROP POLICY IF EXISTS "Public read event chat videos" ON storage.objects;

CREATE POLICY "Authenticated users can upload event chat videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-chat-videos');

CREATE POLICY "Public read event chat videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-chat-videos');
