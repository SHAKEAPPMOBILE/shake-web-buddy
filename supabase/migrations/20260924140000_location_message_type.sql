-- Allow shared-location messages (message = "lat,lng") in every chat table.
ALTER TABLE public.private_messages DROP CONSTRAINT IF EXISTS private_messages_message_type_check;
ALTER TABLE public.private_messages ADD CONSTRAINT private_messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','gif','image','video','location']));
ALTER TABLE public.plan_messages DROP CONSTRAINT IF EXISTS plan_messages_message_type_check;
ALTER TABLE public.plan_messages ADD CONSTRAINT plan_messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','gif','image','video','location']));
ALTER TABLE public.activity_messages DROP CONSTRAINT IF EXISTS activity_messages_message_type_check;
ALTER TABLE public.activity_messages ADD CONSTRAINT activity_messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','gif','image','video','location']));
