# Minimal Swipe and Match Data Schema — Plan Brief

> Full plan: `context/changes/match-data-foundation/plan.md`

## What & Why

First of 3 sub-changes implementing roadmap S-02 (`browse-and-match`, see `context/changes/browse-and-match/change.md`). Adds the `swipes` and `matches` tables, RLS, and an atomic mutual-like trigger — the data foundation that `browse-dogs` (browse/swipe UI+API) and `matches-list` (matches UI+API) will build on. No UI or API routes in this change.

## Starting Point

`dogs` (F-01) is the only domain table today: one row per owner (`owner_id unique`), readable by any authenticated user (browsing already allowed by RLS), writable only by its own owner. No `swipes`/`matches`/`likes` table exists anywhere yet.

## Desired End State

Two new RLS-protected tables exist: `swipes` (immutable like/pass decisions, insertable/readable only by the swipe's own actor) and `matches` (immutable pairs, readable by either matched owner, insertable _only_ by a DB trigger — never directly by the API). Inserting a mutual `like` (in either order, including near-simultaneously) always produces exactly one `matches` row; a one-sided like or a `pass` never does.

## Key Decisions Made

| Decision                 | Choice                                                      | Why (1 sentence)                                                                                                        | Source                                |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Match creation mechanism | DB trigger (`security definer`) on `swipes` insert          | Atomic — no race window between checking for a reverse like and inserting the match, unlike app-level check-then-insert | Plan (locked earlier in conversation) |
| Swipe/match keys         | `dog_id`, not `owner_id`                                    | Mirrors `dogs`' own FK surface; `owner_id` is already unique per dog so no information is lost                          | Plan                                  |
| Match row shape          | `dog_a_id < dog_b_id` canonical order + unique constraint   | Prevents duplicate/reversed match rows for the same pair without app-level dedup logic                                  | Plan                                  |
| Unmatch/undo swipe       | Not supported (immutable rows, no update/delete RLS policy) | Confirmed out of scope for MVP (roadmap Parked section)                                                                 | Plan                                  |
| Match visibility         | No realtime; matches list will query on page load           | Realtime is reserved for S-03 (messages) per PRD/NFR — confirmed earlier in this conversation                           | Plan                                  |
| `src/types.ts` update    | Hand-mirrored, not CLI-generated                            | No local Supabase/Docker instance available in this session; F-01/S-01 set this precedent already                       | Plan                                  |

## Scope

**In scope:**

- `swipes` table + RLS (select/insert own only)
- `matches` table + RLS (select for either participant, no direct write)
- `create_match_on_mutual_like()` trigger function + trigger
- Manual `src/types.ts` additions (`Swipe`, `Match`, `swipe_decision` enum)

**Out of scope:**

- Browse/swipe API and UI (`browse-dogs`)
- Matches list API and UI (`matches-list`)
- Unmatch, undo-swipe, or any mutation after initial insert
- Realtime/notifications for new matches
- "Relevance" scoring table — `browse-dogs` will compute shared-interest count at query time from `dogs.interests` directly

## Architecture / Approach

Single migration file, structured exactly like the F-01 `dogs` migration (enum → tables → trigger function → trigger → RLS). The trigger function is the only place that deliberately runs outside RLS (`security definer`), scoped narrowly to checking for and inserting exactly one reverse-match row.

## Phases at a Glance

| Phase                        | What it delivers                             | Key risk                                                                                               |
| ---------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1. Swipes and matches schema | Migration: enum, 2 tables, RLS, trigger      | Trigger must be `security definer` or it can't see the other owner's swipe row to detect a mutual like |
| 2. Type definitions          | `src/types.ts` additions mirroring `dogs`    | Manual types could drift from actual DB if migration SQL changes later without re-sync                 |
| 3. Final verification        | Lint/build + manual RLS/trigger verification | None beyond standard verification                                                                      |

**Prerequisites:** F-01 (`dogs` table) — already done.
**Estimated effort:** ~1 session, single migration + type file.

## Open Risks & Assumptions

- No local Supabase/Docker instance was available to actually apply and test the migration in this session — Phase 1's automated migration-apply check and all Phase 1/3 manual verification steps are written to be run whenever such an instance is available (local `supabase start` or the hosted project), and should not be marked done until then.
- `least()`/`greatest()` on `uuid` values rely on Postgres's default uuid btree ordering, which is stable but not human-meaningful (not a risk to correctness, just worth knowing when reading `matches` rows directly in the SQL editor).

## Success Criteria (Summary)

- Two mutual "like" swipes (either order) always produce exactly one `matches` row; a one-sided like or any `pass` never does.
- A user can only insert swipes as their own dog and can only read matches they participate in — verified via RLS, not app-level checks.
- `npm run lint` and `npm run build` pass with the new types in place.
