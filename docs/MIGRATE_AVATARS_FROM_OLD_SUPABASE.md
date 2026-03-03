# Why profile pictures don’t load after switching Supabase

## Cause

- **Before:** Profiles and avatars lived in your old Supabase project (e.g. Lovable’s).
- **After:** You switched the app to a **new** Supabase project (new URL and keys).
- **What’s wrong:** In the new database, `profiles.avatar_url` still points to the **old** project’s storage, e.g.  
  `https://OLD_PROJECT.supabase.co/storage/v1/object/public/avatars/user-id/avatar.png`  
  Those URLs 404 because the old project is no longer in use (or you don’t use it for this app), so the browser can’t load the images.

So: the **info** (user_id, name, avatar_url string) is in the new Supabase DB, but the **files** and **URLs** still refer to the old project. That’s why some profile pictures don’t load.

## What you need to do

You have to:

1. **Copy the avatar files** from the old Supabase storage into the new one (same structure: bucket `avatars`, paths like `{user_id}/avatar.{ext}`).
2. **Update the new DB** so `profiles.avatar_url` points to the **new** Supabase storage URL instead of the old one.

Then the app (which already uses the new Supabase client) will load profile pictures correctly.

---

## Option A: Manual copy + one SQL update (simplest)

If you can still open the **old** Supabase project:

1. **Old project:** Dashboard → Storage → `avatars` bucket → download all (or each `user_id` folder).
2. **New project:** Dashboard → Storage → create bucket `avatars` if needed (public) → upload the same folders/files so paths match (e.g. `user-id/avatar.png`).
3. **New project:** SQL Editor → run (replace the two URLs with your real ones):

```sql
-- Replace OLD and NEW with your actual Supabase project URLs, e.g.:
-- OLD: https://abcdefgh.supabase.co
-- NEW: https://xyzsupabase.supabase.co

UPDATE profiles
SET avatar_url = REPLACE(
  avatar_url,
  'https://OLD_PROJECT_REF.supabase.co/storage/v1/object/public/avatars',
  'https://NEW_PROJECT_REF.supabase.co/storage/v1/object/public/avatars'
)
WHERE avatar_url LIKE 'https://OLD_PROJECT_REF.supabase.co/storage/%';
```

After this, all avatar URLs that pointed at the old project will point at the new one, and profile pictures should load.

---

## Option B: Script (copy storage + update DB)

If you prefer to automate and have:

- Old Supabase: URL + **service role** key (or anon if storage is public and you only need to read).
- New Supabase: URL + **service role** key (to upload and update `profiles`).

you can run the migration script once (see `scripts/migrate-avatars-from-old-supabase.mjs`). It will:

1. List profiles in the **new** DB whose `avatar_url` contains the old Supabase URL.
2. For each, derive the storage path, download from old storage, upload to new storage.
3. Update `profiles.avatar_url` in the new DB to the new public URL.

See the script’s comments and env vars at the top of the file.

---

## Notes

- **Google/Apple avatar URLs** (e.g. `https://lh3.googleusercontent.com/...`) are not stored in your Supabase storage; they keep working as long as the provider serves them. The migration only needs to fix URLs that point at the **old Supabase storage**.
- **Preset / external avatars** (e.g. from your avatar picker) are also unchanged; only old Supabase storage URLs need to be updated or migrated.
