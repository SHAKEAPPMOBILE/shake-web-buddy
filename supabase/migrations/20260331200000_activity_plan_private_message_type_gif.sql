-- Support GIF messages (URL in message, message_type = 'gif') for activity, plan, and private chats.

ALTER TABLE public.activity_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

ALTER TABLE public.activity_messages
  DROP CONSTRAINT IF EXISTS activity_messages_message_type_check;

ALTER TABLE public.activity_messages
  ADD CONSTRAINT activity_messages_message_type_check
  CHECK (message_type IN ('text', 'gif'));

ALTER TABLE public.plan_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

ALTER TABLE public.plan_messages
  DROP CONSTRAINT IF EXISTS plan_messages_message_type_check;

ALTER TABLE public.plan_messages
  ADD CONSTRAINT plan_messages_message_type_check
  CHECK (message_type IN ('text', 'gif'));

ALTER TABLE public.private_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

ALTER TABLE public.private_messages
  DROP CONSTRAINT IF EXISTS private_messages_message_type_check;

ALTER TABLE public.private_messages
  ADD CONSTRAINT private_messages_message_type_check
  CHECK (message_type IN ('text', 'gif'));
