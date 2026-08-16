-- Mutual friend system: request/accept, backing the new "Friends" tab and
-- the "friends only" plan audience option.
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS friendships_requester_idx ON public.friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON public.friendships(addressee_id, status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY friendships_select ON public.friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY friendships_insert ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id AND status = 'pending');

CREATE POLICY friendships_update ON public.friendships
  FOR UPDATE USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id);

-- Either side can withdraw a pending request or unfriend an accepted one.
CREATE POLICY friendships_delete ON public.friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- If a mutual pending request already exists in the opposite direction
-- (both people requested each other, e.g. from a bulk "add all" send before
-- either saw the other's request), auto-accept it instead of leaving two
-- dangling pending rows. Blocks a duplicate request in either direction
-- while one is already pending or accepted (re-requesting after a decline
-- is allowed).
CREATE OR REPLACE FUNCTION public.handle_friend_request_insert()
RETURNS TRIGGER AS $$
DECLARE
  reverse_id uuid;
  reverse_status text;
BEGIN
  SELECT id, status INTO reverse_id, reverse_status
  FROM public.friendships
  WHERE requester_id = NEW.addressee_id AND addressee_id = NEW.requester_id;

  IF reverse_status = 'pending' THEN
    UPDATE public.friendships
    SET status = 'accepted', responded_at = now()
    WHERE id = reverse_id;
    RETURN NULL;
  ELSIF reverse_status = 'accepted' THEN
    RAISE EXCEPTION 'ALREADY_FRIENDS: You''re already friends' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE requester_id = NEW.requester_id AND addressee_id = NEW.addressee_id
      AND status IN ('pending', 'accepted')
  ) THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_SENT: Friend request already sent' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS friend_request_insert_trigger ON public.friendships;
CREATE TRIGGER friend_request_insert_trigger
  BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.handle_friend_request_insert();

-- Extend plan audience to allow "friends_only", alongside the existing
-- "everyone" / "women_only" options.
ALTER TABLE public.user_activities DROP CONSTRAINT IF EXISTS user_activities_audience_check;
ALTER TABLE public.user_activities ADD CONSTRAINT user_activities_audience_check
  CHECK (audience = ANY (ARRAY['everyone'::text, 'women_only'::text, 'friends_only'::text]));

-- Extend the join-time audience gate to also enforce friends_only, mirroring
-- the existing women_only branch. Creator always allowed into their own plan.
CREATE OR REPLACE FUNCTION public.enforce_plan_audience()
RETURNS TRIGGER AS $$
DECLARE
  plan_audience text;
  plan_creator uuid;
  joiner_gender text;
  is_friend boolean;
BEGIN
  IF NEW.activity_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT audience, user_id INTO plan_audience, plan_creator
  FROM public.user_activities
  WHERE id = NEW.activity_id;

  IF plan_creator IS NOT NULL AND plan_creator = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF plan_audience = 'women_only' THEN
    SELECT gender INTO joiner_gender
    FROM public.profiles
    WHERE user_id = NEW.user_id;

    IF joiner_gender IS DISTINCT FROM 'woman' THEN
      RAISE EXCEPTION 'WOMEN_ONLY_PLAN: Hold on Tiger, this plan is only for women'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF plan_audience = 'friends_only' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((requester_id = plan_creator AND addressee_id = NEW.user_id)
          OR (requester_id = NEW.user_id AND addressee_id = plan_creator))
    ) INTO is_friend;

    IF NOT is_friend THEN
      RAISE EXCEPTION 'FRIENDS_ONLY_PLAN: This plan is only for the creator''s friends'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
