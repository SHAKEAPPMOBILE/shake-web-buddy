# Friends / Contacts Feature — Implementation Plan

## Goal
Let users find friends who already use Shake (via phone contacts), see what friends are up to, "manifest" interest in a plan, and let friends propose/join each other directly — on top of the existing stranger-discovery flow (Shake tab, carousel, city feed).

## Why this needs a real plan (not a quick bolt-on)
- iOS/Android both require an explicit runtime permission prompt for Contacts access, with a clear purpose string. App Store review specifically checks that contacts data is used for what you say it's used for and isn't retained/misused.
- We should never upload raw contact lists to our servers in plaintext. Match by hashed phone number only.
- Need to decide: do we only connect two people who are *both* already Shake users, or do we also support "invite a friend who isn't on Shake yet"? The second is more viral but has real spam/abuse risk if not throttled.

## Phase 1 — Contact matching (backend + minimal UI)
1. **DB schema**
   - `user_contacts_hashes` table: `user_id`, `phone_hash` (SHA-256 of E.164-normalized number), `created_at`. One row per contact the user has, never the plaintext number.
   - `friendships` table: `user_id_a`, `user_id_b`, `status` (`pending` | `accepted` | `blocked`), `created_at`. Store canonically with `user_id_a < user_id_b` to avoid duplicate rows.
2. **Client**
   - Request `Contacts` permission (Capacitor community plugin `@capacitor-community/contacts` or native), only when user explicitly opens "Find friends" — never on first launch.
   - Hash phone numbers locally on-device before sending to Supabase (never send raw numbers over the wire).
3. **Backend (Supabase RPC)**
   - `find_friends_by_hashes(hashes text[])` → returns matching `user_id`s + public profile (name, avatar) for any hash already in `user_contacts_hashes` belonging to another user, or just cross-reference against `profiles.phone_hash` column if we store one per-account already.
   - On match, create a `friendships` row with `status = 'pending'` (or auto-accept if mutual — i.e. both have each other's number, which is the common "contacts sync" pattern used by WhatsApp/Instagram).

## Phase 2 — Friends tab
1. New bottom-nav tab (or a segment inside an existing tab — needs a design decision) showing:
   - List of accepted friends with their current status (e.g. "free tonight", "at a plan", nothing).
   - Friends' *public* plans they've opted to share with friends specifically (separate visibility flag from "everyone"/"women_only" — maybe `audience: 'friends_only'` as a third option alongside the two we just built).
2. "Manifest interest" action: a lightweight tap (not a full join) that notifies the plan creator "so-and-so is interested," without committing a slot — distinct from the existing join flow.
3. Friends can propose a plan directly to one specific friend (a DM-style invite) rather than only to the public feed.

## Phase 3 (optional, higher risk) — Invite non-users
- "Invite a friend" sends an SMS/share-sheet link, not an automatic push to their phone number — avoids us sending unsolicited messages ourselves (which is the part that gets apps flagged/rejected).
- Rate-limit invites per user per day to prevent spam abuse.

## Privacy / App Store considerations (do this before writing code)
- Add a clear, honest purpose string for the Contacts permission (`NSContactsUsageDescription` in Info.plist) — must say exactly what we do (match existing users, never store raw numbers).
- Add a way to disconnect/delete synced contact data from Profile settings (needed for App Store privacy nutrition label accuracy and for GDPR-style deletion requests).
- Decide retention: do we re-sync every time the user opens "Find friends," or store hashes long-term? Recommend re-sync on demand only, don't store hashes longer than needed to compute matches, to minimize data liability.

## Open questions for tomorrow
1. Do we want mutual-only friending (like WhatsApp), or request/accept (like Instagram)? Mutual-only is much simpler to build and has less "creepy" surface area.
2. Where does the Friends tab live — new 5th nav tab, or folded into Plans/Profile? Affects nav bar redesign.
3. Do we launch Phase 3 (inviting non-users) at all in v1, or hold it for later once Phase 1–2 prove out engagement?

## Suggested build order
1. Schema + hashing/matching RPC (backend only, no UI) — lowest risk, testable via SQL.
2. Minimal "Find friends" screen + permission flow.
3. Friends list UI.
4. `friends_only` plan audience option (mirrors the `women_only` pattern we already built — same trigger/gate/messaging shape).
5. Manifest-interest + direct-invite UI last, since they're net-new interaction patterns rather than reuses of existing plan/join code.
