# Matches List (API + Page) Implementation Plan

## Overview

Implement the third and final sub-change for roadmap S-02 (`browse-and-match`): a JSON GET endpoint that returns the current owner's matches joined with the matched dog's profile, and a `/dashboard/matches` page with a `MatchesList` React island rendering those matches as cards — newest match first, with a Sidebar nav link so owners can reach it from anywhere in the dashboard.

## Current State Analysis

- `supabase/migrations/20260926200000_create_swipes_and_matches.sql` (via `match-data-foundation`, fully verified 2026-10-03) already provides `matches(id, dog_a_id, dog_b_id, created_at)`, canonical-order + unique-pair constrained, RLS `matches_select_participant` letting an authenticated user read any `matches` row where their own dog is `dog_a_id` or `dog_b_id`. Match rows are created exclusively by a `security definer` trigger on `swipes` insert — no API in this repo creates `matches` rows directly.
- `src/types.ts:118-166` already exports `Match`/`Swipe`/`Dog` type aliases mirroring the schema — no new types are needed.
- `browse-dogs` (implemented) established the exact conventions this plan reuses: JSON fetch API routes under `src/pages/api/`, resolving the caller's own dog server-side from `context.locals.user.id`, Supabase Storage public-URL resolution for `dog-photos`, a single-purpose React island wired via `client:load` from an Astro page, and `dog-enums.ts` label lookups for interests/activity level.
- `/dashboard` is now the `BrowseDogs` island (`src/pages/dashboard.astro`); `/dashboard/dog` is the dog-profile page. No `/dashboard/matches` route exists yet.
- `src/components/Sidebar.astro:10` has an explicit placeholder comment — `<!-- Future nav items (Przeglądaj, Matche) will be added here by later changes. -->` — and currently renders only the "Mój profil psa" link. This plan adds the "Matche" link here; "Przeglądaj" was intentionally left for a later change (not part of this plan's scope) since `/dashboard` itself already is the browse view and doesn't need a separate nav entry yet.
- `dogs.owner_id` is `unique` (one dog per owner), so "my dog" and "the matched dog" are each resolved as a single row per `matches` participant, same as every other sub-change in this slice.
- No existing API route in this repo joins two tables server-side in one query with Supabase's embedded-resource syntax (`select("*, other_dog:dogs!...")`); `next-candidate.ts` and `save.ts` both issue single-table queries. Because `matches.dog_a_id`/`dog_b_id` both reference `dogs.id` without distinguishing "which one is me," a single declarative embedded-select would require naming both foreign keys explicitly and still require per-row JS to pick the non-owned side — so this plan reads `matches` and `dogs` as two separate queries (same shape as `next-candidate.ts`'s swipes+dogs pattern) and joins them in TypeScript, keeping the query style consistent with the rest of this slice rather than introducing a new Supabase query pattern for one endpoint.

## Desired End State

- `GET /api/matches` returns, for the current owner's dog, every match it participates in — each entry carries the matched dog's profile (name, age, breed, interests, photo URL), the match's `created_at`, and a shared-interest count against the viewer's own dog — sorted newest match first. Distinguishes `no_own_dog` (caller has no `dogs` row) from an empty `matches: []` list (has a dog, zero matches yet).
- `/dashboard/matches` renders a `MatchesList` React island: a grid of match cards (photo, name, age, breed, shared-interest count, match date, a disabled "Napisz wiadomość" button) when matches exist; a dedicated empty state ("Nie masz jeszcze żadnych dopasowań. Przejrzyj profile psów, aby znaleźć partnera!") when the owner has zero matches; a dedicated "create your dog profile first" prompt (same pattern as `BrowseDogs`) when the owner has no dog profile yet; an inline error with a retry action if the fetch fails.
- `Sidebar.astro` gains a "Matche" nav link to `/dashboard/matches`, alongside the existing "Mój profil psa" link.
- Verified end-to-end: two seeded accounts that mutually like each other's dogs each see the new match appear on `/dashboard/matches` (newest-first) immediately on page load — no realtime push, consistent with the locked design decision for S-02.

### Key Discoveries:

