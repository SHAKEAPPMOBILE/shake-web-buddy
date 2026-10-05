-- Lets the app write a push notification in the *recipient's* language.
--
-- The referral push is sent from the new user's phone to the person who invited them, and the
-- invitee can't read the inviter's profile_private row (RLS: own row only). This returns just the
-- language code — nothing else about the person — so the app can pick the right translation.
create or replace function public.get_push_language(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select preferred_language from public.profiles_private where user_id = target_user_id
$$;

revoke all on function public.get_push_language(uuid) from public, anon;
grant execute on function public.get_push_language(uuid) to authenticated;
