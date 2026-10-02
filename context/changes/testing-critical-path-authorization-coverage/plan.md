# Critical-Path Authorization Coverage Implementation Plan

## Overview

Add integration test coverage proving that (1) no `dogs`/`swipes`/`matches` API
surface returns data to an unauthenticated caller or lets an authenticated
owner mutate another owner's row — proven at the HTTP layer, not just the
hidden UI — and (2) `dog-photos` storage paths stay non-guessable and
write/update/delete stay owner-scoped — proven at the RLS layer. This is
rollout Phase 1 of `context/foundation/test-plan.md` (risks #1 and #5).

## Current State Analysis

- Three API routes touch this data today: `POST /api/swipes`, `POST`
  (form-post) `dogs/save`, `GET /api/dogs/next-candidate`. No `matches` or
  `messages` route exists yet — `matches` is only ever written by a
  `security definer` DB trigger.
- `src/middleware.ts` only redirects unauthenticated *page* requests under
  `/dashboard`; none of the three API paths are protected there, so each
  route's own `if (!user)` check is the only authentication gate — and it is
  inconsistent: `swipes`/`next-candidate` return 401 JSON, `dogs/save`
  redirects to `/auth/signin`.
- `dogs` SELECT is intentionally open to any authenticated user (browse
  feature, `using (true)`) — this is desired behavior, not a gap. The
  untested boundary is mutation: `dogs` UPDATE/DELETE cross-owner attempts,
  the entire `swipes`/`matches` RLS surface, and storage UPDATE/DELETE
  cross-owner attempts have no test today.
- No app-level/API test runner exists in `package.json`. The project already
  has a working, zero-dependency pattern for this exact kind of test:
  `scripts/smoke.mjs` (fetch + manual cookie jar, run against a locally
  built preview server backed by a local Supabase instance, wired into
  `.github/workflows/ci.yml`'s `smoke` job).
- `supabase/migrations/20260926164458_seed_test_dog_profiles.sql` seeds 20
  demo accounts/dogs for manual UI QA — not intended as automated-test
  fixtures and not reused here; a dedicated, smaller fixture set is added
  instead.

### Key Discoveries:

- `src/pages/api/dogs/save.ts:154-157` redirects (not 401 JSON) when
  unauthenticated — a real, accepted behavior difference from the other two
  routes (decision: test as-is, do not normalize in this phase).
- `src/pages/api/swipes/index.ts` and `src/pages/api/dogs/next-candidate.ts`
  never accept a caller-supplied "act as this dog" identifier — "my dog" is
  always resolved server-side from `owner_id = user.id`. There is no
  forgeable ownership parameter for these two routes today, so the
  HTTP-level ownership proof is: an authenticated caller's mutation only
  ever touches their own row (verified by reading the *other* owner's
  unaffected state afterwards), not "a forged ID is rejected."
- Postgres RLS `UPDATE`/`DELETE` policies using only `USING` (no `WITH
  CHECK`) do not raise an error for a cross-owner attempt — the
  non-matching row is silently excluded from the affected set (0 rows
  changed). Only `INSERT` (and any `WITH CHECK` failure) raises `42501`.
  This applies to `dogs_update_own`, `dogs_delete_own`,
  `dog_photos_owner_update`, `dog_photos_owner_delete`. New pgTAP
  assertions for these must check row-count/unchanged-state, not
  `throws_ok`.
- `context/foundation/lessons.md`: do not add lodash or other unnecessary
  dependencies — reinforces reusing the zero-dependency `smoke.mjs` pattern
  over introducing a new test framework.

## Desired End State

Running `npx supabase test db` locally exercises new/extended pgTAP
assertions for `dogs` (UPDATE/DELETE cross-owner), `swipes`, `matches`, and
`dog-photos` storage (UPDATE/DELETE cross-owner) — all passing. Running
`npm run test:authz` against a local Supabase + preview server exercises the
three existing API routes for unauthenticated access and cross-owner
mutation scoping — all passing. CI's `smoke` job runs `test:authz`
alongside the existing `smoke` script and stays green.

### Key Discoveries:

- `supabase/tests/database/dogs_rls.test.sql:105-153` and
  `supabase/tests/database/dog_photos_storage_rls.test.sql:33-64` — existing
  patterns to extend (self-contained fixtures created and rolled back
  inside the test transaction).
- `scripts/smoke.mjs` — pattern to extend for the new API-level script
  (fetch, manual `Set-Cookie` jar, `redirect: "manual"`, step list with
  expected status/location, non-zero exit on failure).
- `.github/workflows/ci.yml` `smoke` job — already starts local Supabase,
  builds, and runs a preview server; the new script's CI step slots in
  right after the existing `Run smoke test` step, before `Stop local
  Supabase`.

## What We're NOT Doing

- Not building `matches`/`messages` API routes or their authorization tests
  — they don't exist yet in this repository; deferred to whichever rollout
  phase introduces them (test-plan risk #4 covers messages).
- Not introducing Playwright, vitest, or any other test framework — the
  API-level test extends the existing zero-dependency `smoke.mjs` pattern.
- Not normalizing `dogs/save.ts`'s redirect-instead-of-401 behavior — tested
  as current, accepted behavior.
- Not adding `anon`-role (fully unauthenticated Postgres role) pgTAP
  assertions beyond what the app-layer HTTP tests already cover —
  unauthenticated coverage is proven at the HTTP layer (Phase 3); explicit
  DB-role-level anon assertions were declined as out of scope for this
  phase.
- Not wiring `npx supabase test db` (pgTAP) into CI — that is explicitly
  rollout Phase 4 ("Quality-gates wiring") in `context/foundation/test-plan.md`.
  This phase only adds the pgTAP test *files*, runnable locally.
- Not reusing the `gen1..gen20@doggo-date.test` demo-seed accounts for
  automated tests — a separate, dedicated fixture migration is added
  instead to avoid coupling automated tests to manual-QA seed data.

## Implementation Approach

Split by test layer, in dependency order: (1) create the dedicated fixture
accounts the HTTP-level script needs, (2) extend/add pgTAP files for the
DB/RLS layer (independent of the fixtures — pgTAP keeps its existing
self-contained-transaction convention), (3) write the HTTP-level script
against the new fixtures and wire it into CI, (4) close the loop by updating
the test-plan cookbook so future phases and readers find these patterns.

## Phase 1: Authz test fixtures

### Overview

Add a dedicated migration seeding two known test accounts (owner A, owner
B), each with one dog, exclusively for the Phase 3 HTTP-level script. Kept
separate from the existing `gen1..gen20` demo-QA seed.

### Changes Required:

#### 1. New fixture migration

**File**: `supabase/migrations/20260929120000_seed_authz_test_fixtures.sql`

**Intent**: Provide two persistent, known-credential accounts + dogs that
the Phase 3 script can sign in as without a signup/email-confirm round trip,
following the same `auth.users`/`auth.identities` insert shape as
`20260926164458_seed_test_dog_profiles.sql`.

**Contract**:
- Two `auth.users` rows with deterministic UUIDs
  `77777777-7777-4777-8777-777777777777` (owner A) and
  `88888888-8888-4888-8888-888888888888` (owner B), emails
  `authz-owner-a@doggo-date.test` / `authz-owner-b@doggo-date.test`,
  password `AuthzTestPassw0rd!` (bcrypt via `extensions.crypt`), email
  already confirmed (`email_confirmed_at = now()`).
- Matching `auth.identities` rows (required for `@supabase/ssr` password
  sign-in to resolve correctly, matching the existing seed migration's
  shape).
- One `public.dogs` row per account (distinct `name`/`description` values,
  e.g. `Authz Owner A Dog` / `Authz Owner B Dog`) so Phase 3 can assert
  each owner's row is independently readable/mutable and the other's is
  not touched.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` (or `npx supabase
  start` on a fresh volume) completes without error
- Existing pgTAP suite still passes unaffected: `npx supabase test db`

#### Manual Verification:

- Review the migration's account/dog shape against what Phase 3's script
  expects (emails, password, dog names) before Phase 3 starts

---

## Phase 2: pgTAP RLS coverage

### Overview

Close the RLS test gaps identified in research: `dogs` UPDATE/DELETE
cross-owner, the entire `swipes`/`matches` surface, and storage
UPDATE/DELETE cross-owner.

## Critical Implementation Details

**RLS UPDATE/DELETE assertions don't throw.** Unlike the existing
`throws_ok(..., '42501', ...)` pattern used for INSERT violations, a
cross-owner UPDATE/DELETE against a `USING`-only policy silently affects 0
rows — assert via `results_eq`/row-count (e.g., re-select the row and prove
it is unchanged, or assert the update/delete statement's `returning`
clause is empty), not `throws_ok`.

### Changes Required:

#### 1. `dogs` cross-owner UPDATE/DELETE

**File**: `supabase/tests/database/dogs_rls.test.sql`

**Intent**: Prove an authenticated non-owner cannot mutate another owner's
`dogs` row, closing the gap next to the existing insert-cross-owner
assertion.

**Contract**: Bump `plan(8)` to `plan(10)`. Add, using the file's existing
two fixture users: (a) owner B attempts `update public.dogs set name =
'Hijacked' where owner_id = <owner A>` — assert 0 rows affected / owner A's
row unchanged; (b) owner B attempts `delete from public.dogs where owner_id
= <owner A>` — assert 0 rows affected / owner A's row still exists.

#### 2. `swipes` RLS coverage (new file)

**File**: `supabase/tests/database/swipes_rls.test.sql`

**Intent**: Prove `swipes` SELECT/INSERT are scoped to the caller's own
dog, following the same fixture-in-transaction pattern as `dogs_rls.test.sql`.

**Contract**: `plan(4)`. Create two fixture users + one dog each (new
deterministic UUIDs distinct from other test files). Assert: (a) owner A
can select a swipe row where `actor_dog_id` is A's dog (`lives_ok`/
`results_eq`); (b) owner B selecting the same row gets an empty result
(RLS-filtered, not an error); (c) owner A can insert a swipe with
`actor_dog_id` = A's own dog (`lives_ok`); (d) owner B attempts to insert a
swipe with `actor_dog_id` = A's dog (impersonation) — `throws_ok` `42501`.

#### 3. `matches` RLS coverage (new file)

**File**: `supabase/tests/database/matches_rls.test.sql`

**Intent**: Prove `matches` SELECT is scoped to participants only, and that
no authenticated role can insert/update/delete a match directly (the only
writer is the `security definer` trigger).

**Contract**: `plan(4)` (or `plan(3)` if setup doesn't need its own
assertion — implementer's call). Set up two dogs owned by two fixture
users and drive a mutual like (two `swipes` inserts) so the trigger creates
a `matches` row, or insert test data as the migration-owning role to avoid
duplicating swipe-trigger mechanics. Assert: (a) a participant can select
the match; (b) a third fixture user who is not a participant selects it and
gets an empty result; (c) an authenticated participant attempting a direct
`insert into public.matches (...)` (bypassing the trigger) — `throws_ok`
`42501`.

#### 4. Storage cross-owner UPDATE/DELETE

**File**: `supabase/tests/database/dog_photos_storage_rls.test.sql`

**Intent**: Close the gap next to the existing cross-owner INSERT
assertion — `dog_photos_owner_update`/`dog_photos_owner_delete` policies
exist but are untested.

**Contract**: Bump `plan(2)` to `plan(4)`. Using the file's existing two
fixture users and the object inserted by owner A: (a) owner B attempts
`update storage.objects set ... where name = <owner A's object>` — assert 0
rows affected / object unchanged; (b) owner B attempts `delete from
storage.objects where name = <owner A's object>` — assert 0 rows affected /
object still exists.

### Success Criteria:

#### Automated Verification:

- All pgTAP suites pass: `npx supabase test db`

#### Manual Verification:

- Manually confirm each new assertion's expected outcome (silent 0-row
  filter vs. thrown error) matches the policy type it targets, per the
  Critical Implementation Details note above

---

## Phase 3: API-level authorization script + CI wiring

### Overview

Prove the app-layer authorization gap named in risk #1 ("not just hidden
UI") by hitting the three existing API routes directly over HTTP, using the
Phase 1 fixture accounts.

### Changes Required:

#### 1. New authz test script

**File**: `scripts/authz-test.mjs`

**Intent**: Zero-dependency script following `scripts/smoke.mjs`'s
fetch/cookie-jar/step-list pattern, run against a locally built preview
server backed by local Supabase (never production).

**Contract**: Uses the Phase 1 fixture credentials
(`authz-owner-a@doggo-date.test` / `authz-owner-b@doggo-date.test` /
`AuthzTestPassw0rd!`). Step list (each an independent cookie jar unless
noted):
- Unauthenticated `GET /api/dogs/next-candidate` → `401`,
  `{status:"unauthenticated"}`.
- Unauthenticated `POST /api/swipes` → `401`, `{status:"unauthenticated"}`.
- Unauthenticated `POST` to the `dogs/save` endpoint → `302` to
  `/auth/signin` (current, accepted behavior — not a bug per the
  `dogs_save_auth: test-as-is` decision).
- Signed in as owner A: `GET /api/dogs/next-candidate` never returns a dog
  whose id equals A's own dog id (regression guard on the existing
  `neq("owner_id", user.id)` filter).
- Signed in as owner A: `POST` to `dogs/save` updates A's own dog
  (`description` or `name` changed) and redirects to
  `/dashboard/dog?saved=1`.
- Separately signed in as owner B (fresh cookie jar): `GET /dashboard/dog`
  renders B's original, untouched dog data — proving A's save above did not
  affect B's row (ownership-scoping proof; there is no forgeable
  owner/dog-id parameter on `dogs/save` to attempt a direct cross-owner
  write, so this after-the-fact state check is the correct HTTP-level
  proof per the research finding).
