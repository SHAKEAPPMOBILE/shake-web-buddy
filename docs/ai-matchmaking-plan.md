# AI Matchmaking / Preference-Based Table Clustering — Implementation Plan

## Where things stand today

Investigated `src/lib/activityGroups.ts` (`findOrCreateOpenGroup`, used by both the carousel quick-join and the "My City" plan cards). Current logic, in full:

1. Fetch all active `user_activities` rows for the given `activity_type` + `city`, oldest `scheduled_for` first.
2. Drop anything more than 24h stale.
3. Walk the list in order and return the first group whose active `activity_joins` count is below `MAX_GROUP_CAPACITY` (currently **7**).
4. If every existing group is full, create a new "overflow" group (`group_number = max + 1`, `is_auto_generated = true`).

So today, clustering is **activity_type + city only** — first-come, first-fit, oldest group filled first. No use of `profiles.interests`, `nationality`, `occupation`, or anything else at all. This is the right call at current volume: with a handful of people per city per night, more sophisticated matching would just add latency and cost with no real benefit (a 3-person pool doesn't have "clusters"). It's exactly the "default is big, for now" state described.

No embeddings/vector infrastructure exists in the project yet — no `pgvector` extension enabled, no embeddings table. That's the main new piece any of the phases below would need.

## Design principle: don't build sophistication before it's needed

The plan below is staged so each phase is only turned on once the previous one's assumptions break down (i.e. once there are regularly *multiple* open groups to choose between for the same type+city+slot). Below that threshold, the existing simple bucketing stays exactly as-is — this is enforced automatically by each phase's own fallback rule, not by a manual toggle someone has to remember to flip.

---

### Phase 1 — Free: preference-aware tie-breaking (no AI, no infra changes)

**When to ship:** now, or whenever there's spare engineering time. Zero ongoing cost.

**What changes:** `findOrCreateOpenGroup`'s loop currently returns the *first* group with room. Instead, when there's more than one group with room for the same type+city+slot, score each candidate by how many `profiles.interests` tags the joining user shares with the group's current members (simple set-overlap / Jaccard on the existing `text[]` column — no embeddings needed), and join the best-overlapping one instead of always the oldest. Ties still fall back to oldest-first, so behavior is identical to today whenever there's only one open group (i.e. almost always, right now).

**Cost:** one extra read of `profiles.interests` for existing members of each candidate group, done in-app in JS. No new tables, no scheduled jobs, no external API calls.

**Effort:** small — a self-contained change to one function plus a couple of Supabase queries.

---

### Phase 2 — Cheap embeddings, computed once per profile

**When to ship:** once a city/type/slot regularly has 2+ concurrently-open groups (i.e. Phase 1's overlap scoring is regularly choosing between real alternatives, not just breaking ties on empty groups).

**What changes:**
- Enable the `pgvector` extension in Supabase (one migration).
- New table `profile_embeddings (user_id, embedding vector(384 or 1536), updated_at)`.
- An embedding is computed **once**, event-driven, whenever a profile's `interests` (or nationality/occupation, if we want those to count too) change — not on every join or every match attempt. This is the single biggest cost lever: embedding cost scales with *profile edits*, not with *matches made*, and profile edits are rare compared to joins.
- Use a small/cheap embedding model (e.g. OpenAI `text-embedding-3-small` at ~$0.02 per 1M tokens, or a self-hosted small open-source model if we want zero marginal API cost) over a short synthetic string built from the interests list (e.g. `"Music: Rock, Jazz. Activities: Hiking. Food & Drink: Wine"`).
- `findOrCreateOpenGroup` (or a new sibling function) then picks the candidate group whose *centroid embedding* (average of current members' vectors) is closest to the joining user's embedding, via `pgvector`'s `<=>` cosine-distance operator — this is a single indexed DB query, not something pulled into app code and looped over.

**Cost:** a few cents per profile edit for the embedding call; ~free at query time (pgvector index lookup). No recurring batch job needed at this phase — it's all computed lazily, on write.

**Effort:** medium — one migration, one Edge Function (or Postgres trigger + `pg_net` call) to compute embeddings on profile update, one new query path for group selection.

---

### Phase 3 — Batch clustering for genuinely high volume

**When to ship:** once a single city+type+slot regularly has enough simultaneous joiners that "assign into the best existing group one at a time" starts producing lopsided groups (e.g. 30 people joining a Friday dinner in one city within the same hour, and we'd rather form 4-5 well-clustered tables of ~7 than let first-come-first-served fragment them).

**What changes:**
- A scheduled job (Supabase Cron / `pg_cron`, e.g. running a few times a day, or 1-2 hours before each slot's cutoff) looks at everyone who joined a given type+city+slot in "waiting" auto-generated overflow groups, and re-clusters them: a simple greedy nearest-centroid grouping (not a full ILP solver — that's overkill for groups capped at 7) that maximizes average intra-group interest similarity while respecting `MAX_GROUP_CAPACITY`.
- **Never touches a group that's already "live"** — same safety rule used for the venue-rotation mechanism: only groups still in a pre-cutoff waiting state are eligible to be re-shuffled. Once a group has crossed into "this is happening," it's frozen.
- Falls back to Phase 2's per-join assignment automatically whenever there's too small a pool to bother batch-clustering (e.g. under ~14 people, just let Phase 1/2 handle it one at a time — re-clustering 8 people into groups of 7 has no benefit over sequential assignment).

**Cost:** the embeddings are already computed and cached from Phase 2 — this phase only adds compute (in-Postgres or in an Edge Function, no new external API calls), run on a cheap schedule, not per-request.

**Effort:** larger — the scheduled function, the "waiting vs. live" state distinction if it doesn't already exist cleanly, and testing that regrouping never disrupts an already-notified group.

---

## Why not just use an LLM for this?

Chat-completion calls (asking GPT-whatever "who should be at a table together") are the wrong tool here: they're 10-100x more expensive than embeddings for what is fundamentally a similarity/clustering problem, slower (seconds vs milliseconds), and non-deterministic in a way that makes debugging "why was I put in this group" much harder to reason about and support. Embeddings + vector distance give a fast, cheap, explainable, cacheable signal — an LLM only earns its cost if we ever want *reasoning* (e.g. "these two people probably shouldn't be grouped because X"), which isn't needed for capacity-bounded table assignment.

## Rollout order recap

| Phase | Trigger to build it | New infra | Ongoing cost |
|---|---|---|---|
| 1 | Anytime | None | $0 |
| 2 | Groups regularly compete for joiners | `pgvector`, embeddings table | Cents per profile edit |
| 3 | High simultaneous volume per slot | Scheduled clustering job | Cents per scheduled run |

Each phase is additive and the earlier phases keep working underneath the later ones — Phase 3's batch job still calls into Phase 2's embedding lookups, which still fall back to Phase 1's overlap scoring if embeddings are ever missing for a user, which still falls back to today's plain oldest-first bucketing if there's only one open group. Nothing about the current behavior needs to change until the first trigger condition is actually hit.
