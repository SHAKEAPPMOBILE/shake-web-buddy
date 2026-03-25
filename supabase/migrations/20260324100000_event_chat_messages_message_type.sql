-- Event group chat: distinguish text vs sticker messages for UI rendering.
ALTER TABLE public.event_chat_messages
ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

ALTER TABLE public.event_chat_messages
DROP CONSTRAINT IF EXISTS event_chat_messages_message_type_check;

ALTER TABLE public.event_chat_messages
ADD CONSTRAINT event_chat_messages_message_type_check
CHECK (message_type IN ('text', 'sticker'));

COMMENT ON COLUMN public.event_chat_messages.message_type IS 'text | sticker; content holds body text or a single sticker emoji';
