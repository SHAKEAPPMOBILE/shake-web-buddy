-- One reaction row per user per message (change emoji by replacing that row).

DELETE FROM public.event_chat_reactions r
WHERE EXISTS (
  SELECT 1
  FROM public.event_chat_reactions r2
  WHERE r2.message_id = r.message_id
    AND r2.user_id = r.user_id
    AND r2.id < r.id
);

ALTER TABLE public.event_chat_reactions
DROP CONSTRAINT IF EXISTS event_chat_reactions_message_user_emoji_key;

ALTER TABLE public.event_chat_reactions
ADD CONSTRAINT event_chat_reactions_message_user_key UNIQUE (message_id, user_id);
