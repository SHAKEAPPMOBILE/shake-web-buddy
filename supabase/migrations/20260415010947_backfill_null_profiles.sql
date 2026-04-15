-- Backfill profiles rows that are missing name or avatar_url.
--
-- name:       use split_part(auth.users.email, '@', 1) as the fallback so
--             every row ends up with a human-readable display name.
-- avatar_url: assign a random preset avatar (/avatars/avatar-new-1..8.png)
--             so the profile completeness check never blocks an existing user.

UPDATE public.profiles p
SET
  name = CASE
    WHEN p.name IS NULL OR TRIM(p.name) = ''
    THEN split_part(u.email, '@', 1)
    ELSE p.name
  END,
  avatar_url = CASE
    WHEN p.avatar_url IS NULL
    THEN '/avatars/avatar-new-' || (floor(random() * 8) + 1)::int || '.png'
    ELSE p.avatar_url
  END
FROM auth.users u
WHERE u.id = p.user_id
  AND (
    p.name IS NULL
    OR TRIM(p.name) = ''
    OR p.avatar_url IS NULL
  );
