# Browse Dogs (Browse/Swipe API + Main Page UI) Implementation Plan

## Overview

Implement the second of 3 sub-changes for roadmap S-02 (`browse-and-match`): a browse API that returns the next unrated dog profile for the current owner's dog (newest-first, shared-`interests` tie-break, excluding already-swiped and own dogs), a swipe API that records like/pass and reports whether a match was created, and a React island on `/dashboard` that lets the owner review profiles with Lubię/Pomiń buttons — replacing the current placeholder welcome content.

## Current State Analysis

- `supabase/migrations/20260926200000_create_swipes_and_matches.sql` (via `match-data-foundation`, `impl_reviewed`) already provides `swipes` (actor_dog_id, target_dog_id, decision, unique per pair), `matches` (dog_a_id, dog_b_id, canonical order, unique pair), and a `security definer` trigger that inserts a `matches` row the moment a mutual `like` exists. No API/UI reads or writes these tables yet.
- `src/types.ts:79-118` already exports `Swipe`/`Match` types mirroring the schema (`src/types.ts:165-166`).
- `dogs` RLS (`supabase/migrations/20260925231055_create_dogs_table.sql`) lets any authenticated user `select` all dogs — no new RLS needed to read browse candidates.
- `dogs.owner_id` is `unique` (one dog per owner); the current user's own `dog.id` must be resolved server-side from `context.locals.user.id` before any browse/swipe query.
- `src/pages/dashboard.astro` is currently a static placeholder (welcome card) — this plan replaces its body with the browse UI. `src/components/Sidebar.astro` already provides navigation (F-02, done) and is not touched here.
- `src/pages/dashboard/dog.astro:18-27` is the established pattern for a protected Astro page that loads Supabase data server-side via `createClient(Astro.request.headers, Astro.cookies)` and passes `dog`/photo URL into a React island via `client:load`.
- `src/pages/api/dogs/save.ts` is the only existing API route; its formData→redirect pattern is unsuitable here (this plan needs JSON fetch endpoints per the NFR that the next profile loads in <1s without a full page reload — locked design decision, see Key Decisions in `plan-brief.md`).
- `src/lib/dog-enums.ts` provides Polish labels for `dog_activity_level`/`dog_interest` — reused for rendering the candidate card.
- No Postgres RPC/function precedent exists in this repo for read queries (only the mutual-match trigger touches SQL logic beyond CRUD) — the browse-candidate selection (order by newest, tie-break by shared-interest count) is done in the API route in TypeScript, not a new SQL function, keeping this change self-contained and consistent with the app's existing "logic lives in the API route" convention.
- `PROTECTED_ROUTES` in `src/middleware.ts:4` already covers `/dashboard` via `startsWith`, so no middleware change is needed for the new API routes under `/dashboard`'s existing session; API routes still re-check `context.locals.user` directly, matching `save.ts`'s own-user guard.

## Desired End State

- `GET /api/dogs/next-candidate` returns the next dog profile the current owner hasn't swiped yet (excluding their own dog), sorted newest-first with shared-interest tie-break, or a distinct "no own dog yet" / "no candidates left" result.
- `POST /api/swipes` records a like/pass decision for the current owner's dog against a target dog and reports whether that swipe just created a match.
- `/dashboard` renders a `BrowseDogs` React island: shows a candidate card (photo, name, age, description, temperament/interests as Polish labels) with Lubię/Pomiń buttons; on click, calls the swipe API, shows a "To dopasowanie!" banner if matched, then fetches and shows the next candidate; shows a dedicated empty state when there are no more candidates, and a dedicated prompt (with a link to `/dashboard/dog`) when the owner has no dog profile yet; shows an inline error with a retry action if a swipe request fails, without advancing to the next candidate.
- Verified end-to-end against the 20 seeded dog profiles (`supabase/migrations/20260926164458_seed_test_dog_profiles.sql`): swiping through candidates never repeats an already-rated dog or the viewer's own dog, and a manufactured mutual-like pair produces the match banner.

### Key Discoveries:

- `supabase/migrations/20260926200000_create_swipes_and_matches.sql` (Phase 1 contract in `match-data-foundation/plan.md:60-76`) — `swipes_actor_target_unique` and `matches_pair_unique` constraints mean a duplicate swipe attempt is a constraint violation the API must treat as a benign no-op (already-swiped), not a hard error.
- `src/types.ts:165-166` — `Swipe`/`Match` type aliases already exist; this plan adds no new types.
- `src/pages/dashboard/dog.astro:18-27` — canonical pattern for resolving the current owner's own `dogs` row server-side; reused here to resolve `actor_dog_id`.
- `src/pages/api/dogs/save.ts:159-163` — canonical `user`-guard-then-redirect-to-signin pattern for API routes; this plan's JSON endpoints return a 401 JSON body instead of a redirect, since they're called via `fetch`, not form submission.

