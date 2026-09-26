---
date: 2026-09-26T15:05:00+02:00
researcher: Copilot CLI
git_commit: a87fa2ceb42e7a3a41d25d00fedf7cc32b1a4797
branch: develop
repository: grachol0123/doggo-date
topic: "Is S-01 (dog-profile-crud) far enough along to plan/implement the browse/swipe matching page (dashboard-page / roadmap S-02)?"
tags: [research, codebase, dog-profile-crud, browse-and-match, roadmap]
status: complete
last_updated: 2026-09-26
last_updated_by: Copilot CLI
last_updated_note: "Follow-up (18:14 CEST): S-01 is now fully implemented (all 5 phases committed). Investigated a new runtime error reported on /dashboard/dog: 'Could not find the table public.dogs in the schema cache'. See new sections below."
---

# Research: Status of dog-profile-crud (S-01) as a prerequisite for the browse/swipe matching page (dashboard-page)

**Date**: 2026-09-26T15:05:00+02:00
**Researcher**: Copilot CLI
**Git Commit**: a87fa2ceb42e7a3a41d25d00fedf7cc32b1a4797
**Branch**: develop
**Repository**: grachol0123/doggo-date

## Research Question

Another agent is implementing `dog-profile-crud` (roadmap S-01) in parallel. Before resuming planning for `dashboard-page` (the Tinder-style browse/swipe/match page, i.e. roadmap S-02 "browse-and-match"), what is the current implementation status of S-01, and what already exists in the codebase that S-02 would build on?

## Summary

> **Superseded, see "Follow-up (2026-09-26 18:14 CEST)" below**: as of the follow-up pass, S-01 is fully implemented (`status: impl_reviewed`, all 5 phases committed). The snapshot immediately below reflects the state at 15:05 CEST and is kept for history.

`dog-profile-crud` (S-01) is **not yet done** — its `change.md` status is `implementing`, and per its own `plan.md` Progress section only Phase 1 of 5 is committed (`a87fa2c`). Phase 2 (the save API route) has code written but is uncommitted/unverified in the working tree, and no dog profile *page* or *form* exists yet, so there is still no way for an owner to actually create a dog through the UI (`context/changes/dog-profile-crud/plan.md:279-296`). Consequently there is no route yet to populate the `dogs` table with real profiles, which `dashboard-page` needs to browse. The `dogs` data model itself (table, RLS, storage bucket) is fully in place and stable (F-01, done). No likes/matches schema, swipe-gesture library, or hamburger/side-menu UI pattern exists anywhere in the repo yet — `dashboard-page` would be greenfield for all of those.

## Detailed Findings

### dog-profile-crud (S-01) implementation status

- `context/changes/dog-profile-crud/change.md:4` — `status: implementing` (not `done`).
- `context/changes/dog-profile-crud/plan.md:279-296` (Progress, Phase 1) — all 3 automated checks are checked off with commit `a87fa2c` ("validation foundations and missing UI primitives"): zod dependency, shadcn/ui primitives, `dog-enums.ts`, `dogProfileSchema`.
- `context/changes/dog-profile-crud/plan.md:298-311` (Progress, Phase 2) — the 3 automated checks (lint/build pass, `save.ts` exports `POST`) are checked off *without* a commit sha, and all 4 manual-verification items (create/edit/photo-replace/invalid-input behavior) are still unchecked `- [ ]`.
- `context/changes/dog-profile-crud/plan.md:313-334` (Progress, Phases 3-4) — every item for the protected page (`/dashboard/dog`), the `PROTECTED_ROUTES` update, the dashboard link, and the `DogProfileForm.tsx` component is unchecked `- [ ]`.
- `context/changes/dog-profile-crud/plan.md:336-346` (Progress, Phase 5) — final lint/build/full-flow/smoke verification is unchecked.
- `git log --oneline -15` (repo root, this inspected history only) — the newest commit is `a87fa2c feat(dog-profile-crud): validation foundations and missing UI primitives (p1)`; no later commit for this change exists yet.
- `git status --short` (working tree at time of this research) — staged-but-uncommitted changes include `A  src/pages/api/dogs/save.ts` and `M  src/lib/supabase.ts` and `M  context/changes/dog-profile-crud/plan.md`, consistent with Phase 2 being in progress right now, not finished.
- No file matches `src/pages/dashboard/**/*` (glob run against the repo) — the planned `src/pages/dashboard/dog.astro` page (Phase 3) does not exist yet.
- No file matches `src/components/dog/**/*` in the repo listing — `DogProfileForm.tsx` (Phase 4) does not exist yet.