- `supabase/migrations/20260926200000_create_swipes_and_matches.sql` (contract documented in `match-data-foundation/plan.md:60-76`) — `matches_select_participant` RLS already allows reading all of a user's matches; no new RLS policy is needed in this plan.
- `src/pages/api/dogs/next-candidate.ts:25-47` — canonical "resolve own dog from `context.locals.user.id`, return a distinct `no_own_dog` status if absent" pattern, reused verbatim here.
- `src/pages/api/dogs/next-candidate.ts:16-20` — `countSharedInterests` helper logic (shared-interest count between two `Dog["interests"]` arrays) is duplicated inline in this plan's endpoint rather than imported, since `next-candidate.ts` doesn't export it and extracting a shared util is out of scope for this plan (see "What We're NOT Doing").
- `src/components/dog/BrowseDogs.tsx:1-10, 229-246` — exact import/empty-state/no-own-dog-prompt conventions (`Card`/`CardHeader`/`CardTitle`/`CardContent`, `Alert`/`AlertDescription`, uppercase-tracked eyebrow text, "Przejdź do profilu psa" link) this plan's `MatchesList` mirrors for visual consistency.
- `src/components/Sidebar.astro:10` — the exact placeholder comment this plan's nav-link addition replaces/extends.
- `src/lib/dog-enums.ts` — `dogInterestOptions` label lookup, reused for rendering a matched dog's interests if shown (plan keeps the card compact per the locked decision — see Key Decisions in `plan-brief.md` — interests are counted, not listed, on the card).

## What We're NOT Doing

- No messaging/conversation UI or "Napisz wiadomość" functionality — the button on each match card is a disabled placeholder; wiring it up is S-03 (`first-message`), not yet planned.
- No realtime/WebSocket updates — matches appear on page load/refresh only, per the locked design decision in `browse-and-match/change.md` (realtime is reserved for S-03).
- No unmatch/remove-match capability — confirmed out of scope for MVP, matches roadmap Parked section and the existing `matches` RLS (no delete policy for `authenticated`).
- No "Przeglądaj" nav link addition — `/dashboard` is already the browse view and the roadmap's own placeholder comment anticipates it as a separate, later nav-polish item; adding it here would be unrelated scope creep.
- No pagination/infinite-scroll on the matches list — the MVP seed dataset (20 dogs) bounds the realistic match count well below what needs pagination.
- No new RLS policy or schema change — this plan only reads the existing `matches`/`dogs` contract from `match-data-foundation`.
- No shared "resolve own dog" or "shared-interest count" utility extraction — both pieces of logic are duplicated from `next-candidate.ts` inline rather than refactored into a shared module, keeping this plan's diff scoped to its own files (an extraction is a reasonable future cleanup, not required here).

## Implementation Approach

One new Astro API route (`src/pages/api/matches/index.ts`) that resolves the caller's own dog, queries `matches` for rows where that dog is either participant, resolves the "other" dog id per row, bulk-fetches those dogs' profiles in a second query, computes each one's shared-interest count against the viewer's dog, and returns them sorted newest-match-first. A new `MatchesList.tsx` React island (`client:load` from a new `src/pages/dashboard/matches.astro` page) owns the fetch-on-mount/loading/error/empty/no-own-dog states, matching `BrowseDogs.tsx`'s state-machine shape. `Sidebar.astro` gets one more `<a>` nav link.

## Phase 1: Matches API

### Overview

Add a JSON GET endpoint that returns the current owner's matches, each enriched with the matched dog's profile, photo URL, and shared-interest count, sorted newest-first.

### Changes Required:

#### 1. Matches list API route

**File**: `src/pages/api/matches/index.ts`

**Intent**: Resolve the current user's own dog, find every `matches` row it participates in, and return each one paired with the other participant's full dog profile so the UI can render a card without a second round-trip.

