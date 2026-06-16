-- ── ONE-TIME CLEANUP ─────────────────────────────────────────────────────────
-- Remove all expired activity_joins rows for user c375d5f6-e9c7-4813-a0bc-2f6276209d5a.
-- This user accumulated ~19 stale join rows dating back to April 2026 because no
-- nightly purge existed.  Those expired rows were incorrectly counted by the join
-- guard (Fault 4), blocking the user from joining plans they were never actually in.
--
-- Safe to delete: every deleted row has expires_at < now(), meaning the join
-- window closed in the past and get_my_active_plans() would not return them anyway.

DELETE FROM public.activity_joins
WHERE  user_id    = 'c375d5f6-e9c7-4813-a0bc-2f6276209d5a'
  AND  expires_at IS NOT NULL
  AND  expires_at < now();
