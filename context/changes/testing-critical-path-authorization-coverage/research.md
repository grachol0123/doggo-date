---
date: 2026-09-29T19:00:37+02:00
researcher: Copilot CLI
git_commit: 64e9da45a00c0bcb18dd2dad8e4928a30dac0d5c
branch: develop
repository: grachol0123/doggo-date
topic: "Rollout Phase 1 — critical-path authorization coverage (risks #1, #5)"
tags: [research, codebase, auth, rls, storage, dogs, swipes, matches]
status: complete
last_updated: 2026-09-29
last_updated_by: Copilot CLI
---

# Research: Rollout Phase 1 — critical-path authorization coverage (risks #1, #5)

**Date**: 2026-09-29T19:00:37+02:00
**Researcher**: Copilot CLI
**Git Commit**: 64e9da45a00c0bcb18dd2dad8e4928a30dac0d5c
**Branch**: develop
**Repository**: grachol0123/doggo-date

## Research Question

For rollout Phase 1 of `context/foundation/test-plan.md` ("Critical-path
authorization coverage", risks #1 and #5): what are the current API entry
points, RLS policies, auth/session shape, and photo-storage path convention
for `dogs`/`swipes`/`matches`, and what test coverage already exists vs. is
missing, so `/10x-plan` can design integration tests proving (a) unauthenticated
requests never return data and cross-owner mutation is blocked, and (b) photo
storage paths stay non-sequential/non-guessable with owner-scoped writes?

## Summary

- Three API routes touch dog/swipe/match data today: `POST /api/swipes`
  ([src/pages/api/swipes/index.ts](../../../src/pages/api/swipes/index.ts)),
  `POST /dashboard/dog` save handler
  ([src/pages/api/dogs/save.ts](../../../src/pages/api/dogs/save.ts)), and
  `GET /api/dogs/next-candidate`
  ([src/pages/api/dogs/next-candidate.ts](../../../src/pages/api/dogs/next-candidate.ts)).
  There are no `matches` or `messages` API routes yet — `matches` rows are only
  ever created by a `security definer` DB trigger, and there is no
  "messages" table/route in this repository at this commit.
- All three routes check `context.locals.user` (set by
  [src/middleware.ts](../../../src/middleware.ts) from the Supabase session
  cookie) and return early on missing user: the two JSON API routes
  (`swipes`, `next-candidate`) return `{status:"unauthenticated"}` with HTTP
  401; the form-post route (`dogs/save`) redirects to `/auth/signin` instead
  of a 401 (src/pages/api/dogs/save.ts:154-157). This is a real branch
  divergence a Phase-1 test must cover explicitly for `dogs/save`, since
  "expect 401" would be the wrong assertion for that one endpoint.
- `src/middleware.ts` only redirects unauthenticated *page* requests whose
  path starts with `/dashboard` or `/dashboard/dog` (src/middleware.ts:4).
  None of the three API paths (`/api/swipes`, `/api/dogs/save`,
  `/api/dogs/next-candidate`) are in `PROTECTED_ROUTES`, so the middleware
  never blocks or redirects API calls — the 401/redirect behavior above is
  produced entirely by each route handler's own `if (!user)` check, not by
  the middleware. A test hitting the API directly (bypassing the UI) is
  therefore the correct way to prove risk #1's "not just hidden UI" clause.
- Ownership enforcement for `dogs` mutation is done by both RLS and (for
  `save.ts`) an explicit `owner_id = user.id` lookup before insert/update;
  `swipes`/`next-candidate` resolve "my dog" the same way and then rely on
  Postgres RLS to reject anything not owned. The Supabase server client used
  in every route ([src/lib/supabase.ts](../../../src/lib/supabase.ts)) is
  built with the publishable `SUPABASE_KEY` and the request's own session
  cookies (`createServerClient` from `@supabase/ssr`), not a service-role
  key — so RLS is genuinely in effect for every one of these calls, not
  bypassed at the app layer.
- `dogs_select_authenticated` is intentionally `using (true)` for any
  `authenticated` role (supabase/migrations/20260925231055_create_dogs_table.sql:48-52)
  — any authenticated user can read any other user's dog row. This is
  existing, tested-as-desired behavior for the browse feature (the pgTAP
  assertion at supabase/tests/database/dogs_rls.test.sql:145-153 is literally
  titled "Authenticated users can select another owner's dog profile" and
  is a `results_eq` positive assertion). Phase 1 must not treat broad SELECT
  as an IDOR bug; the risk boundary for `dogs` is mutation (insert/update/delete),
  which is already owner-scoped by `dogs_insert_own` / `dogs_update_own` /
  `dogs_delete_own` (same file, lines 54-72) and partially covered by
  existing pgTAP (insert-for-another-owner throws `42501` at
  supabase/tests/database/dogs_rls.test.sql:105-111). No pgTAP or API-level
  test currently exercises cross-owner UPDATE or DELETE on `dogs`, or an
  unauthenticated (anon-role) SELECT/mutation against `dogs`.
- `swipes` RLS restricts SELECT and INSERT to rows whose `actor_dog_id`
  belongs to a dog owned by `auth.uid()` (supabase/migrations/20260926200000_create_swipes_and_matches.sql:64-85).
  `matches` RLS restricts SELECT to participants only (same file, lines
  88-99) and has **no INSERT/UPDATE/DELETE policy at all** for the
  `matches` table — since RLS defaults to deny-by-absence, this means no
  authenticated-role client can insert/update/delete `matches` directly;
  the only writer is the `security definer` trigger `create_match_on_mutual_like`
  (same file, lines 24-52), which bypasses RLS by design. There is
  currently **no pgTAP file covering `swipes` or `matches` RLS** —
  `supabase/tests/database/` only has `dogs_rls.test.sql` and
  `dog_photos_storage_rls.test.sql`; a cross-owner SELECT/INSERT attempt on
  `swipes`, and a direct authenticated-role INSERT/UPDATE/DELETE attempt on
  `matches`, are both currently unverified by any test in the repo.
- Dog photo paths are generated in `src/pages/api/dogs/save.ts:170` as
  `${user.id}/${crypto.randomUUID()}.${photoExtension}` — the folder segment
  is the owner's UUID and the filename is a fresh random UUID per upload, so
  the path is non-sequential and not derivable from any counter; this
  matches the risk #5 "must challenge" bar (no sequential ID is ever used).
  Storage RLS scopes write/update/delete to `(storage.foldername(name))[1] =
  auth.uid()::text` (supabase/migrations/20260925233126_create_dog_photos_bucket.sql:16-38),
  and the bucket is `public: true` with a public-read policy with no owner
  check at all (same file, lines 1-13) — public read is the already-accepted
  MVP trade-off cited in `context/archive/2026-09-25-dog-profile-data-foundation/plan.md:44-47`
  ("do rewizji, jeśli wymaganie prywatności okaże się ściślejsze"), so Phase
  1 should not treat public-read as a bug to fix, only assert the path stays
  non-guessable and mutation stays owner-scoped.
- `supabase/tests/database/dog_photos_storage_rls.test.sql` currently only
  asserts INSERT behavior (`plan(2)`: own-prefix insert succeeds,
  cross-user-prefix insert throws `42501` — lines 33-64). It does **not**
  test cross-owner UPDATE or DELETE against `storage.objects`, even though
  `dog_photos_owner_update`/`dog_photos_owner_delete` policies exist
  (supabase/migrations/20260925233126_create_dog_photos_bucket.sql:25-38).
  `save.ts` itself performs storage `update`/`remove` calls on replace/rollback
  (src/pages/api/dogs/save.ts:186-224) using the requesting user's own
  session client, so these code paths depend on those untested policies
  holding for cross-owner attempts.
- No app-level/API integration test runner exists yet in this repo:
  `package.json` devDependencies contain only eslint/prettier/husky/supabase
  CLI tooling — no vitest, jest, playwright, or supertest-style HTTP test
  library (package.json:24-42). This confirms test-plan §4's "unit +
  integration (app/API): none yet" and "API mocking: none yet" rows; Phase 1
  planning must pick and introduce this tooling as part of its scope, not
  assume it exists.

## Detailed Findings

### API entry points (dogs / swipes / matches)

- `src/pages/api/swipes/index.ts` — `POST`, `prerender = false`. Body
  validated with zod (`targetDogId: z.uuid()`, `decision: "like"|"pass"`).
  Auth check at lines 32-34 (`if (!user) return jsonResponse({status:"unauthenticated"}, 401)`).
  Resolves the caller's own dog via `owner_id = user.id` (lines 55-59); if
  none, returns `{status:"no_own_dog"}` (200, not an error) rather than a
  4xx — a test asserting "no data returned" for an authenticated user
  without a dog should expect this shape, not an error status.
  Inserts into `swipes` with the caller's own dog id as `actor_dog_id`; RLS
  is the only thing stopping a forged `actor_dog_id` (there is no explicit
  ownership re-check of `targetDogId`, which is expected since browsing any
  dog is the intended behavior).
- `src/pages/api/dogs/save.ts` — `POST` (no `prerender = false` export
  present in this file, unlike the two JSON routes — confirmed by direct
  read, not inferred). Auth check at lines 154-157 redirects to
  `/auth/signin` rather than returning JSON/401. Looks up the existing dog
  row scoped to `owner_id = user.id` (lines 166-172) before deciding
  insert-vs-update, so it can only ever mutate the caller's own row.
  Builds the photo path as `${user.id}/${crypto.randomUUID()}.${ext}` (line
  170) only when a new photo file is present.
- `src/pages/api/dogs/next-candidate.ts` — `GET`, `prerender = false`. Auth
  check at lines 27-29 (401 `{status:"unauthenticated"}`). Resolves caller's
  own dog by `owner_id`, excludes dogs already swiped by that dog, then
  queries all other dogs (`neq("owner_id", user.id)`) — this broad read is
  intended browse behavior, not a leak, given `dogs_select_authenticated`.
- No route file exists for `matches` or `messages` under `src/pages/api/`
  at this commit (only `swipes/index.ts`, `dogs/save.ts`,
  `dogs/next-candidate.ts`, and the three `auth/*` routes were found by
  `src/pages/api/**/*.ts`). Any Phase-1 test scoped to "future
  matches/messages entry points" must therefore test the *RLS* layer only
  (there is no API surface yet to test at the HTTP layer for those two
  tables).

### Auth/session shape

- `src/middleware.ts` builds a Supabase SSR client per request and sets
  `context.locals.user` from `supabase.auth.getUser()`, defaulting to
  `null` if Supabase isn't configured or there's no session (lines 8-15).
  `PROTECTED_ROUTES = ["/dashboard", "/dashboard/dog"]` (line 4) — matched
  with `pathname.startsWith(...)`, page routes only.
- Because API routes are not in `PROTECTED_ROUTES`, `context.locals.user`
  is still populated correctly for API requests (the `getUser()` call always
  runs), but no redirect/401 is injected by the middleware itself for API
  paths — each handler is independently responsible, and they are
  independently consistent in checking `user` before touching data, but
  inconsistent in response shape (401 JSON vs. redirect), as noted above.
- `src/lib/supabase.ts` uses `createServerClient` from `@supabase/ssr` with
  cookie-based session propagation and the publishable `SUPABASE_KEY` env
  var (via `astro:env/server`) — not a service-role key — so every DB call
  made through this client in the app layer is subject to Postgres RLS.

### RLS policies — `dogs`, `swipes`, `matches`

Source: `supabase/migrations/20260925231055_create_dogs_table.sql`,
`supabase/migrations/20260926200000_create_swipes_and_matches.sql`.

| Table | Policy | Command | Rule |
|---|---|---|---|
| `dogs` | `dogs_select_authenticated` | SELECT | `to authenticated using (true)` — any authenticated user, any row (by design; browse) |
| `dogs` | `dogs_insert_own` | INSERT | `with check (auth.uid() = owner_id)` |
| `dogs` | `dogs_update_own` | UPDATE | `using/with check (auth.uid() = owner_id)` |
| `dogs` | `dogs_delete_own` | DELETE | `using (auth.uid() = owner_id)` |
| `swipes` | `swipes_select_own` | SELECT | requires a `dogs` row where `d.id = actor_dog_id and d.owner_id = auth.uid()` |
| `swipes` | `swipes_insert_own` | INSERT | same ownership check on `actor_dog_id` |
| `matches` | `matches_select_participant` | SELECT | requires `auth.uid()` to own `dog_a_id` or `dog_b_id` |
| `matches` | *(none)* | INSERT/UPDATE/DELETE | no policy exists → default-deny for `authenticated`/`anon`; only path is the `security definer` trigger |

No `anon`-role policy exists on any of these three tables, so unauthenticated
Postgres-role access is denied by RLS default; this is a DB-level guarantee
independent of the app-layer 401/redirect checks, and is itself untested by
any current pgTAP file (no anon-role assertions in `dogs_rls.test.sql`).

### Storage RLS and path convention — `dog-photos` bucket

Source: `supabase/migrations/20260925233126_create_dog_photos_bucket.sql`.

- Bucket `dog-photos` is `public: true`, 5MB limit, mime types
  `image/jpeg|png|webp` (lines 1-9).
- `dog_photos_public_read`: `using (bucket_id = 'dog-photos')` — no owner
  check, any request (including unauthenticated) can read any object if it
  knows the path (lines 11-14). Confirmed as an accepted, documented MVP
  trade-off in `context/archive/2026-09-25-dog-profile-data-foundation/plan.md:41-47`.
- `dog_photos_owner_write` / `_update` / `_delete`: all three require
  `(storage.foldername(name))[1] = auth.uid()::text` (lines 16-38) — i.e.
  the first path segment (folder) must equal the caller's own user id.
- Path convention in code: `src/pages/api/dogs/save.ts:170` —
  `${user.id}/${crypto.randomUUID()}.${photoExtension}`. The folder segment
  is the owner's UUID (matches the RLS folder check) and the filename is a
  fresh `crypto.randomUUID()` per upload — no counter, timestamp-as-id, or
  other guessable component is used anywhere in this file.

### Existing test coverage vs. gaps

| Area | Existing test | Gap for Phase 1 |
|---|---|---|
| `dogs` insert cross-owner | `dogs_rls.test.sql:105-111` (`throws_ok` 42501) | none — covered |
| `dogs` update/delete cross-owner | — | not covered — no pgTAP assertion for UPDATE/DELETE by a non-owner |
| `dogs` anon-role access | — | not covered — no unauthenticated-role assertion exists |
| `swipes` cross-owner select/insert | — | not covered — no pgTAP file for `swipes` at all |
| `matches` direct insert/update/delete attempt | — | not covered — no pgTAP file for `matches` at all |
| API-level auth check (`swipes`, `next-candidate`) | — | not covered — no HTTP-level test exists for any API route in this repo |
| API-level auth check (`dogs/save` redirect branch) | — | not covered, and behaviorally distinct (redirect, not 401) from the other two routes |
| Storage insert cross-owner | `dog_photos_storage_rls.test.sql:33-64` (`lives_ok` + `throws_ok` 42501) | none — covered |
| Storage update/delete cross-owner | — | not covered — policies exist (lines 25-38) but no assertion exercises them |
| Storage path non-sequential/non-guessable assertion | — | not directly asserted by any test; only inferable by reading `save.ts:170` |
| App-level test runner/HTTP client for API routes | — | does not exist in `package.json` — must be selected as part of Phase 1 scope |

## Code References

- `src/middleware.ts:4` - `PROTECTED_ROUTES` list (page-only, no API paths)
- `src/middleware.ts:8-15` - session resolution onto `context.locals.user`
- `src/lib/supabase.ts:6-20` - SSR client construction, publishable key + cookies (not service-role)
- `src/pages/api/swipes/index.ts:32-34` - 401 JSON on missing user
- `src/pages/api/swipes/index.ts:55-63` - own-dog resolution by `owner_id`
- `src/pages/api/dogs/save.ts:154-157` - redirect (not 401) on missing user
- `src/pages/api/dogs/save.ts:166-172` - own-row resolution before insert/update
- `src/pages/api/dogs/save.ts:170` - photo path generation `${user.id}/${crypto.randomUUID()}.${ext}`
- `src/pages/api/dogs/save.ts:186-224` - storage upload/rollback/cleanup on save error or photo replace
- `src/pages/api/dogs/next-candidate.ts:27-29` - 401 JSON on missing user
- `supabase/migrations/20260925231055_create_dogs_table.sql:48-72` - `dogs` RLS policies
- `supabase/migrations/20260925233126_create_dog_photos_bucket.sql:1-38` - bucket config + storage RLS policies
- `supabase/migrations/20260926200000_create_swipes_and_matches.sql:24-52` - `security definer` match-creation trigger
- `supabase/migrations/20260926200000_create_swipes_and_matches.sql:64-99` - `swipes`/`matches` RLS policies (note: no `matches` write policy)
- `supabase/tests/database/dogs_rls.test.sql:105-153` - existing cross-owner insert + broad-select assertions
- `supabase/tests/database/dog_photos_storage_rls.test.sql:33-64` - existing cross-owner storage insert assertions
- `package.json:24-42` - devDependencies (no app-level test runner present)

## Architecture Insights

- Authorization in this codebase is layered but not redundant everywhere:
  page-level protection is middleware-based (`PROTECTED_ROUTES`), API-level
  authentication is handler-local (`if (!user)`), and cross-owner mutation
  protection is Postgres RLS, not app-layer ownership checks (except
  `dogs/save.ts`, which pre-resolves the caller's own row before insert/update
  as a UX convenience, not as the security boundary — RLS is still what
  would reject a forged `owner_id`/`actor_dog_id` if the app-layer lookup
  were ever bypassed or wrong).
- The project's RLS convention for "public browse, owner-only mutate" tables
  (`dogs`) is a single broad `using (true)` SELECT policy plus per-command
  owner-scoped write policies — this is the pattern future `matches`/`messages`
  read scoping should be measured against, not a blanket "owner-only" SELECT
  assumption.
- `matches` is written exclusively through a `security definer` trigger
  with no direct-write policy for any client role — this is the load-bearing
  mechanism preventing a forged match row via direct insert; a Phase-1 test
  proving "an authenticated user cannot directly insert/update a match" is
  testing the *absence* of a policy, which pgTAP can assert as `throws_ok`
  with a permission-denied code the same way the existing `dogs` cross-owner
  test does.
- Storage path privacy relies entirely on `crypto.randomUUID()` being
  non-sequential/non-enumerable; there is no server-side re-check that a
  requested photo path "belongs" to the profile referencing it — the
  contract is folder-prefix ownership at write time, not path secrecy
  guarantees beyond entropy of the UUID itself.

## Historical Context (from prior changes)

- `context/archive/2026-09-25-dog-profile-data-foundation/plan.md:41-47` —
  documents the public-read bucket as a deliberate MVP trade-off ("plik
  pozostaje technicznie dostępny dla każdego, kto pozna URL poza aplikacją
  ... akceptowalne na MVP, do rewizji, jeśli wymaganie prywatności okaże
  się ściślejsze"). Supported: this sentence is still accurate at this
  commit — `dog_photos_public_read` still has no owner check
  (supabase/migrations/20260925233126_create_dog_photos_bucket.sql:11-14).
  This is the direct source for test-plan risk #5's framing that public-read
  itself is not the regression to test for — path-format/guessability is.
- `context/foundation/test-plan.md` §2 Risk Response Guidance rows for #1
  and #5 (as supplied in this change's Notes) match the current code
  structure: risk #1's "not just hidden UI" clause is confirmed necessary
  because middleware does not protect the API paths at all (see Auth/session
  shape above); risk #5's "path-generation convention in upload code" is
  confirmed to be `save.ts:170`.
- `context/archive/2026-09-26-dog-profile-crud/plan.md` — reviewed for
  related auth/CRUD decisions; contains no additional authorization-boundary
  decisions beyond what's already reflected in the current `dogs_rls.test.sql`
  and `save.ts` (not applicable beyond what's cited above).

## Related Research

- None found under `context/changes/**/research.md` or
  `context/archive/**/research.md` — this is the first research document
  scoped to authorization/RLS testing in this repository.

## Open Questions

- Which HTTP-level test tool/runner should Phase 1 introduce for API-route
  tests (`swipes`, `dogs/save`, `dogs/next-candidate`)? Test-plan §4 leaves
  this as "none yet" and Phase 1's own scope; this research only confirms
  no such tooling exists yet, it does not select one (product/tooling
  choice, not a research fact — `/10x-plan` should decide, informed by the
  "integration (pgTAP RLS + API-level ownership test)" guidance in test-plan
  §2 row #1).
- Should the `dogs/save.ts` unauthenticated-redirect-vs-401 inconsistency
  be normalized as part of this phase, or only asserted as current
  behavior? This is a product/implementation decision, not a research
  finding — flagged here so `/10x-plan` makes it explicitly rather than
  discovering it mid-implementation.
- No `messages` table/route exists yet in this repository at this commit,
  so risk #1's "message data" clause and the Notes' "message data" phrase
  currently have no code surface to test; Phase 1 test coverage for
  messages is necessarily deferred to whenever that table/route lands
  (tracked separately as test-plan §3 Phase 3, risk #4).