- Exit non-zero on any step failure, matching `smoke.mjs`'s reporting
  format.

#### 2. Wire into `package.json`

**File**: `package.json`

**Intent**: Make the script runnable the same way `smoke` is.

**Contract**: Add `"test:authz": "node scripts/authz-test.mjs"` next to the
existing `"smoke"` script entry.

#### 3. Wire into CI

**File**: `.github/workflows/ci.yml`

**Intent**: Run the new script in the existing `smoke` job, right after the
existing smoke test step, reusing the same already-running local Supabase +
preview server (no new job, no new Supabase/preview startup).

**Contract**: Add a `Run authz test` step after `Run smoke test` and before
`Stop local Supabase`, with `env: BASE_URL: http://localhost:4321` and
`run: npm run test:authz` — same shape as the existing `Run smoke test`
step.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- New script passes locally against a running local Supabase + preview
  server: `BASE_URL=http://localhost:4321 npm run test:authz`
- CI `smoke` job passes with the new step included (verified once merged/
  pushed)

#### Manual Verification:

- Manually review the CI workflow diff for correct step ordering and env
  var usage
- Manually run through one authenticated flow in a browser to sanity-check
  the script's HTTP-level assertions match real UI behavior

**Implementation Note**: After completing this phase and all automated
verification passes, pause here for manual confirmation from the human that
the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Update test-plan cookbook