**Conclusion for this question**: an owner cannot yet create or edit a dog profile through the app UI. There is exactly one committed phase (of 5) for S-01; the API route exists in the working tree but its own plan still marks all manual verification as unverified, and the page/form that would let anyone use it are unbuilt. `dashboard-page` (S-02) cannot be meaningfully implemented or manually tested until at least a working create-profile path exists, since it needs real `dogs` rows other than the current viewer's own to browse.

### What already exists that S-02 (dashboard-page) can build on

- `supabase/migrations/20260925231055_create_dogs_table.sql:1-63` — `dogs` table (name, age_years, description, photo_path, breed, temperament, activity_level, interests), CHECK constraints, RLS policies scoped to `owner_id = auth.uid()` for insert/update/delete, and a `for select ... using (true)` policy for any authenticated user (`dogs_select_authenticated`) — i.e. **any authenticated user can already `select` all dogs, not just their own**, which is the read access `dashboard-page` will need for browsing.
- `src/types.ts:33-83` — generated `Dog` row/insert/update types and `dog_activity_level` / `dog_interest` enum literals + `Constants.public.Enums` runtime arrays.
- `src/lib/dog-enums.ts` (added in S-01 Phase 1, per its plan) — Polish label maps for the two enums, explicitly built so S-02 can reuse them later.
- `src/middleware.ts:4-6` — `PROTECTED_ROUTES = ["/dashboard"]`, matched via `startsWith`, so any future `/dashboard/...` route (including a browse/swipe page) is already covered without further edits, unless a different top-level path is chosen.
- `src/pages/dashboard.astro:1-27` — the only existing protected page; plain Astro, no React island, a sign-out form, no navigation/menu beyond a static heading.
- `src/components/Topbar.astro` — an existing top bar showing the signed-in email + links to `/dashboard` and sign-out, but it is **not included from any page** (not referenced by `dashboard.astro` or `Layout.astro`) and is not a hamburger/slide-out menu.
- No table for likes/passes/matches exists in `supabase/migrations/*.sql` (only `create_dogs_table.sql` and `create_dog_photos_bucket.sql`) — the data model for swipe actions and matching is entirely new work for `dashboard-page`.
- No swipe-gesture or drag library (e.g. `framer-motion`, `react-tinder-card`) is listed in `package.json` dependencies — any pointer/touch gesture handling would be built from scratch or require a new dependency.
- No hamburger/side-menu or drawer component exists under `src/components/` (only `Banner.astro`, `Topbar.astro`, `Welcome.astro`, `auth/*`, `ui/button.tsx`) — the "hamburger button + side menu on every authenticated page" requirement has no existing pattern to reuse.

## Code References

- `context/changes/dog-profile-crud/change.md:4` - status field showing `implementing`
- `context/changes/dog-profile-crud/plan.md:279-346` - full Progress section with per-phase checkbox state
- `supabase/migrations/20260925231055_create_dogs_table.sql:1-63` - `dogs` table schema and RLS policies, including the broad authenticated-select policy
- `src/types.ts:33-83` - generated `Dog` type and enum constants
- `src/middleware.ts:1-24` - `PROTECTED_ROUTES` and auth-gate logic
- `src/pages/dashboard.astro:1-27` - only existing protected page (reference pattern)
- `src/components/Topbar.astro:1-27` - existing but currently unused top bar component
- `src/pages/api/dogs/save.ts:1-190` (working tree, uncommitted) - in-progress S-01 API route

## Architecture Insights

- The repo's established backend convention for form submissions is `formData` → Supabase call → `context.redirect` with `?error=<message>` on failure (established by `src/pages/api/auth/signup.ts`, being followed again by the in-progress `src/pages/api/dogs/save.ts`). Any browse/swipe API (like/pass action) would need a *different* pattern if it should feel instantaneous (NFR: next profile loads in <1s), since a full-page redirect per swipe would not meet that bar — this is a live architectural decision for `dashboard-page`'s plan, not yet precedented anywhere in the repo.
- RLS already grants every authenticated user read access to all `dogs` rows (`dogs_select_authenticated`), so no RLS migration is strictly required just to *read* candidate profiles for swiping — but a new table (likes/passes and/or matches) with its own RLS will be needed to record swipe actions and derive matches, per PRD FR-004/FR-005.

## Historical Context (from prior changes)

