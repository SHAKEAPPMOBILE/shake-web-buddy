-- Idempotent: some environments may lack message_type if older migrations were skipped.
ALTER TABLE public.event_chat_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

COMMENT ON COLUMN public.event_chat_messages.message_type IS 'text | sticker | video | gif';
