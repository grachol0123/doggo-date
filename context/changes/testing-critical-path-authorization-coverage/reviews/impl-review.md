---
change_id: testing-critical-path-authorization-coverage
reviewed: 2026-10-02
scope: full plan (Phases 1-4)
verdict: APPROVED (with 2 open LOW follow-ups, commit c3dc228)
---

## Resolution (commit `c3dc228`)

- **#1 CRITICAL — fixed.** Fixture seeding moved from a versioned migration
  into `supabase/seed.sql`, which `[db.seed]` in `config.toml` loads only
  on `supabase db reset` and is never applied by `supabase db push` to a
  linked remote project.
- **#2 HIGH — reclassified, not a bug.** Re-examination found an inline
  code comment in `dog_photos_storage_rls.test.sql` explaining that
  `storage.objects` has a built-in `protect_delete()` trigger that
  hard-blocks _any_ direct SQL `DELETE` regardless of RLS/ownership — the
  implementer correctly adapted to this real Supabase behavior; `throws_ok`
  is the right assertion there, not row-count. No code change made.
- **#3 MEDIUM — fixed.** §6.2 cookbook now explicitly documents the
  `protect_delete()` exception instead of implying both UPDATE and DELETE
  in that file follow the same row-count pattern.
- **#4 MEDIUM — fixed.** Added a "Run pgTAP database tests" (`supabase test
db`) CI step in the `smoke` job; updated test-plan.md §3/§4/§5 to reflect
  the gate now being enforced in CI (brings forward rollout Phase 4
  "Quality-gates wiring" from `not started` to `complete`).
- **#5 LOW, #6 LOW — left open**, per user triage choice; not addressed in
  this pass.

# Implementation Review — testing-critical-path-authorization-coverage

## Scope

Full-plan review of all 4 phases, covering commits `01721dc`..`8fd13a7`:

- `supabase/migrations/20260929120000_seed_authz_test_fixtures.sql`
- `supabase/tests/database/{dogs_rls,swipes_rls,matches_rls,dog_photos_storage_rls}.test.sql`
- `scripts/authz-test.mjs`
- `package.json`, `.github/workflows/ci.yml`
- `context/foundation/test-plan.md` (§6.2, §6.4)

## Findings

| #   | Severity    | File                                                              | Lines        | Finding                                                                                                                                                                                                                                                                                                                                                                                             | Confidence |
| --- | ----------- | ----------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | 🔴 CRITICAL | `supabase/migrations/20260929120000_seed_authz_test_fixtures.sql` | 4-104        | Ordinary numbered migration unconditionally inserts two real, login-capable `auth.users` rows with a documented shared password, plus matching identities/dogs. Nothing in the file enforces "local/CI only" — if this migration is ever applied against a shared/staging/production Supabase project it creates persistent test accounts with known credentials.                                   | 8/10       |
| 2   | 🟠 HIGH     | `supabase/tests/database/dog_photos_storage_rls.test.sql`         | 104-124      | Plan required both the cross-owner UPDATE _and_ DELETE checks to use row-count/unchanged-state assertions (not `throws_ok`), because USING-only storage policies silently filter rather than raising 42501. UPDATE follows this; DELETE instead uses `throws_ok 42501` (plan said this must NOT be used here). Also no explicit re-select proving the object still exists after the UPDATE attempt. | 7/10       |
| 3   | 🟡 MEDIUM   | `context/foundation/test-plan.md`                                 | 142-143      | §6.2 cookbook cites `dog_photos_storage_rls.test.sql` as a reference for the row-count/unchanged-state pattern, but (per #2) that file's DELETE case actually uses `throws_ok`, so the cookbook overstates consistency and will mislead the next engineer who copies the pattern.                                                                                                                   | 7/10       |
| 4   | 🟡 MEDIUM   | `.github/workflows/ci.yml`                                        | 66-76        | CI runs `npm run smoke` and `npm run test:authz` but never runs the new pgTAP suite (`supabase test db`). The new RLS regression coverage (Phases 1-2) is not actually gating merges yet.                                                                                                                                                                                                           | 7/10       |
| 5   | ⚪ LOW      | `scripts/authz-test.mjs`                                          | 107-118, 197 | Recovers the fixture dog ID by scraping `/dashboard/dog` HTML with regex instead of a stable identifier, making the authz assertion brittle to unrelated markup/SSR changes.                                                                                                                                                                                                                        | 6/10       |
| 6   | ⚪ LOW      | `context/foundation/test-plan.md`                                 | 43, 76       | Risk #1 wording blurs "cross-user access to dog profile" (intentionally browseable per `dogs_rls.test.sql:217`) with private match/message data — could mislead future test authors about what's actually meant to be blocked.                                                                                                                                                                      | 5/10       |

## Dimension verdicts

- **Plan adherence**: NEEDS ATTENTION — 8/10 planned items match exactly; `dog_photos_storage_rls.test.sql` DELETE case drifted from the specified assertion style (#2), and the cookbook (§6.2) then documents that drifted file as the canonical example (#3).
- **Security**: NEEDS ATTENTION — test credentials seeded via a standard versioned migration (#1) is the only critical issue; no other injection/authz-boundary issues found. pgTAP fixtures correctly use `BEGIN...ROLLBACK`, no data leakage.
- **CI/quality gates**: NEEDS ATTENTION — lint (0 errors, 2 pre-existing unrelated warnings) and `npm run build` both pass; pgTAP (`supabase test db`) and the HTTP-level `smoke`/`test:authz` scripts could not be executed in this review environment (no Docker/Supabase CLI available) and are also not wired into CI (#4).
- **Pattern consistency**: OK, with one LOW note (#5) on fixture-ID lookup brittleness.

## Automated verification run in this review

| Command                                | Result                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run lint`                         | PASS (0 errors, 2 pre-existing warnings in `src/pages/api/dogs/save.ts`, unrelated to this change) |
| `npm run build`                        | PASS                                                                                               |
| `npx supabase test db`                 | NOT RUN — Docker/Supabase CLI unavailable in this environment                                      |
| `npm run smoke` / `npm run test:authz` | NOT RUN — requires a running local server + local Supabase, unavailable in this environment        |

## Overall verdict: NEEDS ATTENTION

Core intent of the plan is implemented and the bulk of the surface (fixtures, new RLS tests, authz script, CI/package wiring) matches the plan precisely. Three issues are worth triaging before considering this fully closed: the test-credential migration's blast radius if ever applied outside local/CI (#1), the storage-DELETE assertion style drift plus the cookbook referencing it as correct (#2 + #3), and pgTAP not yet gating CI (#4).
