-- Unread tracking for custom group chats. NULL last_read_at = never opened (e.g. just added).
ALTER TABLE public.group_chat_members ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_group_chat_read(p_chat uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.group_chat_members SET last_read_at = now() WHERE chat_id = p_chat AND user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.mark_group_chat_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_group_chat_read(uuid) TO authenticated;

-- The creator has obviously seen their own new group.
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
  INSERT INTO public.group_chat_members (chat_id, user_id, added_by, last_read_at) VALUES (v_chat, v_uid, v_uid, now());
  FOREACH v_member IN ARRAY p_member_ids LOOP
    IF v_member <> v_uid THEN
      INSERT INTO public.group_chat_members (chat_id, user_id, added_by) VALUES (v_chat, v_member, v_uid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN v_chat;
END $$;
