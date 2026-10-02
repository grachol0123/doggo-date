# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-29

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in area Y"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/` (excluding
`node_modules`, `dist`, build output).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Unauthenticated or cross-user access to dog profile, match, or message data (IDOR) | High | Medium | interview Q1; PRD §Success Criteria Guardrails ("dane profilowe nie są udostępniane bez zgody"); roadmap F-01 risk note (RLS pattern established once, repeated per new table) |
| 2 | A match is created from a one-sided like, or a race condition breaks the atomicity of a mutual-like match | High | Medium | PRD FR-004 / US-01 acceptance criteria; roadmap S-02 risk note (DB trigger atomicity requirement); interview Q3 (matching flagged as low-confidence area) |
| 3 | The browse feed re-shows an already-rated profile, or breaks the newest-first + match-relevance ordering | Medium | High | PRD §Business Logic + §Non-Functional Requirements; roadmap S-02 risk note ("główna logika biznesowa MVP"); interview Q3; hot-spot dir `src/components/dog/` (4 commits/30d) |
| 4 | Real-time message delivery silently degrades to polling, or RLS lets a non-matched user read/write messages | High | Medium | roadmap S-03 risk note; PRD FR-006 / NFR (WebSocket-based instant delivery) |
| 5 | Dog photo storage paths become guessable/sequential, exposing photos outside the intended app flow | Medium | Low | archive `2026-09-25-dog-profile-data-foundation/plan.md` §Current State Analysis (accepted MVP trade-off, explicitly flagged "do rewizji, jeśli wymaganie prywatności okaże się ściślejsze") |

**Impact × Likelihood rubric.** High impact = user loses access, data, or
money, or the failure is publicly visible. High likelihood = area changes
weekly or has already caused bugs. Rows are ordered to protect High×High
first.

