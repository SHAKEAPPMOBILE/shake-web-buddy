-- GIF messages (content = Giphy image URL).
ALTER TABLE public.event_chat_messages
DROP CONSTRAINT IF EXISTS event_chat_messages_message_type_check;

ALTER TABLE public.event_chat_messages
ADD CONSTRAINT event_chat_messages_message_type_check
CHECK (message_type IN ('text', 'sticker', 'video', 'gif'));

COMMENT ON COLUMN public.event_chat_messages.message_type IS 'text | sticker | video | gif';

-- Video uploads: path is {user_id}/{event_id}/{timestamp}.mp4 — replace INSERT policy.
DROP POLICY IF EXISTS "event_chat_videos_member_upload" ON storage.objects;
CREATE POLICY "event_chat_videos_member_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-chat-videos'
  AND array_length(storage.foldername(name), 1) = 2
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.event_chat_members ecm
    WHERE ecm.user_id = auth.uid()
      AND ecm.event_id = (storage.foldername(name))[2]
      AND (ecm.expires_at IS NULL OR ecm.expires_at > now())
  )
);