**Contract**: `export const prerender = false; export const GET: APIRoute = ...`. Response JSON is one of: `{ status: "ok", matches: MatchListEntry[] }` where `MatchListEntry = { matchId: string; matchedAt: string; dog: Dog; photoUrl: string | null; sharedInterestCount: number }`, or `{ status: "no_own_dog" }`, or `{ status: "unauthenticated" }` (HTTP 401), or `{ status: "error", message: string }` (HTTP 500). Steps: (1) resolve `ownDog` via `select id, interests from dogs where owner_id = user.id` (`maybeSingle`), same as `next-candidate.ts`; return `no_own_dog` if absent; (2) `select id, dog_a_id, dog_b_id, created_at from matches where dog_a_id = eq(ownDog.id) or dog_b_id = eq(ownDog.id)` via `.or(\`dog_a_id.eq.${ownDog.id},dog_b_id.eq.${ownDog.id}\`)`; (3) for each match row compute `otherDogId = row.dog_a_id === ownDog.id ? row.dog_b_id : row.dog_a_id`; (4) if the match list is non-empty, `select * from dogs where id in (<otherDogIds>)`in one query (PostgREST`.in("id", otherDogIds)`), building an `id -> Dog`lookup map; (5) assemble`MatchListEntry[]`from the match rows + lookup map, computing`sharedInterestCount`the same way`next-candidate.ts`does (intersection size between`ownDog.interests`and the other dog's`interests`), building `photoUrl`via`supabase.storage.from("dog-photos").getPublicUrl(...)`when`photo_path`is set; (6) sort by`matchedAt`descending (newest first) before returning. An empty`matches`query result returns`{ status: "ok", matches: [] }`, not `no_own_dog` — those are distinct states.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- An owner with no `dogs` row gets `{ status: "no_own_dog" }` from `GET /api/matches`
- An owner with a dog but zero matches gets `{ status: "ok", matches: [] }`
- Two seeded owners who mutually like each other's dogs each see exactly one entry for each other in their own `GET /api/matches` response (`matchId` identical on both sides, `dog` on each side is the _other_ participant, not their own dog)
- With more than one match, entries are ordered newest-match-first (`matchedAt` descending)
- `sharedInterestCount` matches the actual intersection size between the two dogs' `interests` arrays (verified against seeded profiles with known interests)

---

## Phase 2: Matches list page (UI)

### Overview

Add the `/dashboard/matches` page, its `MatchesList` React island, and the Sidebar nav link to reach it.

### Changes Required:

#### 1. Matches list UI component

**File**: `src/components/dog/MatchesList.tsx`

**Intent**: Client-side component that fetches `GET /api/matches` on mount and renders the result as a grid of match cards, or the appropriate empty/no-profile/error state — mirroring `BrowseDogs.tsx`'s state-machine shape and visual language (`Card`, `Badge`, `Alert`, eyebrow-text header).

**Contract**: Props: none (fetches client-side). Internal view states: `loading`, `no_own_dog` (same copy/link pattern as `BrowseDogs.tsx`'s equivalent state, pointing to `/dashboard/dog`), `error` (inline `Alert` + "Spróbuj ponownie" retry button, re-running the fetch), `list` (empty-state message "Nie masz jeszcze żadnych dopasowań. Przejrzyj profile psów, aby znaleźć partnera!" when `matches.length === 0`, otherwise a responsive card grid). Each match card shows: photo (or `PawPrint` placeholder, same as `BrowseDogs`), name, age badge, breed badge (if present), a "X wspólnych zainteresowań" badge, the match date formatted with a Polish-locale `Intl.DateTimeFormat`, and a disabled `Button` labeled "Napisz wiadomość" (no `onClick`, `disabled` prop set — placeholder for the future `first-message` change).

#### 2. Matches page route

**File**: `src/pages/dashboard/matches.astro`

**Intent**: New protected Astro page hosting the `MatchesList` island inside `DashboardLayout`, following `dashboard/dog.astro`'s structure (no server-side data fetch needed here — all data comes from the client-side API call).

**Contract**: `<DashboardLayout title="Moje dopasowania"><MatchesList client:load /></DashboardLayout>`, plus a "Powrót do panelu" link back to `/dashboard` (same footer pattern as `dashboard/dog.astro`).

#### 3. Sidebar nav link

**File**: `src/components/Sidebar.astro`

**Intent**: Add a "Matche" link to `/dashboard/matches` next to the existing "Mój profil psa" link, replacing the now-half-stale placeholder comment (leave the "Przeglądaj" part of the comment in place, since that nav item is still future work — see "What We're NOT Doing").

**Contract**: One more `<a href="/dashboard/matches" class:list={[cn(buttonVariants({ variant: "outline" }), "justify-start")]}>Matche</a>` inside the existing `<nav>`, below the "Mój profil psa" link.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Visiting `/dashboard/matches` as a seeded owner with no matches shows the empty-state message, not a blank screen or a crash
- Visiting `/dashboard/matches` as an owner with no dog profile shows the "create your dog profile first" prompt
- After manufacturing a mutual like between two seeded accounts (via `/dashboard` browse/swipe), both owners see the new match card on `/dashboard/matches` on next page load, with correct name/age/breed/shared-interest count/match date
- The "Napisz wiadomość" button is visibly disabled and does nothing when clicked
- The "Matche" link appears in the Sidebar on every dashboard page and navigates to `/dashboard/matches`
- Simulating a network failure on the matches fetch shows the inline error + retry state, and retry succeeds once the network is restored

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Final verification

### Overview

Confirm the full matches-list flow works end to end against seeded data and leaves existing flows (browse/swipe, dog profile, auth) unaffected — and that this closes out roadmap slice S-02 (`browse-and-match`) entirely.

### Changes Required:

No code changes in this phase — verification only.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with zero errors
- `npm run build` passes
- `npm run smoke` passes against a running server

#### Manual Verification:

- Full manual scenarios from Phases 1-2 re-run together in one session against the seeded dog profiles
- No regression to `/dashboard` (browse-dogs), `/dashboard/dog` (dog-profile-crud), or the Sidebar's existing "Mój profil psa" link

## Testing Strategy

### Unit Tests:

- No unit test framework exists in this repo (per AGENTS.md) — this plan relies on lint/build + manual verification, consistent with `match-data-foundation` and `browse-dogs`'s precedent.

### Integration Tests:

- `npm run smoke` — re-run after this change to confirm no regression to existing auth/profile/browse flows.

### Manual Testing Steps:

1. Ensure `match-data-foundation` migration + seed data and `browse-dogs` are both applied/implemented on the target environment.
2. Sign in as a seeded owner with zero matches, visit `/dashboard/matches`, confirm the empty state.
3. Using two seeded owner accounts, mutually like each other's dogs via `/dashboard` (browse/swipe).
4. Visit `/dashboard/matches` as each owner, confirm the new match card appears with the correct other dog's profile, shared-interest count, and match date, newest-first if multiple matches exist.
5. Confirm the "Napisz wiadomość" button is disabled.
6. Sign in as an owner with no dog profile yet, visit `/dashboard/matches`, confirm the "create your dog profile first" prompt instead of a crash.
7. Throttle/block the network for the matches fetch and confirm the inline error + retry state, then restore network and confirm retry succeeds.
8. Click the new "Matche" Sidebar link from `/dashboard` and `/dashboard/dog`, confirm it navigates to `/dashboard/matches`.
9. Re-run `npm run smoke` to confirm no regression.

## Performance Considerations

Matches are fetched in two queries (match rows, then a bulk `in()` lookup of the other participants' dog rows) rather than N+1 per-row queries; acceptable for the MVP's seeded dataset size. No pagination needed at this scale (see "What We're NOT Doing").

## Migration Notes

None — no schema changes in this plan.

## References

- Related roadmap split: `context/changes/browse-and-match/change.md`
- Data foundation this plan builds on: `context/changes/match-data-foundation/plan.md`
- API/UI pattern precedent: `context/changes/browse-dogs/plan.md`, `src/pages/api/dogs/next-candidate.ts`, `src/components/dog/BrowseDogs.tsx`
- Protected-page pattern: `src/pages/dashboard/dog.astro`
- Nav placeholder being filled: `src/components/Sidebar.astro:10`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Matches API

#### Automated

- [x] 1.1 npm run lint passes
- [x] 1.2 npm run build passes

#### Manual

- [x] 1.3 Owner with no dogs row gets no_own_dog
- [x] 1.4 Owner with a dog but zero matches gets ok with matches: []
- [x] 1.5 Two mutually-liked owners each see exactly one correct entry for each other
- [x] 1.6 Multiple matches are ordered newest-first
- [x] 1.7 sharedInterestCount matches the real intersection size

### Phase 2: Matches list page (UI)

#### Automated

- [ ] 2.1 npm run lint passes
- [ ] 2.2 npm run build passes

#### Manual

- [ ] 2.3 Empty state shows for an owner with zero matches
- [ ] 2.4 No-own-dog prompt shows for an owner without a dog profile
- [ ] 2.5 Match card appears for both owners after a mutual like, with correct data
- [ ] 2.6 "Napisz wiadomość" button is disabled and inert
- [ ] 2.7 Sidebar "Matche" link appears and navigates correctly
- [ ] 2.8 Network failure shows inline error + retry, retry succeeds after recovery

### Phase 3: Final verification

#### Automated

- [ ] 3.1 npm run lint passes with zero errors
- [ ] 3.2 npm run build passes
- [ ] 3.3 npm run smoke passes against a running server

#### Manual

- [ ] 3.4 Full manual scenarios re-run together in one session
- [ ] 3.5 No regression to /dashboard, /dashboard/dog, or existing Sidebar link