- `context/archive/2026-09-25-dog-profile-data-foundation/plan.md` (F-01, done) - defined the `dogs` schema, RLS, and storage bucket that both S-01 and S-02 depend on; confirms the single-photo, one-dog-per-owner design that `dashboard-page` must browse against.
- `context/changes/dog-profile-crud/research.md` - S-01's own research already flagged the same gaps this document confirms are still open (no zod at the time, no UI primitives, no page/API); Phase 1 of that plan has since closed those specific gaps.

## Related Research

- `context/changes/dog-profile-crud/research.md` - prior research for the direct prerequisite of this change.

## Follow-up (2026-09-26 18:14 CEST): S-01 completion + new runtime error

### Research Question (follow-up)

1. Has `dog-profile-crud` (S-01) progressed since the snapshot above?
2. The user reported (screenshot) `/dashboard/dog` showing "Nie udało się wczytać profilu psa: Could not find the table 'public.dogs' in the schema cache" — what causes this, and is it still happening?

### Summary (follow-up)

S-01 is now **fully implemented**: `context/changes/dog-profile-crud/change.md:4` shows `status: impl_reviewed`, and `git log` (this inspected history) shows all remaining phases committed after the Phase-1-only snapshot above — `bc699c2` (Phase 2, API route), `c791714` (Phase 3-4, page + form), `3d0b9ee` (Phase 5, final verification), `6d6c027` (epilogue), and `a808c7c` (a post-close validation fix). `src/pages/dashboard/dog.astro` now exists (it did not at the time of the first pass of this research).

The reported PostgREST error ("Could not find the table 'public.dogs' in the schema cache") is a known Supabase/PostgREST symptom meaning the REST layer's cached schema didn't yet include the `dogs` table/relationship at request time — **not** that the table or its migration is missing. Direct evidence gathered just now:

- `.dev.vars:1-2` (local secrets file, not committed) points the app at the **remote** hosted project `https://wogwfkeuyfdxsuvacpqj.supabase.co`, not the local `supabase start` instance.
- `npx supabase migration list` (run against this same remote project) shows both existing migrations (`20260925231055`, `20260925233126`) present on **both** Local and Remote — i.e. the `dogs` table migration is applied on the remote project the app actually talks to.
- A direct REST call executed during this research, `GET https://wogwfkeuyfdxsuvacpqj.supabase.co/rest/v1/dogs?select=id&limit=1` with the `.dev.vars` publishable key, returned **HTTP 200** with body `[]` — i.e. right now, at this moment, the remote project's PostgREST schema cache does include `public.dogs` and returns zero rows successfully.

**Conclusion**: the error in the screenshot was very likely a **transient PostgREST schema-cache staleness** window on the remote hosted Supabase project (a well-documented behavior: a hosted project's REST layer can briefly serve a stale cached schema — most commonly right after the project wakes from auto-pause/cold-start, or briefly after a schema-affecting change — until it refreshes, typically within seconds to a couple of minutes). It is not reproducible right now against the same table/project/key. This inference is based on the observed 200 response above; this research did not have access to Supabase project logs/dashboard history to directly confirm a pause/cold-start event, so the exact trigger (cold start vs. cache-refresh lag) remains unconfirmed.

### Code References (follow-up)

- `context/changes/dog-profile-crud/change.md:4` - `status: impl_reviewed`
- `git log --oneline` (this inspected history) - `a808c7c`, `6d6c027`, `3d0b9ee`, `c791714`, `bc699c2`, `a87fa2c` for `dog-profile-crud`
- `src/pages/dashboard/dog.astro` - now exists (glob confirmed; absent in the first pass of this research)
- `.dev.vars:1-2` - `SUPABASE_URL`/`SUPABASE_KEY` pointing at the remote project used by the local dev server
- Remote REST probe (this session, 2026-09-26 ~18:14 CEST): `GET /rest/v1/dogs?select=id&limit=1` → `200 []`

### Open Questions (updated)

- Whether the schema-cache error recurs (e.g. after further remote migrations, or after the hosted project's next cold-start) is not something this research can rule out — if it recurs, check Supabase project dashboard → Settings → API → "reload schema cache", or run `select pg_notify('pgrst', 'reload schema');` against the remote DB, and check whether the project is on a plan/tier that auto-pauses on inactivity.
- No fixed timeline is recorded anywhere in the repo for when S-01 Phases 2-5 would land; that gap from the first pass is now resolved (all phases are committed), so this line is kept only as a historical note, not an open item.
