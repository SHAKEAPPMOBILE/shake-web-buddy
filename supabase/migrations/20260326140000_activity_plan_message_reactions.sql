-- Reactions on carousel (activity_messages) and plan (plan_messages) chats — one row per user per message.

CREATE TABLE public.activity_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.activity_messages (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  emoji text NOT NULL,
  CONSTRAINT activity_message_reactions_message_user_key UNIQUE (message_id, user_id)
);

CREATE INDEX idx_activity_message_reactions_message_id ON public.activity_message_reactions (message_id);

ALTER TABLE public.activity_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view activity_message_reactions"
ON public.activity_message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.activity_messages msg
    JOIN public.activity_joins j
      ON j.activity_type = msg.activity_type
     AND j.city = msg.city
     AND j.user_id = auth.uid()
    WHERE msg.id = activity_message_reactions.message_id
      AND j.expires_at > now()
  )
);

CREATE POLICY "Members can insert own activity_message_reactions"
ON public.activity_message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.activity_messages msg
    JOIN public.activity_joins j
      ON j.activity_type = msg.activity_type
     AND j.city = msg.city
     AND j.user_id = auth.uid()
    WHERE msg.id = activity_message_reactions.message_id
      AND j.expires_at > now()
  )
);

CREATE POLICY "Users can delete own activity_message_reactions"
ON public.activity_message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.plan_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.plan_messages (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  emoji text NOT NULL,
  CONSTRAINT plan_message_reactions_message_user_key UNIQUE (message_id, user_id)
);

CREATE INDEX idx_plan_message_reactions_message_id ON public.plan_message_reactions (message_id);

ALTER TABLE public.plan_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view plan_message_reactions"
ON public.plan_message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.plan_messages pm
    WHERE pm.id = plan_message_reactions.message_id
      AND (
        EXISTS (
          SELECT 1 FROM public.user_activities ua
          WHERE ua.id = pm.activity_id AND ua.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.activity_joins j
          WHERE j.activity_id = pm.activity_id AND j.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Members can insert own plan_message_reactions"
ON public.plan_message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.plan_messages pm
    WHERE pm.id = plan_message_reactions.message_id
      AND (
        EXISTS (
          SELECT 1 FROM public.user_activities ua
          WHERE ua.id = pm.activity_id AND ua.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.activity_joins j
          WHERE j.activity_id = pm.activity_id AND j.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Users can delete own plan_message_reactions"
ON public.plan_message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_message_reactions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'plan_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_message_reactions;
  END IF;
END $$;
