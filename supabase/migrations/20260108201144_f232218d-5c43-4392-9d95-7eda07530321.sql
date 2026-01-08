-- Add a note column to user_activities for short messages (max 50 characters)
ALTER TABLE public.user_activities ADD COLUMN note TEXT DEFAULT NULL;

-- Add a check constraint to limit note length
ALTER TABLE public.user_activities ADD CONSTRAINT user_activities_note_length CHECK (char_length(note) <= 50);