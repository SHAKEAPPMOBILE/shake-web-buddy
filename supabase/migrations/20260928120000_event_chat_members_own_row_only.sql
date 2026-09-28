-- event_chat_members / event_chats had wide-open RLS: any authenticated user
-- could insert/update/delete ANY row, including setting someone ELSE's
-- user_id, or forging paid_at on a paid event's row for themselves. The app
-- only ever needs to write its OWN membership row, so scope writes to that.
-- (Free-joining a paid event by self-setting paid_at is a separate, deeper
-- issue — the client legitimately sets paid_at as a fallback right after a
-- real Stripe redirect, before the webhook lands, so it can't be closed with
-- an RLS-only change without risking that real flow. Flagged, not fixed here.)

DROP POLICY IF EXISTS "allow_all_authenticated" ON public.event_chat_members;

CREATE POLICY "Users can view event_chat_members" ON public.event_chat_members
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert their own membership" ON public.event_chat_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own membership" ON public.event_chat_members
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own membership" ON public.event_chat_members
  FOR DELETE USING (auth.uid() = user_id);

-- event_chats itself (event metadata, not membership) — any authenticated
-- user could update ANY event's row. Only the service role (webhooks, edge
-- functions) should ever change these once created.
DROP POLICY IF EXISTS "Authenticated users can update event_chats" ON public.event_chats;
