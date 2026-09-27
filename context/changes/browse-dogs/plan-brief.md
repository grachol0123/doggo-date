# Browse Dogs (browse/swipe) — Plan Brief

> Full plan: `context/changes/browse-dogs/plan.md`

## What & Why

Build the browse/swipe part of roadmap S-02 (`browse-and-match`): an API to fetch the next unrated dog profile and record like/pass decisions, plus the `/dashboard` UI to act on them. This is the middle sub-change between the already-shipped `match-data-foundation` (schema) and the upcoming `matches-list` (matches page) — without it, an owner has a data model for matching but no way to actually browse or swipe.

## Starting Point

`swipes`/`matches` tables, RLS, and the mutual-like DB trigger already exist and are migrated (`match-data-foundation`, impl_reviewed). `dashboard.astro` is a static placeholder card; `Sidebar.astro` (F-02) already handles navigation. No browse/swipe API or UI exists yet — this is greenfield on top of the data foundation.

## Desired End State

An owner who has created their dog's profile lands on `/dashboard` and sees one candidate dog at a time (newest profiles first, tie-broken by shared interests), with Lubię/Pomiń buttons. Swiping instantly loads the next candidate; a mutual like shows a "To dopasowanie!" banner right away. Owners without a dog profile yet, or who've run out of candidates, see a clear message instead of a broken or empty page.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| API pattern | JSON fetch endpoints (no page reload) | Meets the PRD NFR of <1s per next-profile load; the existing formData→redirect pattern can't. |
| No-own-dog handling | Inline prompt + link to `/dashboard/dog` | Simple, keeps the owner on `/dashboard` with clear next action. |
| Empty state | Static "no more profiles" message, no polling | Matches MVP scope; avoids background polling complexity. |
| Match feedback | Inline "To dopasowanie!" banner on the completing swipe | Satisfies PRD "match visible immediately" without waiting for the (not-yet-built) matches list. |
| Next-profile loading | Fetch one candidate at a time | Simplest implementation; dataset size (seeded ~20 dogs) keeps this well under the 1s budget. |
| Swipe error handling | Inline error + retry, candidate stays put | Avoids silently dropping a user's swipe decision on a transient network failure. |
| Candidate ordering | Computed in the API route (TypeScript), not a Postgres RPC | No RPC precedent exists in this repo; dataset is small enough that server-side sort is simple and fast enough. |

## Scope

**In scope:**
- `GET /api/dogs/next-candidate` — next unrated dog for the current owner
- `POST /api/swipes` — record like/pass, report whether it created a match
- `BrowseDogs` React island wired into `/dashboard`, covering loading/candidate/empty/no-profile/error states

**Out of scope:**
- Matches list page/API (next sub-change, `matches-list`)
- Realtime/WebSocket updates (reserved for S-03)
- Swipe gestures/drag, filters, unmatch — all confirmed out of scope for MVP

## Architecture / Approach

Two new Astro JSON API routes resolve the caller's own `dogs` row server-side (same pattern as `dashboard/dog.astro`), then either compute the next candidate (DB query + in-memory sort/tie-break) or insert a `swipes` row and check `matches` for the trigger's result. A single React island (`BrowseDogs.tsx`, `client:load`) owns all UI state and drives both endpoints via `fetch`, replacing the placeholder content in `dashboard.astro`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Browse API | `GET /api/dogs/next-candidate` with correct ordering/exclusions | Getting the "already rated" exclusion and tie-break logic right against real seed data |
| 2. Swipe API | `POST /api/swipes` recording decisions + match detection | Race/duplicate handling (unique constraint) surfaced as a clean response, not a 500 |
| 3. Main-page UI | `BrowseDogs` island wired into `/dashboard` | Covering all 5 UI states (loading/candidate/empty/no-profile/error) without dead ends |
| 4. Final verification | End-to-end confirmation + no regressions | Manual DB-level verification depends on a reachable Supabase instance (local or remote) |

**Prerequisites:** `match-data-foundation` (impl_reviewed, done), `dashboard-sidebar-nav` (F-02, done/merged), seeded test dog profiles (already present).
**Estimated effort:** ~1-2 sessions across 4 phases.

## Open Risks & Assumptions

- Manual DB-level verification (Phase 1/2 manual criteria) requires a reachable Supabase instance with the `match-data-foundation` migration applied — same constraint noted in that change's own plan.
- The in-memory tie-break sort assumes the seeded/expected dataset stays small (tens of rows); noted in Performance Considerations as a future RPC candidate if it grows.

## Success Criteria (Summary)

- An owner can browse and swipe through dog profiles on `/dashboard` without ever seeing a repeat or their own dog, and the next profile appears near-instantly after each swipe.
- A mutual like is visibly confirmed to both owners the moment it happens, without needing the (future) matches list.
- Owners with no dog profile, or with no candidates left, see a clear, non-broken message instead of an empty/crashed page.