### Overview

Close the loop on `context/foundation/test-plan.md` §6 per the rollout
orchestrator's contract — each shipped phase fills in its cookbook
sub-section so future readers/phases don't re-derive these patterns.

### Changes Required:

#### 1. Cookbook entries

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `TBD — see §3 Phase 1` placeholders in §6.2 and
§6.4 with the concrete patterns this phase established.

**Contract**: §6.2 ("Adding an integration test (DB/RLS)") — add a note
that cross-owner UPDATE/DELETE assertions use row-count/unchanged-state
checks, not `throws_ok` (link the new `swipes_rls.test.sql` /
`matches_rls.test.sql` as additional reference tests alongside
`dogs_rls.test.sql`). §6.4 ("Adding a test for a new API endpoint") — add
the `scripts/authz-test.mjs` location, naming, and "add a step to the
`smoke` CI job" pattern as the reference for future API-endpoint
authorization tests. Do not otherwise edit §1–§5 (frozen strategy) or §3's
Status column — the rollout orchestrator (`/10x-test-plan`) owns that
transition.

### Success Criteria:

#### Automated Verification:

- File remains valid Markdown (no broken table/heading structure) — visual
  diff review is sufficient; no automated linter targets this file

#### Manual Verification:

- Confirm §6.2/§6.4 entries reference the actual files/paths created in
  Phases 1-3

