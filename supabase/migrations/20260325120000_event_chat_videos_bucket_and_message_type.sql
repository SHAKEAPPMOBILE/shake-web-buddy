-- Event group chat: allow video messages (content = public storage URL).
ALTER TABLE public.event_chat_messages
DROP CONSTRAINT IF EXISTS event_chat_messages_message_type_check;

ALTER TABLE public.event_chat_messages
ADD CONSTRAINT event_chat_messages_message_type_check
CHECK (message_type IN ('text', 'sticker', 'video'));

COMMENT ON COLUMN public.event_chat_messages.message_type IS 'text | sticker | video; video content is public Supabase Storage URL';

-- Public bucket for inline playback; upload restricted to paid event members (path: event_id/user_id/filename).
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-chat-videos', 'event-chat-videos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "event_chat_videos_public_read" ON storage.objects;
CREATE POLICY "event_chat_videos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-chat-videos');

DROP POLICY IF EXISTS "event_chat_videos_member_upload" ON storage.objects;
CREATE POLICY "event_chat_videos_member_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-chat-videos'
  AND array_length(storage.foldername(name), 1) = 2
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.event_chat_members ecm
    WHERE ecm.user_id = auth.uid()
      AND ecm.event_id = (storage.foldername(name))[1]
      AND (ecm.expires_at IS NULL OR ecm.expires_at > now())
  )
);
