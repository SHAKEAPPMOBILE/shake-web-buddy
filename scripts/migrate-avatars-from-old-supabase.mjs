/**
 * One-off migration: copy avatar images from OLD Supabase storage to NEW Supabase
 * and update profiles.avatar_url in the NEW database.
 *
 * Run once after switching to a new Supabase project:
 *   OLD_SUPABASE_URL=https://old-ref.supabase.co \
 *   OLD_SUPABASE_SERVICE_ROLE_KEY=your_old_service_role_key \
 *   NEW_SUPABASE_URL=https://new-ref.supabase.co \
 *   NEW_SUPABASE_SERVICE_ROLE_KEY=your_new_service_role_key \
 *   node scripts/migrate-avatars-from-old-supabase.mjs
 *
 * Requires: npm install @supabase/supabase-js (already in the project).
 */

import { createClient } from "@supabase/supabase-js";

const OLD_URL = process.env.OLD_SUPABASE_URL?.replace(/\/$/, "");
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEW_SUPABASE_URL?.replace(/\/$/, "");
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error(
    "Usage: set OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY, NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const oldSupabase = createClient(OLD_URL, OLD_KEY);
const newSupabase = createClient(NEW_URL, NEW_KEY);

const BUCKET = "avatars";
const oldStoragePrefix = `${OLD_URL}/storage/v1/object/public/${BUCKET}/`;

function extractStoragePath(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith(oldStoragePrefix)) return null;
  const path = avatarUrl.slice(oldStoragePrefix.length).split("?")[0];
  return path || null;
}

async function main() {
  console.log("Fetching profiles from NEW DB that still point at OLD storage...");
  const { data: profiles, error: selectError } = await newSupabase
    .from("profiles")
    .select("user_id, avatar_url")
    .like("avatar_url", `${oldStoragePrefix}%`);

  if (selectError) {
    console.error("Failed to fetch profiles:", selectError);
    process.exit(1);
  }

  if (!profiles?.length) {
    console.log("No profiles found with old avatar URLs. Nothing to migrate.");
    return;
  }

  console.log(`Found ${profiles.length} profile(s) to migrate.`);

  for (const row of profiles) {
    const path = extractStoragePath(row.avatar_url);
    if (!path) continue;

    try {
      const { data: blob, error: downError } = await oldSupabase.storage
        .from(BUCKET)
        .download(path);

      if (downError || !blob) {
        console.warn(`  Skip ${row.user_id}: could not download (${downError?.message || "no data"})`);
        continue;
      }

      const { error: upError } = await newSupabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true });

      if (upError) {
        console.warn(`  Skip ${row.user_id}: could not upload (${upError.message})`);
        continue;
      }

      const { data: urlData } = newSupabase.storage.from(BUCKET).getPublicUrl(path);
      const newAvatarUrl = urlData.publicUrl;

      const { error: updateError } = await newSupabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("user_id", row.user_id);

      if (updateError) {
        console.warn(`  Skip ${row.user_id}: could not update profile (${updateError.message})`);
        continue;
      }

      console.log(`  OK ${row.user_id}`);
    } catch (err) {
      console.warn(`  Skip ${row.user_id}:`, err.message);
    }
  }

  console.log("Done.");
}

main();
