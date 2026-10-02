# Minimal Swipe and Match Data Schema Implementation Plan

## Overview

Implement the data foundation for roadmap S-02 (`browse-and-match`): a `swipes` table recording each like/pass decision an owner's dog makes about another dog, a `matches` table recording the pairs created by mutual likes, RLS restricting both to the owning user, and a DB trigger that atomically creates a match the moment a mutual like exists — with no app-level race window. No API routes or UI are added in this change; those are `browse-dogs` and `matches-list` (see `context/changes/browse-and-match/change.md` for the full split).

## Current State Analysis

- The `dogs` table (F-01, `supabase/migrations/20260925231055_create_dogs_table.sql`) already exists: `id uuid pk`, `owner_id uuid unique references auth.users(id)` (one dog per owner), plus profile fields. RLS lets any authenticated user `select` all dogs (`dogs_select_authenticated`), matching the browsing requirement (FR-003).
- No `swipes`/`matches`/`likes` table exists anywhere in `supabase/migrations/`.
- The migration convention (from F-01 and S-01's seed migration) is: one file per logical change, named `YYYYMMDDHHmmss_description.sql`, plain SQL (no Supabase CLI declarative schema), enums declared with `create type ... as enum`, a shared `public.set_updated_at()` trigger function already exists for `updated_at` columns (created in the `dogs` migration — reusable here if needed, but this schema has no mutable rows to timestamp).
- `src/types.ts` is a hand-mirrored copy of Supabase's generated types (no local Supabase/Docker instance was used to regenerate it for F-01/S-01 either — the `dogs` table types were added by hand in the same style). This plan follows the same convention: manually add `swipes`/`matches`/`swipe_decision` to `src/types.ts` mirroring the exact structure already used for `dogs`.
- RLS on `dogs` proves the project's per-operation granular-policy convention (separate `select`/`insert`/`update`/`delete` policies, `to authenticated`, `auth.uid() = owner_id` checks) — this plan follows the same shape for `swipes` and `matches`.

## Desired End State

Two new tables exist in Postgres with RLS enabled:

- `swipes(id, actor_dog_id, target_dog_id, decision, created_at)` — one row per (actor dog, target dog) pair, immutable, insertable only by the swipe's own actor (verified via `dogs.owner_id = auth.uid()`), readable only by rows the current user's dog authored.
- `matches(id, dog_a_id, dog_b_id, created_at)` — created only by a trigger (no direct insert/update/delete policy for the `authenticated` role), one row per unordered pair (`dog_a_id < dog_b_id` enforced), readable by either matched owner.

A trigger on `swipes` insert detects the mutual-like case (the reverse swipe already exists with `decision = 'like'`) and inserts the corresponding `matches` row atomically within the same transaction as the second like, using `security definer` so it can see both owners' swipe rows regardless of RLS.

Verification: applying the migration to a local/hosted Supabase instance succeeds; inserting two mutual "like" swipes (as two different authenticated users, via two dog rows with different owners) results in exactly one `matches` row; a single one-sided like produces zero `matches` rows; RLS blocks a user from inserting a swipe whose `actor_dog_id` isn't their own dog, and blocks reading another user's `swipes` rows.

### Key Discoveries:

- `supabase/migrations/20260925231055_create_dogs_table.sql:27-32` — `dogs.owner_id` is `unique`, so "the dog" and "the owner" are 1:1; swipes/matches key off `dog_id` (not `owner_id` directly) to match this table's own foreign-key surface, same as how `dogs_select_authenticated` already lets any authenticated user read all dogs for browsing.
- `supabase/migrations/20260925231055_create_dogs_table.sql:43-64` — exact RLS policy shape/naming convention to mirror (`<table>_<operation>_<scope>` policy names, `to authenticated`, `using`/`with check` pairs).
- `src/types.ts:33-79` — exact generated-style `Row`/`Insert`/`Update`/`Enums`/`Constants` shape this plan's manual type additions must match.
- Postgres `uuid` has a default btree operator class, so `least()`/`greatest()` work directly on two `uuid` values to produce a canonical, order-independent pair for the `matches` unique constraint.

## What We're NOT Doing

- No API routes (`src/pages/api/...`) or UI — covered by `browse-dogs` and `matches-list`.
- No "unmatch" or "undo swipe" capability — confirmed out of scope for MVP (roadmap Parked section); `swipes` and `matches` rows are immutable after insert (no update/delete RLS policy for the `authenticated` role).
- No notification/realtime plumbing for match creation — confirmed in planning that the matches list loads on page visit; realtime is reserved for S-03 (messages).
- No "relevance" scoring table or materialized view — the "shared interests" tie-break decided for `browse-dogs` reads directly from `dogs.interests` at query time; no new column or precomputed score is needed here.
- No changes to the `dogs` table itself.

## Implementation Approach

Single migration file following the exact structure of the F-01 `dogs` migration: enum → tables → trigger function → trigger → RLS enable → policies. The mutual-match trigger function is `security definer` (owned by the migration-running role, effectively bypassing RLS for its internal SELECT/INSERT) so it can always see both sides of a potential match regardless of which user's insert fired it — this is the one place in the schema that deliberately steps outside RLS, and it's scoped to exactly the two rows it needs.

## Phase 1: Swipes and matches schema

### Overview

Add the `swipe_decision` enum, the `swipes` and `matches` tables, RLS policies for both, and the mutual-like trigger, in one migration.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/20260926200000_create_swipes_and_matches.sql`

**Intent**: Establish the complete data foundation for browsing/matching in one atomic migration, following the F-01 migration's structure exactly.

**Contract**:

- `create type public.swipe_decision as enum ('like', 'pass');`
- `create table public.swipes (id uuid primary key default gen_random_uuid(), actor_dog_id uuid not null references public.dogs(id) on delete cascade, target_dog_id uuid not null references public.dogs(id) on delete cascade, decision public.swipe_decision not null, created_at timestamptz not null default now(), constraint swipes_no_self_swipe check (actor_dog_id <> target_dog_id), constraint swipes_actor_target_unique unique (actor_dog_id, target_dog_id));`
- `create table public.matches (id uuid primary key default gen_random_uuid(), dog_a_id uuid not null references public.dogs(id) on delete cascade, dog_b_id uuid not null references public.dogs(id) on delete cascade, created_at timestamptz not null default now(), constraint matches_canonical_order check (dog_a_id < dog_b_id), constraint matches_pair_unique unique (dog_a_id, dog_b_id));`
- Trigger function `public.create_match_on_mutual_like()` (`security definer`, `set search_path = public`): on `new.decision = 'pass'` return `new` immediately; otherwise `select exists(...)` for the reverse swipe (`actor_dog_id = new.target_dog_id and target_dog_id = new.actor_dog_id and decision = 'like'`); if found, `insert into matches (dog_a_id, dog_b_id) values (least(new.actor_dog_id, new.target_dog_id), greatest(new.actor_dog_id, new.target_dog_id)) on conflict (dog_a_id, dog_b_id) do nothing;`. `after insert on public.swipes for each row execute function public.create_match_on_mutual_like();`.
- RLS on `swipes`: enable RLS; `swipes_select_own` (`select`, `to authenticated`, `using (exists (select 1 from public.dogs d where d.id = actor_dog_id and d.owner_id = auth.uid()))`); `swipes_insert_own` (`insert`, `to authenticated`, `with check` — same exists-subquery as select, scoped to `actor_dog_id`). No update/delete policy (immutable by omission).
- RLS on `matches`: enable RLS; `matches_select_participant` (`select`, `to authenticated`, `using (exists (select 1 from public.dogs d where d.owner_id = auth.uid() and d.id in (dog_a_id, dog_b_id)))`). No insert/update/delete policy for `authenticated` — rows are created exclusively by the `security definer` trigger, which runs as the migration's owning role and thus bypasses RLS.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- Migration file exists at `supabase/migrations/20260926200000_create_swipes_and_matches.sql` and, if a local Supabase instance is available, `npx supabase db reset` (or `db push` against local) applies it without error

#### Manual Verification:

- As owner A (dog A) inserting a `like` swipe on dog B, then owner B (dog B) inserting a `like` swipe on dog A: exactly one row appears in `matches` after the second insert, with `dog_a_id`/`dog_b_id` in canonical (sorted) order regardless of which dog id is textually "first"
- A one-sided `like` (only A → B, no reverse) produces zero rows in `matches`
- A `pass` swipe never triggers a match, even if a prior `like` exists in the opposite direction
- Attempting to insert a swipe via the `authenticated` role with `actor_dog_id` set to a dog owned by a different user is rejected by RLS
- Attempting to `select` another user's `swipes` rows (where neither `actor_dog_id` nor context matches the querying user's own dog) returns zero rows
- A user can `select` a `matches` row where their dog is either `dog_a_id` or `dog_b_id`, and cannot see matches they're not part of

---

## Phase 2: Type definitions

### Overview

Manually mirror the new schema into `src/types.ts`, following the exact structure already used for `dogs`, so application code (the later `browse-dogs`/`matches-list` changes) gets full type safety without a live Supabase instance to regenerate from.

### Changes Required:

#### 1. Extend generated-style types

**File**: `src/types.ts`

**Intent**: Add `swipes` and `matches` to `Database["public"]["Tables"]`, add `swipe_decision` to `Database["public"]["Enums"]` and `Constants.public.Enums`, and export `Swipe`/`Match` convenience aliases, matching the `Dog` alias already at the bottom of the file.

**Contract**: `Row`/`Insert`/`Update` shapes for `swipes` mirror the Phase 1 column list exactly (required columns have no `?` in `Insert`, `id`/`created_at` optional in `Insert` since they default); same for `matches`. `swipe_decision: "like" | "pass"` added to the `Enums` type and to `Constants.public.Enums.swipe_decision: ["like", "pass"]`. Export `export type Swipe = Database["public"]["Tables"]["swipes"]["Row"];` and `export type Match = Database["public"]["Tables"]["matches"]["Row"];` after the existing `Dog` export.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `npm run build` type-checks any file importing `Swipe`/`Match`/`Database["public"]["Tables"]["swipes"]` without error (implicitly covered by the Astro/TS build)

#### Manual Verification:

- N/A — type-only change, covered by automated build

---

## Phase 3: Final verification

### Overview

Confirm the full migration + type addition works end to end and leaves the rest of the app unaffected.

### Changes Required:

No code changes in this phase — verification only.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with zero errors
- `npm run build` passes

#### Manual Verification:

- If a local Supabase instance is available: `npx supabase start` + apply migrations, run the mutual-like / one-sided-like / pass / RLS-rejection scenarios from Phase 1 manually via the Supabase SQL editor or `psql`, confirm all outcomes match
- No regressions to existing `dogs` CRUD flow (`npm run smoke` still passes against a running server, unaffected since this change touches no existing table)

## Testing Strategy

### Unit Tests:

- No unit test framework exists in this repo (per AGENTS.md, `npm run smoke` is the only automated check beyond lint/build) — this plan relies on lint/build + manual SQL-level verification, consistent with F-01's precedent.

### Integration Tests:

- `npm run smoke` — re-run after this change to confirm no regression to the existing auth/profile flows (this change adds new tables only, touches no existing route or middleware).

### Manual Testing Steps:

1. Apply the migration to a local Supabase instance (`npx supabase start`, `npx supabase db reset` or equivalent).
2. Using two seeded owner accounts with dogs (the existing `20260926164458_seed_test_dog_profiles.sql` seed data, or two fresh test dogs), insert a `like` swipe from dog A → dog B via the `authenticated` role (e.g. through the Supabase SQL editor with `set role authenticated; set request.jwt.claims...` or via two real signed-in sessions using `psql`/REST if easier) — confirm no `matches` row yet.
3. Insert the reverse `like` swipe (dog B → dog A) — confirm exactly one `matches` row now exists, with `dog_a_id < dog_b_id`.
4. Attempt a duplicate swipe (same actor/target pair) — confirm it's rejected by the `swipes_actor_target_unique` constraint.
5. Attempt to insert a swipe as user A with `actor_dog_id` = dog B's id (not A's own dog) — confirm RLS rejects it.
6. As user A, `select * from matches` — confirm only matches involving dog A are visible.

## Performance Considerations

No specific performance budget; both tables are expected to be small relative to `dogs` (bounded by number of swipes, not a hot path). The `swipes_actor_target_unique` and `matches_pair_unique` constraints double as the indexes needed for the trigger's exists-check and conflict-resolution, so no additional index is required in this MVP.

## Migration Notes

If a local Supabase/Docker instance becomes available later, regenerate `src/types.ts` via `npx supabase gen types typescript --local` and reconcile any drift against the manually-written types in Phase 2 (should match exactly if the migration SQL above was applied as written).

## References

- Related roadmap split: `context/changes/browse-and-match/change.md`
- Schema/RLS precedent: `supabase/migrations/20260925231055_create_dogs_table.sql`
- Types precedent: `src/types.ts:33-79`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Swipes and matches schema

#### Automated

- [x] 1.1 npm run lint passes (no new errors from this change; 1 pre-existing unrelated error in src/pages/dashboard.astro from commit d6d1c17, out of scope)
- [x] 1.2 npm run build passes
- [x] 1.3 Migration file exists at supabase/migrations/20260926200000_create_swipes_and_matches.sql — DB-apply not verified, no local Supabase/Docker instance available in this environment

#### Manual

- [ ] 1.4 As owner A (dog A) inserting a like swipe on dog B, then owner B (dog B) inserting a like swipe on dog A: exactly one row appears in matches after the second insert, in canonical order — blocked, no local Supabase instance available
- [ ] 1.5 A one-sided like produces zero rows in matches — blocked, no local Supabase instance available
- [ ] 1.6 A pass swipe never triggers a match, even if a prior like exists in the opposite direction — blocked, no local Supabase instance available
- [ ] 1.7 Inserting a swipe with actor_dog_id owned by a different user is rejected by RLS — blocked, no local Supabase instance available
- [ ] 1.8 Selecting another user's swipes rows returns zero rows — blocked, no local Supabase instance available
- [ ] 1.9 A user can select a matches row where their dog is either dog_a_id or dog_b_id, and cannot see matches they're not part of — blocked, no local Supabase instance available

### Phase 2: Type definitions

#### Automated

- [x] 2.1 npm run lint passes
- [x] 2.2 npm run build passes
- [x] 2.3 npm run build type-checks any file importing Swipe/Match/Database["public"]["Tables"]["swipes"] without error

### Phase 3: Final verification

#### Automated

- [x] 3.1 npm run lint passes with zero new errors (see 1.1 note)
- [x] 3.2 npm run build passes

#### Manual

- [ ] 3.3 Local Supabase manual verification of mutual-like/one-sided/pass/RLS scenarios — blocked, no local Supabase instance available; must be run before merging to main
- [ ] 3.4 npm run smoke still passes against a running server — not run (requires a running server)