## What We're NOT Doing

- No matches-list page or API (`matches-list`, the third sub-change) — the match banner shown here is a same-session confirmation only; there is no persistent "view all matches" surface yet.
- No realtime/WebSocket updates — reserved for S-03 (messages) per the locked design decision.
- No swipe-gesture/drag library — buttons only (Lubię/Pomiń), per the locked design decision in `browse-and-match/change.md`.
- No unmatch/undo-swipe capability — swipes and matches remain immutable, per the locked design decision.
- No filters (age/interests/location) — out of scope per PRD Non-Goals.
- No prefetching/batching of multiple candidates client-side — one candidate is fetched at a time, per the locked design decision.
- No changes to `dogs`, `swipes`, or `matches` schema/RLS — this plan only reads/writes rows within the existing contract from `match-data-foundation`.

## Implementation Approach

Two new Astro API routes under `src/pages/api/` (`dogs/next-candidate.ts`, `swipes/index.ts`) that resolve the caller's own dog server-side, then either query for the next unrated candidate or insert a swipe row and check for a resulting match. A new `BrowseDogs.tsx` React island (client:load from `dashboard.astro`) owns all client-side state (current candidate, loading, error, match banner, empty/no-profile states) and talks to these two endpoints via `fetch`, matching the JSON-fetch pattern locked in during planning.

## Phase 1: Browse API (next candidate)

### Overview

Add a JSON GET endpoint that returns the next dog profile for the current owner to review, applying the newest-first + shared-interest tie-break ordering and excluding the viewer's own dog and already-swiped dogs.

### Changes Required:

#### 1. Next-candidate API route

**File**: `src/pages/api/dogs/next-candidate.ts`

**Intent**: Resolve the current user's own dog, then find the best next candidate dog to show them, or report why none is available.

**Contract**: `export const prerender = false; export const GET: APIRoute = ...`. Response is JSON with one of three shapes: `{ status: "ok", dog: Dog, photoUrl: string | null }`, `{ status: "no_own_dog" }` (current user has no `dogs` row yet), or `{ status: "no_candidates" }` (no unrated dog remains). Returns HTTP 401 JSON (`{ status: "unauthenticated" }`) if `context.locals.user` is missing. Query steps: (1) `select id, interests from dogs where owner_id = user.id` (maybeSingle) — if null, return `no_own_dog`; (2) `select target_dog_id from swipes where actor_dog_id = <own dog id>` to build an excluded-id set; (3) `select * from dogs where owner_id != user.id and id not in (<excluded ids>) order by created_at desc` (Supabase `.not("id", "in", ...)` or client-side filter if the excluded-id list is empty, since `.not(..., "in", "()")` is invalid PostgREST syntax); (4) in TypeScript, compute each remaining candidate's shared-interest count against the viewer's own `interests` array, and pick the first candidate after stable-sorting by `(created_at desc, sharedInterestCount desc)` — the initial DB order (`created_at desc`) is preserved as the primary key by using a stable sort that only reorders on the tie-break; (5) if the result set was empty, return `no_candidates`; otherwise build the candidate's public photo URL via `supabase.storage.from("dog-photos").getPublicUrl(...)` (same helper as `dog.astro`) and return `ok`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `npm run typecheck` (covered by `npm run build`) resolves `Dog`/`Swipe` imports without error

#### Manual Verification:

- With a seeded owner that has a dog and has swiped some dogs already, `GET /api/dogs/next-candidate` never returns a dog id present in that owner's `swipes.target_dog_id` set or the owner's own dog id
- With an owner that has no `dogs` row, the endpoint returns `{ status: "no_own_dog" }`
- After swiping all 20 seeded dogs (minus own), the endpoint returns `{ status: "no_candidates" }`
- Candidates are returned newest-created-first, with dogs sharing more `interests` with the viewer's own dog appearing before same-age-cohort dogs sharing fewer (constructed via seed data with known `created_at`/`interests` values)

---

## Phase 2: Swipe API (record decision + report match)

### Overview

Add a JSON POST endpoint that records a like/pass decision from the current owner's dog against a target dog, and reports whether that swipe just completed a mutual match.

### Changes Required:

#### 1. Swipe API route

**File**: `src/pages/api/swipes/index.ts`

