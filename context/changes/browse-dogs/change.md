---
change_id: browse-dogs
title: Owner browses unrated dog profiles and swipes like/pass
status: implemented
created: 2026-09-27
updated: 2026-09-27
archived_at: null
---

## Notes

Second of 3 sub-changes implementing roadmap S-02 (`browse-and-match`), see
`context/changes/browse-and-match/change.md` for the full split and locked design
decisions. Prerequisite `match-data-foundation` is `impl_reviewed` (swipes/matches
schema + RLS + mutual-like trigger already migrated). Prerequisite `dashboard-sidebar-nav`
(F-02) is merged to `develop`.

Scope: build the browse/swipe API (fetch next unrated dog for the current user's own
dog, respecting "don't show already-rated profiles again"; POST swipe decision
like/pass) and the main-page UI (`/dashboard`, buttons-only Lubię/Pomiń, no drag
gesture per locked decision). Sort order per PRD: newest profiles first, then
relevance tie-break = shared `interests` count. NFR: next profile must load in <1s.
No realtime here (reserved for S-03); matches list is out of scope (next sub-change
`matches-list`).
