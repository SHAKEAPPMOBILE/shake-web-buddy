-- Backfill names from auth.users metadata for profiles where name is null/empty
UPDATE profiles
SET name = COALESCE(
  auth.users.raw_user_meta_data->>'full_name',
  auth.users.raw_user_meta_data->>'name',
  split_part(auth.users.email, '@', 1)
)
FROM auth.users
WHERE profiles.user_id = auth.users.id
AND (profiles.name IS NULL OR trim(profiles.name) = '');
