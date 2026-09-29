# Critical-Path Authorization Coverage — Plan Brief

> Full plan: `context/changes/testing-critical-path-authorization-coverage/plan.md`
> Research: `context/changes/testing-critical-path-authorization-coverage/research.md`

## What & Why

Rollout Phase 1 of `context/foundation/test-plan.md`: prove that no
`dogs`/`swipes`/`matches` API surface leaks data to an unauthenticated
caller or lets one owner mutate another owner's row — even via a direct API
call, not just via hidden UI — and that `dog-photos` storage paths stay
non-guessable with owner-scoped write/update/delete.

## Starting Point

Three API routes exist today (`swipes`, `dogs/save`, `dogs/next-candidate`),
each independently checking `context.locals.user` (middleware only protects
UI pages, not API paths). RLS already scopes `dogs` mutation and storage
writes to the owner, but UPDATE/DELETE cross-owner and the entire
`swipes`/`matches` RLS surface have zero test coverage, and there is no
app-level test proving the API layer itself blocks unauthenticated access.

## Desired End State

`npx supabase test db` exercises full RLS coverage for `dogs`, `swipes`,
`matches`, and `dog-photos` storage. A new `npm run test:authz` script
proves the three API routes reject unauthenticated calls and keep mutation
owner-scoped, running locally and in CI's existing `smoke` job.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| API test tooling | Extend `scripts/smoke.mjs`'s zero-dependency fetch/cookie-jar pattern | Matches existing project convention; avoids adding a test framework dependency | Plan |
| Test fixtures | New dedicated migration (2 accounts + dogs), not the `gen1..20` demo seed | Keeps automated-test fixtures decoupled from manual-QA seed data | Plan |
| `dogs/save.ts` auth response | Test current redirect-not-401 behavior as-is | Not a bug to fix in this phase — scope stays test-only | Plan |
| pgTAP scope | Minimal: only what risks #1/#5 name (dogs UPDATE/DELETE, swipes, matches, storage UPDATE/DELETE) | No anon-role DB tests — unauthenticated coverage lives at the HTTP layer instead | Plan |
| CI wiring | Add `test:authz` step to the existing `smoke` job now | Reuses the job's already-running local Supabase + preview server; pgTAP-into-CI stays deferred to rollout Phase 4 | Plan |

## Scope

**In scope:**
- New pgTAP assertions: `dogs` UPDATE/DELETE cross-owner, new `swipes_rls.test.sql`, new `matches_rls.test.sql`, storage UPDATE/DELETE cross-owner
- New `scripts/authz-test.mjs` HTTP-level authorization test + `npm run test:authz`
- New dedicated fixture migration for the two script accounts
- CI step wiring `test:authz` into the existing `smoke` job
- `context/foundation/test-plan.md` §6.2/§6.4 cookbook updates

**Out of scope:**
- `matches`/`messages` API routes (don't exist yet)
- Playwright/vitest or any new test framework
- Normalizing `dogs/save.ts`'s redirect-vs-401 inconsistency
- `anon`-role pgTAP assertions
- Wiring `npx supabase test db` into CI (rollout Phase 4)
- Reusing `gen1..gen20@doggo-date.test` demo-seed accounts for automated tests

## Architecture / Approach

Two independent test layers: pgTAP for DB/RLS-level ownership proofs
(self-contained transactions, existing convention), and a new
zero-dependency HTTP script for API-level auth/ownership proofs (extends
the existing `smoke.mjs` pattern, using dedicated fixture accounts seeded by
a new migration). Both run locally; the HTTP script also runs in CI
alongside the existing smoke test.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Authz test fixtures | Dedicated migration: 2 accounts + dogs for HTTP-level tests | Migration shape must match what Phase 3's script expects |
| 2. pgTAP RLS coverage | Extended/new pgTAP files closing all named RLS gaps | UPDATE/DELETE RLS violations don't throw — must assert row-count, not errors |
| 3. API-level authz script + CI wiring | `scripts/authz-test.mjs`, `test:authz` npm script, CI step | No forgeable ownership parameter exists on these routes — ownership proof is an after-the-fact state check, not a rejected-forged-ID check |
| 4. Update test-plan cookbook | §6.2/§6.4 filled in with the new patterns | None — documentation only |

**Prerequisites:** Local Supabase CLI available (`npx supabase`); no new dependencies to install.
**Estimated effort:** ~1 session across 4 phases (mostly SQL + one new script).

## Open Risks & Assumptions

- Storage/DB RLS UPDATE/DELETE semantics (silent 0-row filter, no thrown
  error) must be verified against the actual local Postgres/Supabase
  version during Phase 2 implementation — the plan documents the expected
  behavior but the implementer should confirm it empirically before writing
  assertions.
- `matches` fixture setup in Phase 2 depends on the mutual-like trigger
  firing correctly across two swipe inserts; if that proves awkward inside
  a single pgTAP transaction, inserting directly as the table-owning role
  is an acceptable fallback (noted as implementer's call in the plan).
- No roadmap entry references this change-id, so no roadmap status sync
  was needed.

## Success Criteria (Summary)

- An unauthenticated request to any of the three existing API routes never
  returns dog/swipe data.
- An authenticated owner's mutation via any of these routes only ever
  changes their own row — proven by checking the other owner's row is
  unaffected.
- `dog-photos` storage write/update/delete stay owner-scoped, including the
  previously-untested UPDATE/DELETE cases.
- All of the above are provable locally (`npx supabase test db`, `npm run
  test:authz`) and in CI.
