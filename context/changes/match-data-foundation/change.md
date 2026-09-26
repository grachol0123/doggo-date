---
change_id: match-data-foundation
title: Minimal swipe and match data schema
status: impl_reviewed
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

First of 3 sub-changes implementing roadmap S-02 (`browse-and-match`), see
`context/changes/browse-and-match/change.md` for the full split and locked
design decisions. This sub-change covers only the data foundation: `swipes`
table (like/pass decisions) + `matches` table + RLS + a DB trigger that
atomically creates a match on mutual like. No API or UI in this change —
those are `browse-dogs` and `matches-list`.

Design decisions already made (see `browse-and-match/change.md`):
- Match creation via DB trigger on `swipes` insert (atomic, no app-level race).
- No unmatch/unlike in MVP.
- `dogs.owner_id` is unique (one dog per owner) — swipes/matches key off `dog_id`,
  not `owner_id` directly, mirroring F-01's `dogs` table convention.
