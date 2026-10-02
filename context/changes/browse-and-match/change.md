---
change_id: browse-and-match
title: Owner browses dog profiles and creates a match
status: new
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

Roadmap S-02 (`context/foundation/roadmap.md`). Prerequisite: S-01 (dog-profile-crud,
impl_reviewed). Unlocks S-03 (first-message) — the `matches` table shape designed here
is the foreign-key foundation for the future `conversations`/`messages` model.
PRD refs: US-01, FR-003, FR-004, FR-005.

**Implementation split (2026-09-26):** this change is an umbrella only — no plan/implementation
happens directly in this folder. Work is split into 3 separate change folders, executed in order:

1. `context/changes/match-data-foundation/` — `swipes` + `matches` tables, RLS, mutual-like trigger.
2. `context/changes/browse-dogs/` — browse API (next unrated dog) + swipe endpoint + main-page UI.
3. `context/changes/matches-list/` — matches list API + page.

Prerequisite: `context/changes/dashboard-sidebar-nav/` (F-02) — sidebar nav, built in parallel on
its own branch by a background agent, so `browse-dogs` has somewhere to put the main-page content.

Design decisions locked in during planning (apply to the sub-changes above):

- Match creation via DB trigger on `swipes` insert (atomic, avoids race condition on mutual likes).
- "Trafność dopasowania" (PRD tie-break) = count of shared `interests` array elements.
- No realtime for match visibility in S-02 — matches list loads on page visit; realtime is reserved
  for S-03 (messages) per PRD/NFR.
- Swipe input = buttons only (Lubię / Pomiń), no drag gesture.
- No unmatch/unlike in MVP (confirmed out of scope, matches roadmap Parked section).
