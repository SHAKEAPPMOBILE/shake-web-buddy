-- Custom group chats: started from a DM ("add someone"), anyone in the group can add
-- people, only the creator can remove members or delete the chat.
CREATE TABLE IF NOT EXISTS public.group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_chat_members (
  chat_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS group_chat_members_user_idx ON public.group_chat_members (user_id);

CREATE TABLE IF NOT EXISTS public.group_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type = ANY (ARRAY['text','gif','image','video','location'])),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS group_chat_messages_chat_idx ON public.group_chat_messages (chat_id, created_at);

ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

-- Membership check as SECURITY DEFINER so policies on the members table don't recurse.
CREATE OR REPLACE FUNCTION public.is_group_chat_member(p_chat uuid, p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_chat_members WHERE chat_id = p_chat AND user_id = p_user);
$$;

CREATE POLICY "members read chat" ON public.group_chats FOR SELECT
  USING (public.is_group_chat_member(id, auth.uid()));
CREATE POLICY "creator deletes chat" ON public.group_chats FOR DELETE
  USING (creator_id = auth.uid());

CREATE POLICY "members read members" ON public.group_chat_members FOR SELECT
  USING (public.is_group_chat_member(chat_id, auth.uid()));

CREATE POLICY "members read messages" ON public.group_chat_messages FOR SELECT
  USING (public.is_group_chat_member(chat_id, auth.uid()));
CREATE POLICY "members send messages" ON public.group_chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_group_chat_member(chat_id, auth.uid()));
CREATE POLICY "authors delete own messages" ON public.group_chat_messages FOR DELETE
  USING (user_id = auth.uid());

-- Create a group from an existing conversation. Caller becomes the creator.
CREATE OR REPLACE FUNCTION public.create_group_chat(p_member_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chat uuid;
  v_uid uuid := auth.uid();
  v_member uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL THEN RAISE EXCEPTION 'need at least one other member'; END IF;
  INSERT INTO public.group_chats (creator_id) VALUES (v_uid) RETURNING id INTO v_chat;
  INSERT INTO public.group_chat_members (chat_id, user_id, added_by) VALUES (v_chat, v_uid, v_uid);
  FOREACH v_member IN ARRAY p_member_ids LOOP
    IF v_member <> v_uid THEN
      INSERT INTO public.group_chat_members (chat_id, user_id, added_by) VALUES (v_chat, v_member, v_uid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN v_chat;
END $$;

-- Anyone already in the group can add someone.
CREATE OR REPLACE FUNCTION public.add_group_chat_member(p_chat uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_group_chat_member(p_chat, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  INSERT INTO public.group_chat_members (chat_id, user_id, added_by) VALUES (p_chat, p_user, auth.uid())
  ON CONFLICT DO NOTHING;
END $$;

-- Only the creator can remove someone (never themselves — they delete the chat instead).
CREATE OR REPLACE FUNCTION public.remove_group_chat_member(p_chat uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.group_chats WHERE id = p_chat AND creator_id = auth.uid()) THEN
    RAISE EXCEPTION 'only the creator can remove members';
  END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'creator cannot be removed'; END IF;
  DELETE FROM public.group_chat_members WHERE chat_id = p_chat AND user_id = p_user;
END $$;

-- A non-creator can leave on their own.
CREATE OR REPLACE FUNCTION public.leave_group_chat(p_chat uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.group_chats WHERE id = p_chat AND creator_id = auth.uid()) THEN
    RAISE EXCEPTION 'the creator deletes the chat instead of leaving';
  END IF;
  DELETE FROM public.group_chat_members WHERE chat_id = p_chat AND user_id = auth.uid();
END $$;

REVOKE ALL ON FUNCTION public.create_group_chat(uuid[]), public.add_group_chat_member(uuid, uuid),
  public.remove_group_chat_member(uuid, uuid), public.leave_group_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_chat(uuid[]), public.add_group_chat_member(uuid, uuid),
  public.remove_group_chat_member(uuid, uuid), public.leave_group_chat(uuid), public.is_group_chat_member(uuid, uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chats;
