-- Add member_count to event_chats for quick capacity checks
ALTER TABLE public.event_chats
  ADD COLUMN IF NOT EXISTS member_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activity_type text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS venue_name text,
  ADD COLUMN IF NOT EXISTS venue_id uuid;

-- Keep member_count in sync automatically
CREATE OR REPLACE FUNCTION sync_event_chat_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.event_chats
    SET member_count = member_count + 1
    WHERE event_id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.event_chats
    SET member_count = GREATEST(member_count - 1, 0)
    WHERE event_id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_count ON public.event_chat_members;
CREATE TRIGGER trg_sync_member_count
AFTER INSERT OR DELETE ON public.event_chat_members
FOR EACH ROW EXECUTE FUNCTION sync_event_chat_member_count();

-- Backfill existing counts
UPDATE public.event_chats ec
SET member_count = (
  SELECT COUNT(*) FROM public.event_chat_members m
  WHERE m.event_id = ec.event_id
);
