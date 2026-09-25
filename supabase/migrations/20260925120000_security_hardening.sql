-- Security hardening (audit 2026-09-25).
--
-- Every change here keeps the app's current client writes working; each block
-- notes which client call it was checked against. Service-role (edge functions,
-- webhooks) and SECURITY DEFINER RPCs are unaffected: the guards only fire when
-- the statement runs as the `anon` or `authenticated` role.

-- ---------------------------------------------------------------------------
-- 1. profiles_private: users could grant themselves Premium / payout state.
--    The UPDATE policy allowed any column on your own row, so
--    `update({ premium_override: true })` gave free Premium.
--    Client writes checked: Auth.tsx upsert (user_id, date_of_birth,
--    phone_number), Profile.tsx update (push_notifications_enabled,
--    billing_email, phone, date_of_birth), useOnboarding (onboarding_completed).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profiles_private_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.premium_override := false;
    NEW.welcome_bonus_claimed := false;
    NEW.stripe_account_id := NULL;
    NEW.stripe_account_status := NULL;
    NEW.paypal_connected := false;
  ELSE
    NEW.premium_override := OLD.premium_override;
    NEW.welcome_bonus_claimed := OLD.welcome_bonus_claimed;
    NEW.stripe_account_id := OLD.stripe_account_id;
    NEW.stripe_account_status := OLD.stripe_account_status;
    NEW.paypal_connected := OLD.paypal_connected;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_profiles_private_columns ON public.profiles_private;
CREATE TRIGGER protect_profiles_private_columns
  BEFORE INSERT OR UPDATE ON public.profiles_private
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_private_columns();

-- ---------------------------------------------------------------------------
-- 2. claim_welcome_bonus: callable by anyone (even logged out) for any user id.
--    useWelcomeBonus always passes the caller's own id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_welcome_bonus(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  claimed_now boolean;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND target_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  IF NOT public.is_profile_complete(target_user_id) THEN
    RETURN false;
  END IF;

  UPDATE public.profiles_private
  SET welcome_bonus_claimed = true
  WHERE user_id = target_user_id
    AND welcome_bonus_claimed = false
  RETURNING true INTO claimed_now;

  RETURN COALESCE(claimed_now, false);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_welcome_bonus(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_welcome_bonus(uuid) TO authenticated;

-- get_user_age reads date_of_birth; only signed-in users (UserProfileDialog) need it.
REVOKE EXECUTE ON FUNCTION public.get_user_age(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_age(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Points: clients chose their own point values.
--    check_ins: useCheckIn always inserts points_earned = 5.
--    referrals: AuthContext always inserts points_awarded = 5.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clamp_client_points()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_TABLE_NAME = 'check_ins' THEN
      NEW.points_earned := 5;
    ELSIF TG_TABLE_NAME = 'referrals' THEN
      IF NEW.referrer_user_id = NEW.referred_user_id THEN
        RAISE EXCEPTION 'cannot refer yourself';
      END IF;
      NEW.points_awarded := 5;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clamp_client_points ON public.check_ins;
CREATE TRIGGER clamp_client_points
  BEFORE INSERT OR UPDATE ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.clamp_client_points();

DROP TRIGGER IF EXISTS clamp_client_points ON public.referrals;
CREATE TRIGGER clamp_client_points
  BEFORE INSERT OR UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.clamp_client_points();

-- ---------------------------------------------------------------------------
-- 4. private_messages: the receiver (or sender) could rewrite message text.
--    The only client update is usePrivateMessages marking read_at.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.private_messages_only_read_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
       NEW.sender_id    IS DISTINCT FROM OLD.sender_id
    OR NEW.receiver_id  IS DISTINCT FROM OLD.receiver_id
    OR NEW.message      IS DISTINCT FROM OLD.message
    OR NEW.audio_url    IS DISTINCT FROM OLD.audio_url
    OR NEW.message_type IS DISTINCT FROM OLD.message_type
    OR NEW.created_at   IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'only read_at can be updated';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS private_messages_only_read_at ON public.private_messages;
CREATE TRIGGER private_messages_only_read_at
  BEFORE UPDATE ON public.private_messages
  FOR EACH ROW EXECUTE FUNCTION public.private_messages_only_read_at();

-- ---------------------------------------------------------------------------
-- 5. Event chats: anyone could post as another user, and add/remove/edit any
--    member row (including other people's).
--    Client writes checked: useEventChat + EventsPage upsert own membership,
--    EventChatPage deletes own membership, messages/reactions insert own user_id.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.event_chat_members;
CREATE POLICY "event_chat_members_select" ON public.event_chat_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "event_chat_members_insert_own" ON public.event_chat_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_chat_members_update_own" ON public.event_chat_members
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_chat_members_delete_own" ON public.event_chat_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can send event_chat_messages" ON public.event_chat_messages;
CREATE POLICY "Authenticated users can send event_chat_messages" ON public.event_chat_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can insert event_chat_reactions" ON public.event_chat_reactions;
CREATE POLICY "Authenticated users can insert event_chat_reactions" ON public.event_chat_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. Linter: pin search_path on functions that lacked it.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.set_event_chat_expires_at() SET search_path = public;
ALTER FUNCTION public.sync_event_chat_member_count() SET search_path = public;
ALTER FUNCTION public.get_user_activity_limit(uuid) SET search_path = public;
ALTER FUNCTION public.handle_marketing_join() SET search_path = public;
ALTER FUNCTION public.cleanup_joins_on_plan_deactivate() SET search_path = public;
ALTER FUNCTION public.check_one_active_per_type() SET search_path = public;
ALTER FUNCTION public.check_activity_group_cap() SET search_path = public;

-- ---------------------------------------------------------------------------
-- 7. Group chats ignored blocks: someone you blocked could add you to a group
--    with them (create_group_chat / add_group_chat_member).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_blocked_either_way(a uuid, b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)
  );
$$;
REVOKE ALL ON FUNCTION public.users_blocked_either_way(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_group_chat(p_member_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chat uuid;
  v_uid uuid := auth.uid();
  v_member uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL THEN RAISE EXCEPTION 'need at least one other member'; END IF;
  FOREACH v_member IN ARRAY p_member_ids LOOP
    IF v_member <> v_uid AND public.users_blocked_either_way(v_uid, v_member) THEN
      RAISE EXCEPTION 'cannot add this person';
    END IF;
  END LOOP;
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

CREATE OR REPLACE FUNCTION public.add_group_chat_member(p_chat uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_group_chat_member(p_chat, auth.uid()) THEN RAISE EXCEPTION 'not a member'; END IF;
  IF public.users_blocked_either_way(auth.uid(), p_user) THEN RAISE EXCEPTION 'cannot add this person'; END IF;
  INSERT INTO public.group_chat_members (chat_id, user_id, added_by) VALUES (p_chat, p_user, auth.uid())
  ON CONFLICT DO NOTHING;
END $$;
