-- Support video and image messages in plan and private chats.

-- Update plan_messages constraint to allow 'video' and 'image' types.
ALTER TABLE public.plan_messages
  DROP CONSTRAINT IF EXISTS plan_messages_message_type_check;

ALTER TABLE public.plan_messages
  ADD CONSTRAINT plan_messages_message_type_check
  CHECK (message_type IN ('text', 'gif', 'image', 'video'));

-- Update private_messages constraint to allow 'video' and 'image' types.
ALTER TABLE public.private_messages
  DROP CONSTRAINT IF EXISTS private_messages_message_type_check;

ALTER TABLE public.private_messages
  ADD CONSTRAINT private_messages_message_type_check
  CHECK (message_type IN ('text', 'gif', 'image', 'video'));

-- Update activity_messages constraint to allow 'video' and 'image' types.
ALTER TABLE public.activity_messages
  DROP CONSTRAINT IF EXISTS activity_messages_message_type_check;

ALTER TABLE public.activity_messages
  ADD CONSTRAINT activity_messages_message_type_check
  CHECK (message_type IN ('text', 'gif', 'image', 'video'));

-- Create public bucket for plan and private chat media (images + videos).
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Anyone can read (public bucket).
DROP POLICY IF EXISTS "chat_media_public_read" ON storage.objects;
CREATE POLICY "chat_media_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

-- Authenticated users can upload to their own user-id prefix only.
DROP POLICY IF EXISTS "chat_media_user_upload" ON storage.objects;
CREATE POLICY "chat_media_user_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own uploads.
DROP POLICY IF EXISTS "chat_media_user_delete" ON storage.objects;
CREATE POLICY "chat_media_user_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND array_length(storage.foldername(name), 1) >= 1
  AND (storage.foldername(name))[1] = auth.uid()::text
);