---

## Testing Strategy

### Unit Tests:

- None added — no app-level unit test runner exists and this phase's scope
  is integration-level per `context/foundation/test-plan.md` §2.

### Integration Tests:

- pgTAP: `dogs` UPDATE/DELETE cross-owner, `swipes` select/insert scoping,
  `matches` select scoping + direct-insert block, storage UPDATE/DELETE
  cross-owner (Phase 2).
- HTTP-level: unauthenticated access blocked, authenticated mutation stays
  owner-scoped, across the three existing API routes (Phase 3).

### Manual Testing Steps:

1. Run `npx supabase test db` locally and confirm all new/extended
   assertions pass.
2. Run `npm run build && npm run preview -- --port 4321` plus `BASE_URL=
   http://localhost:4321 npm run test:authz` locally and confirm all steps
   pass.
3. Push/open a PR and confirm the CI `smoke` job's new step is green.

## Migration Notes

`supabase/migrations/20260929120000_seed_authz_test_fixtures.sql` is
additive only (new accounts/dogs) — no existing migration or data is
altered. It runs automatically on `supabase start`/`supabase db reset`,
same as every other migration; no manual migration step is required.

## References

- Related research: `context/changes/testing-critical-path-authorization-coverage/research.md`
- Existing RLS test pattern: `supabase/tests/database/dogs_rls.test.sql:105-153`
- Existing storage RLS test pattern: `supabase/tests/database/dog_photos_storage_rls.test.sql:33-64`
- Existing HTTP-level test pattern: `scripts/smoke.mjs`
- Existing CI smoke job: `.github/workflows/ci.yml`
- Existing demo-seed migration (pattern reference, not reused as fixtures): `supabase/migrations/20260926164458_seed_test_dog_profiles.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Authz test fixtures

#### Automated

- [x] 1.1 Migration applies cleanly (`npx supabase db reset`) — 01721dc
- [x] 1.2 Existing pgTAP suite still passes (`npx supabase test db`) — 01721dc

#### Manual

- [x] 1.3 Review fixture account/dog shape against Phase 3 script expectations

### Phase 2: pgTAP RLS coverage

#### Automated

- [x] 2.1 All pgTAP suites pass (`npx supabase test db`) — eacf1de

#### Manual

- [x] 2.2 Confirm each new assertion's expected outcome (silent filter vs. thrown error) matches its policy type — eacf1de

### Phase 3: API-level authorization script + CI wiring

#### Automated

- [x] 3.1 Lint passes (`npm run lint`) — 294f8d5
- [x] 3.2 Build succeeds (`npm run build`) — 294f8d5
- [x] 3.3 New script passes locally (`npm run test:authz`) — 294f8d5
- [x] 3.4 CI `smoke` job passes with the new step included — 294f8d5

#### Manual

- [x] 3.5 Review CI workflow diff for correct step ordering and env var usage — 294f8d5
- [x] 3.6 Manually sanity-check one authenticated flow in a browser against the script's assertions — 294f8d5

### Phase 4: Update test-plan cookbook

#### Automated

- [x] 4.1 File remains valid Markdown (visual diff review) — 23e61fa

#### Manual

- [x] 4.2 Confirm §6.2/§6.4 entries reference the actual files/paths created in Phases 1-3 — 23e61fa