**Abuse / security lens.** The product has auth and user-submitted profile
data, so the map includes an authorization/access scenario (#1, IDOR) and a
secret/PII-adjacent exposure scenario (#5, storage path enumeration).

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | An unauthenticated request to any dog/match/message surface returns 401/redirect, never data; an authenticated owner A cannot read or mutate owner B's rows (dogs, and future matches/messages) even via a direct call, not just via hidden UI | "a valid session cookie is present ⇒ full access is fine" — must verify ownership, not just authentication | Existing API entry points for `dogs`; RLS policies; auth/session shape from `src/middleware.ts`; future matches/messages entry points | integration (pgTAP RLS + API-level ownership test) | Over-mocking the Supabase client so RLS is bypassed in the test, producing false confidence |
| #2 | A match row is created if and only if both owners have liked each other, exactly once, including under near-simultaneous likes; a single one-sided like never creates a match | "the insert returned success ⇒ match logic is correct" — must verify match *state*, not insert status | DB trigger definition for match creation; swipes/likes table schema; transaction/atomicity guarantee | integration (pgTAP on the trigger, or API integration test) | Testing only the sequential happy path (A likes, then B likes) and skipping the near-simultaneous case |
| #3 | The browse endpoint never returns a profile the user already liked/rejected while unrated candidates remain; ordering is newest-first with match-relevance as tiebreaker | "an empty response after rating one dog ⇒ correct behavior" — must verify it is actually a different, correctly-ordered next profile | Sorting query definition; "already rated" tracking mechanism; fixture data with multiple dogs and mixed ratings | integration against seeded test data | Snapshotting API response order without asserting the underlying business rule (implementation mirror) |
| #4 | A message sent by owner A to matched owner B arrives without a page refresh or poll; a non-matched user cannot subscribe to or read that conversation | "the Realtime subscription connects ⇒ delivery and access control are both fine" — connecting does not guarantee correct RLS scope | Messages table RLS design (once built); Supabase Realtime channel/subscription setup; matched-pair authorization boundary | integration (pgTAP RLS) + manual/e2e smoke for real-time delivery | An e2e test that only checks the message appears in the UI without verifying an unauthorized user is blocked at the RLS/subscription layer |
| #5 | Photo storage paths remain non-sequential/non-guessable (random identifier per file), and bucket write/update/delete stay scoped to the owning user, even after future schema changes (e.g. multiple photos) | "public bucket = acceptable exposure" is already an accepted MVP trade-off — the risk is regression to guessable/sequential paths, not public-read itself | Existing storage RLS policies (`dog_photos_owner_write/update/delete`); path-generation convention in upload code | integration/pgTAP (extend the existing storage RLS test) | Testing only that RLS blocks cross-user writes while never asserting the path-format assumption the policy depends on |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Critical-path authorization coverage | Prove unauthenticated/cross-user access is blocked across existing and near-term dog/match data surfaces | #1, #5 | integration | complete | `context/changes/testing-critical-path-authorization-coverage/` |
| 2 | Browse & match correctness | Prove mutual-like match creation and browse ordering/no-repeat rules hold for the in-progress `browse-and-match` slice | #2, #3 | integration | not started | — |
| 3 | Real-time messaging privacy & delivery | Prove message delivery is instant and scoped to matched pairs only, once `first-message` (S-03) is built | #4 | integration + e2e/manual smoke | not started | — |
| 4 | Quality-gates wiring | Wire `supabase test db` (pgTAP) into CI so RLS regressions block merges, not just local runs | cross-cutting | gates | complete | wired directly into `.github/workflows/ci.yml` `smoke` job during Phase 1's impl review (no dedicated change folder opened) |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration (DB/RLS) | pgTAP via `supabase test db` | Supabase CLI ^2.23.4 | Used for `dogs`/`swipes`/`matches` tables + storage RLS; now run in CI (`.github/workflows/ci.yml` `smoke` job) |
| unit + integration (app/API) | none yet | — | see §3 Phase 1/2 |
| API mocking | none yet | — | see §3 Phase 1/2 |
| e2e | none yet | — | see §3 Phase 3 |
| accessibility | none yet | — | not scoped in this rollout |
| (optional) AI-native | not used | n/a | no docs/search/browser MCP available this session to ground a recommendation; revisit at `--refresh` |

**Stack grounding tools (current session):**
- Docs: none available in current session — no Context7/framework-docs MCP exposed; checked: 2026-09-29
- Search: none available in current session — no Exa.ai/web-search MCP exposed; checked: 2026-09-29
- Runtime/browser: none available in current session — no Playwright/browser MCP exposed; checked: 2026-09-29
- Provider/platform: GitHub MCP and Linear MCP available but not used for test-stack grounding; checked: 2026-09-29

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck | local + CI (`.github/workflows/ci.yml` `lint-and-build`) | required | syntactic / type drift |
| build | local + CI | required | build breakage |
| smoke test (auth flow) | CI (`.github/workflows/ci.yml` `smoke`) | required | auth-flow regressions |
| pgTAP DB/RLS tests | CI (`.github/workflows/ci.yml` `smoke` job) | required | RLS/constraint regressions |
| integration tests (browse/match) | local, added by §3 Phase 2 | required after §3 Phase 2 | matching/ordering logic regressions |
| e2e / manual smoke (messaging) | added by §3 Phase 3 | required after §3 Phase 3 | real-time delivery + privacy regressions |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

- TBD — see §3 Phase 1/2 for app-level test runner selection.

### 6.2 Adding an integration test (DB/RLS)

- **Location**: `supabase/tests/database/`.
- **Naming**: `<table_or_area>_rls.test.sql`.
- **Reference tests**: `supabase/tests/database/dogs_rls.test.sql`,
  `supabase/tests/database/swipes_rls.test.sql`,
  `supabase/tests/database/matches_rls.test.sql`.
- **Run locally**: `npx supabase test db`.
- **Cross-owner UPDATE/DELETE pattern**: a `USING`-only RLS policy does not
  raise an error for a cross-owner `UPDATE`/`DELETE` — the non-matching row
  is silently excluded from the affected set (0 rows changed). Assert via
  row-count / unchanged-state (re-select the row and prove it is
  unaffected), not `throws_ok`. Only `INSERT` (and any `WITH CHECK`
  failure) raises `42501` and is a valid `throws_ok` target. See the
  cross-owner UPDATE/DELETE assertions in `dogs_rls.test.sql` and the
  cross-owner UPDATE assertion in `dog_photos_storage_rls.test.sql` for the
  row-count pattern. **Exception**: `storage.objects` has a built-in
  `protect_delete()` trigger that hard-blocks *any* direct SQL `DELETE`
  (own-row or cross-owner alike) regardless of RLS — that case is a
  legitimate `throws_ok` target, documented inline in
  `dog_photos_storage_rls.test.sql`. Don't assume every storage mutation
  follows the silent-filter rule; check whether a trigger enforces a hard
  error first.

### 6.3 Adding an e2e test

- TBD — see §3 Phase 3 for the messaging real-time delivery/privacy pattern.

### 6.4 Adding a test for a new API endpoint

- **Location**: `scripts/<name>-test.mjs` (e.g. `scripts/authz-test.mjs`).
- **Pattern**: zero-dependency script following `scripts/smoke.mjs`'s
  fetch/cookie-jar/step-list convention — manual `Set-Cookie` jar,
  `redirect: "manual"`, an ordered list of steps each asserting expected
  status/location/body, non-zero exit on any step failure. Run against a
  locally built preview server backed by local Supabase (never
  production).
- **Wiring**: add an npm script (`"test:<name>": "node
  scripts/<name>-test.mjs"` in `package.json`) and a step in the `smoke`
  job of `.github/workflows/ci.yml`, right after the existing `Run smoke
  test` step and before `Stop local Supabase`, so it reuses the
  already-running local Supabase + preview server instead of starting a
  new job.
- **Reference**: `scripts/authz-test.mjs` (unauthenticated access blocked,
  authenticated mutation stays owner-scoped) and its CI step in
  `.github/workflows/ci.yml`.

### 6.5 Adding a test for browse/match business logic

- TBD — see §3 Phase 2 for the mutual-like atomicity and no-repeat/ordering pattern.

### 6.6 Per-rollout-phase notes

(Filled in as each rollout phase lands.)

## 7. What We Deliberately Don't Test

Phase 2 interview Q5 was skipped, so no explicit user exclusion was
recorded. In its absence, this rollout defers to the PRD's own Non-Goals as
the negative space — none of the following exist in code yet, so no test
budget is spent on them until a roadmap slice brings them into scope:

- **Kennel/showcase module, date history, in-app camera, matching filters
  (age/interests/location), match deletion, group-walk module (GPS +
  Leaflet), multiple photos per dog** — all explicitly out of scope per
  `context/foundation/prd.md` §Non-Goals; re-evaluate only if a future
  roadmap milestone brings one of these into scope.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-29
- Stack versions last verified: 2026-09-29
- AI-native tool references last verified: 2026-09-29 (none in use)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