**Intent**: Insert a `swipes` row for the current owner's dog and the given target, then check whether the DB trigger created a corresponding `matches` row, so the UI can show the match banner immediately.

**Contract**: `export const prerender = false; export const POST: APIRoute = ...`. Request body (JSON): `{ targetDogId: string; decision: "like" | "pass" }`, validated with a small zod schema (`z.object({ targetDogId: z.string().uuid(), decision: z.enum(["like", "pass"]) })`, following the `dogProfileSchema` convention in `src/lib/schemas/dog-profile.ts`). Response: `{ status: "ok", matched: boolean }` on success, `{ status: "already_swiped" }` if the insert fails specifically on the `swipes_actor_target_unique` constraint (Postgres error code `23505`), `{ status: "no_own_dog" }` if the caller has no `dogs` row, `{ status: "invalid" }` (HTTP 400) on validation failure, `{ status: "unauthenticated" }` (HTTP 401) if unauthenticated. Steps: (1) resolve own dog id from `context.locals.user.id` (same lookup as Phase 1); (2) `insert into swipes (actor_dog_id, target_dog_id, decision)`; (3) on unique-violation, return `already_swiped` (treat as benign, not an error the UI needs to retry); (4) on `decision === "like"` success, `select id from matches where (dog_a_id = least(own,target) and dog_b_id = greatest(own,target))` to detect the trigger's result and set `matched` accordingly; `decision === "pass"` always returns `matched: false` without querying `matches`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Two seeded owners mutually liking each other's dogs: the second `POST /api/swipes` call (whichever owner swipes second) returns `matched: true`; the first returns `matched: false`
- A `pass` decision always returns `matched: false` even if a prior opposite-direction `like` exists
- Submitting the same `targetDogId` twice returns `{ status: "already_swiped" }` on the second call, not a 500
- Submitting a `targetDogId` that is the caller's own dog is rejected (relies on the existing `swipes_no_self_swipe` DB constraint; verify the API surfaces this as a handled error, not an unhandled 500)

---

## Phase 3: Main-page browse UI

### Overview

Replace the placeholder welcome content on `/dashboard` with a `BrowseDogs` React island that drives the two APIs from Phase 1/2 and covers every named UI state.

### Changes Required:

#### 1. Browse UI component

**File**: `src/components/dog/BrowseDogs.tsx`

**Intent**: Client-side component owning the full browse/swipe interaction loop: load a candidate on mount, render its details with Lubię/Pomiń buttons, handle click → swipe API → next candidate, and render the empty/no-profile/error/match-banner states.

**Contract**: Props: none (all data fetched client-side via `fetch("/api/dogs/next-candidate")` / `fetch("/api/swipes", { method: "POST", ... })`). Internal state machine has 5 view states: `loading`, `no_own_dog` (message + link to `/dashboard/dog`), `no_candidates` (static "Brak nowych profili do przejrzenia" message, no auto-poll), `candidate` (the card + buttons, plus an optional dismissible match banner shown for the swipe that just matched), `swipe_error` (inline error message + a "Spróbuj ponownie" button that re-issues the same swipe request without discarding the current candidate). Uses `dogActivityLevelOptions`/`dogInterestOptions` labels from `src/lib/dog-enums.ts` for rendering. Uses existing `Card`/`Button`/`Badge` primitives from `src/components/ui/`.

#### 2. Dashboard page wiring

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the static welcome `Card` body with the `BrowseDogs` island, keeping `DashboardLayout` and the page title.

**Contract**: `<BrowseDogs client:load />` inside `DashboardLayout`, dropping the old "Welcome, {user.email}" placeholder markup (that content already lives in `Sidebar.astro`, per F-02).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Visiting `/dashboard` as a seeded owner with a dog profile shows a candidate card within a perceptible instant (<1s) of page load
- Clicking Lubię or Pomiń advances to a new candidate without a full page reload, and never re-shows a dog already swiped in the same session
- Manufacturing a mutual like (two browser sessions or two seeded accounts) shows the "To dopasowanie!" banner on the swipe that completes the match
- Swiping through all remaining seeded candidates ends on the "Brak nowych profili do przejrzenia" empty state
- Visiting `/dashboard` as an owner with no dog profile shows the "create your dog profile first" prompt instead of a candidate card or a crash
- Simulating a network failure on the swipe request (e.g. via browser devtools) shows the inline error + retry state, and retry succeeds once the network is restored, without skipping the candidate

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Final verification

### Overview

Confirm the full browse/swipe flow works end to end against the seeded data and leaves existing flows unaffected.

### Changes Required:

