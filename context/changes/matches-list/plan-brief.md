# Matches List (API + Page) — Plan Brief

> Full plan: `context/changes/matches-list/plan.md`

## What & Why

Build the matches list — the third and final piece of roadmap S-02 (`browse-and-match`): a `GET /api/matches` endpoint returning the current owner's matches enriched with the matched dog's profile, and a `/dashboard/matches` page that renders them as cards. This satisfies PRD FR-005 ("Właściciel widzi listę swoich matchy") and the US-01 acceptance criterion that the match list is visible immediately after a match forms.

## Starting Point

`match-data-foundation` (fully verified) already provides the `matches`/`swipes` schema, RLS, and the mutual-like trigger that creates `matches` rows atomically. `browse-dogs` (implemented) already lets owners swipe and create matches from `/dashboard`, and established the JSON-API + React-island conventions this plan reuses. No route or UI currently reads the `matches` table — this is the only missing piece before S-02 is fully delivered.

## Desired End State

A signed-in owner can open `/dashboard/matches` (via a new "Matche" Sidebar link) and immediately see every dog they've mutually matched with — newest match first — each shown as a card with photo, name, age, breed, shared-interest count, and match date. A disabled "Napisz wiadomość" button previews the next feature (S-03) without being clickable yet. Owners with no matches or no dog profile yet see a clear, dedicated message instead of a blank or broken page.

## Key Decisions Made

| Decision                  | Choice                                                                              | Why (1 sentence)                                                                        | Source                            |
| ------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------- |
| Route                     | `/dashboard/matches` (new page, `/dashboard` stays the browse view)                 | Keeps the routing pattern consistent with `/dashboard/dog`; avoids moving `BrowseDogs`. | Plan                              |
| Sidebar nav               | Add a "Matche" link now                                                             | Fills the explicit placeholder comment already in `Sidebar.astro`.                      | Plan                              |
| Sort order                | Newest match first                                                                  | Matches the PRD/US-01 expectation that a fresh match is immediately visible.            | Plan                              |
| Card content              | Photo, name, age, breed, shared-interest count, match date                          | Enough to recognize/compare a match without overloading the card.                       | Plan                              |
| "Napisz wiadomość" button | Disabled placeholder (not omitted)                                                  | Signals the upcoming S-03 feature without implying it works yet.                        | Plan                              |
| Empty state copy          | "Nie masz jeszcze żadnych dopasowań. Przejrzyj profile psów, aby znaleźć partnera!" | Gives a clear next action (go browse) instead of a dead end.                            | Plan                              |
| Realtime                  | None — list loads on page visit/refresh                                             | Matches the design decision locked for all of S-02; realtime reserved for S-03.         | Frame (browse-and-match umbrella) |
| Unmatch/remove            | Not supported                                                                       | Out of scope for MVP, already decided for the whole slice.                              | Frame (browse-and-match umbrella) |

## Scope

**In scope:**

- `GET /api/matches` — own matches + other participant's dog profile + shared-interest count, newest-first.
- `/dashboard/matches` page + `MatchesList` React island covering loading/error/empty/no-own-dog/list states.
- Sidebar "Matche" nav link.

**Out of scope:**

- Messaging ("Napisz wiadomość" is a disabled placeholder) — S-03 (`first-message`).
- Realtime match notifications.
- Unmatch/remove-match.
- A "Przeglądaj" Sidebar link (separate, later nav-polish item).
- Pagination (seeded dataset scale doesn't need it).

## Architecture / Approach

One new Astro API route (`src/pages/api/matches/index.ts`) resolves the caller's own dog, queries `matches` for rows where that dog participates, bulk-fetches the other participants' `dogs` rows in one `in()` query, and returns enriched, sorted entries. A new `MatchesList.tsx` island fetches this endpoint on mount and renders cards, reusing `BrowseDogs.tsx`'s state-machine shape and visual language. `Sidebar.astro` gets one more link.

## Phases at a Glance

| Phase                     | What it delivers                                                   | Key risk                                                         |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1. Matches API            | `GET /api/matches` with enriched, sorted match entries             | Correctly identifying "the other dog" per match row (not self)   |
| 2. Matches list page (UI) | `/dashboard/matches` page, `MatchesList` island, Sidebar link      | Covering every UI state (empty/no-own-dog/error) without a crash |
| 3. Final verification     | Full manual + automated pass, confirms no regressions, closes S-02 | None — verification only                                         |

**Prerequisites:** `match-data-foundation` (fully verified) and `browse-dogs` (implemented) are both done.
**Estimated effort:** ~1 session across 3 phases (small, read-only API + one new page, closely mirrors `browse-dogs`).

## Open Risks & Assumptions

- Assumes Supabase's `.in("id", otherDogIds)` + `.or(...)` query syntax behaves as in `next-candidate.ts`'s precedent; no new query shape is introduced.
- Assumes the seeded dataset's match counts stay low enough that no pagination is needed (consistent with the rest of S-02).

## Success Criteria (Summary)

- An owner sees every match they've made, newest first, with correct profile data for the other dog.
- Owners with zero matches or no dog profile see a clear, non-broken state.
- This closes out roadmap slice S-02 (`browse-and-match`) — all 3 sub-changes (`match-data-foundation`, `browse-dogs`, `matches-list`) complete.