No code changes in this phase — verification only.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with zero errors
- `npm run build` passes
- `npm run smoke` passes against a running server (unaffected existing auth/profile flows)

#### Manual Verification:

- Full manual scenarios from Phases 1-3 re-run together in one session against the 20 seeded dog profiles
- No regression to `/dashboard/dog` (dog-profile-crud) or the sidebar nav (F-02)

## Testing Strategy

### Unit Tests:

- No unit test framework exists in this repo (per AGENTS.md) — this plan relies on lint/build + manual verification, consistent with `match-data-foundation`'s precedent.

### Integration Tests:

- `npm run smoke` — re-run after this change to confirm no regression to existing auth/profile flows.

### Manual Testing Steps:

1. Ensure the `match-data-foundation` migration and seed data (`20260926164458_seed_test_dog_profiles.sql`) are applied to the target Supabase instance.
2. Sign in as a seeded owner with a dog profile, visit `/dashboard`, confirm a candidate card renders.
3. Swipe (like or pass) through several candidates, confirming no repeats and that the empty state appears once all are exhausted.
4. Using a second seeded owner/dog, mutually like each other's dogs and confirm the match banner appears on the completing swipe.
5. Sign in as an owner with no dog profile yet, visit `/dashboard`, confirm the "create your dog profile first" prompt instead of a crash.
6. Throttle/block the network for one swipe request and confirm the inline error + retry state, then restore network and confirm retry succeeds.
7. Re-run `npm run smoke` to confirm no regression.

## Performance Considerations

Candidate selection loads all not-yet-swiped dogs into memory per request to compute the tie-break in TypeScript; acceptable for the MVP's seeded dataset size (~20 dogs) per the NFR of <1s per next-profile load. If the `dogs` table grows significantly, this query should move to a Postgres function/RPC to avoid transferring the full unrated set on every request — noted here, not addressed in this plan (no current scale need).

## Migration Notes

None — no schema changes in this plan.

## References

- Related roadmap split: `context/changes/browse-and-match/change.md`
- Data foundation this plan builds on: `context/changes/match-data-foundation/plan.md`
- API route precedent: `src/pages/api/dogs/save.ts`
- Protected-page + Supabase server data pattern: `src/pages/dashboard/dog.astro`
- Enum labels: `src/lib/dog-enums.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Browse API (next candidate)

#### Automated

- [x] 1.1 npm run lint passes — 2c7cbaa
- [x] 1.2 npm run build passes — 2c7cbaa
- [x] 1.3 npm run build resolves Dog/Swipe imports without error — 2c7cbaa

#### Manual

- [x] 1.4 Next-candidate never returns an already-swiped or own dog id — 2c7cbaa
- [x] 1.5 Owner with no dogs row gets no_own_dog — 2c7cbaa
- [x] 1.6 Owner who swiped all candidates gets no_candidates — 2c7cbaa
- [x] 1.7 Candidates returned newest-first with shared-interest tie-break — 2c7cbaa

### Phase 2: Swipe API (record decision + report match)

#### Automated

- [x] 2.1 npm run lint passes — 120a149
- [x] 2.2 npm run build passes — 120a149

#### Manual

- [x] 2.3 Mutual like returns matched: true on the completing swipe, false on the first — 120a149
- [x] 2.4 Pass never returns matched: true — 120a149
- [x] 2.5 Duplicate swipe returns already_swiped, not a 500 — 120a149
- [x] 2.6 Self-swipe is rejected as a handled error, not a 500 — 120a149

### Phase 3: Main-page browse UI

#### Automated

- [x] 3.1 npm run lint passes — 6495344
- [x] 3.2 npm run build passes — 6495344

#### Manual

- [x] 3.3 Candidate card loads within a perceptible instant of visiting /dashboard — 6495344
- [x] 3.4 Swipe buttons advance without full page reload and never repeat a swiped dog — 6495344
- [x] 3.5 Match banner shows on the completing mutual-like swipe — 6495344
- [x] 3.6 Empty state shows after exhausting all candidates — 6495344
- [x] 3.7 No-own-dog prompt shows instead of a crash — 6495344
- [x] 3.8 Network failure shows inline error + retry, retry succeeds after recovery — 6495344

### Phase 4: Final verification

#### Automated

- [x] 4.1 npm run lint passes with zero errors — e459ea8
- [x] 4.2 npm run build passes — e459ea8
- [x] 4.3 npm run smoke passes against a running server — e459ea8

#### Manual

- [x] 4.4 Full manual scenarios re-run together in one session — e459ea8
- [x] 4.5 No regression to /dashboard/dog or sidebar nav — e459ea8
