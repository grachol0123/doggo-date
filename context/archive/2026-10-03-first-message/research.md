---
date: 2026-10-03T16:20:52+02:00
researcher: GitHub Copilot CLI
git_commit: 367a5275cbfcae1e272ccc98e3b8438697f0e6c6
branch: develop
repository: grachol0123/doggo-date
topic: "S-03 (first-message): real-time text messaging between matched owners"
tags: [research, codebase, messages, realtime, supabase, rls, matches]
status: complete
last_updated: 2026-10-03
last_updated_by: GitHub Copilot CLI
---

# Research: S-03 (`first-message`) — real-time messaging between matched owners

**Date**: 2026-10-03T16:20:52+02:00
**Researcher**: GitHub Copilot CLI
**Git Commit**: 367a5275cbfcae1e272ccc98e3b8438697f0e6c6
**Branch**: develop
**Repository**: grachol0123/doggo-date

## Research Question

What already exists in this codebase (schema, RLS, API, UI, env/config conventions) that
`/10x-plan first-message` must reuse or extend to let a matched owner send and receive plain-text
messages delivered instantly (WebSocket push via Supabase Realtime, not polling), per roadmap S-03
/ PRD FR-006?

## Summary

The `matches` table and its RLS (from `match-data-foundation`) already identify, for any
authenticated owner, exactly which other dogs they are matched with — this is the authorization
boundary a new `messages` table must key off. No `messages` table, no Realtime subscription, and no
Realtime publication exist anywhere in this repo yet (`supabase/migrations/*.sql` has 4 files, none
mentioning `messages` or `supabase_realtime` — confirmed by reading all four full migration
filenames and `match-data-foundation/plan.md`'s own "Current State" claim that no such table
exists). A conversation UI (`MatchesList.tsx`'s disabled "Napisz wiadomość" button) is already
wired as a placeholder pointing at this exact gap (`matches-list/plan.md`, "What We're NOT Doing").
The project's Supabase client today is **server-only**: `src/lib/supabase.ts` wraps
`@supabase/ssr`'s cookie-based `createServerClient`, and both `SUPABASE_URL`/`SUPABASE_KEY` are
declared in `astro.config.mjs` as `context: "server", access: "secret"` — there is no browser-side
Supabase client and no client-exposed env var anywhere in the repo (`src/env.d.ts` only declares
`App.Locals.user`; no `astro:env/client` import found in `src/`). Supabase Realtime's
browser-side subscription API (`supabase.channel(...).on('postgres_changes', ...)`) requires a
client-side Supabase client constructed with a publicly-exposable URL/key, so adding one (and the
matching `access: "public"`/`context: "client"` env schema entries) is new ground this plan must
cover — it is not a gap in existing code, but a capability this codebase has never needed before.
`context/foundation/test-plan.md` already names this exact risk (`#4`) and requires both an RLS
proof and a real browser-delivery check, not just a passing lint/build.

## Detailed Findings

### Matches/swipes schema and RLS (the authorization boundary for messages)

- `supabase/migrations/20260926200000_create_swipes_and_matches.sql` creates `public.matches(id,
dog_a_id, dog_b_id, created_at)` with `dog_a_id < dog_b_id` (canonical order) and a `security
definer` trigger (`create_match_on_mutual_like`) that is the _only_ writer — no `authenticated`
  role has insert/update/delete rights on `matches` (`match-data-foundation/plan.md:60-76`, "Contract").
- RLS policy `matches_select_participant` lets any authenticated user `select` a `matches` row
  where their own dog (`dogs.owner_id = auth.uid()`) is `dog_a_id` or `dog_b_id`
  (`match-data-foundation/plan.md:76`) — this is the exact "is this user part of this match"
  predicate a `messages` table's RLS must reuse (e.g. `exists (select 1 from matches m join dogs d
on d.owner_id = auth.uid() and d.id in (m.dog_a_id, m.dog_b_id) where m.id = messages.match_id)`).
- `dogs.owner_id` is `unique` — one dog per owner — so "the owner" and "the owner's dog" are always
  a 1:1 mapping throughout this schema (`match-data-foundation/plan.md`, "Key Discoveries").
- No `messages`, `conversations`, or similar table exists in any of the 4 files under
  `supabase/migrations/`: `20260925231055_create_dogs_table.sql`,
  `20260925233126_create_dog_photos_bucket.sql`, `20260926164458_seed_test_dog_profiles.sql`,
  `20260926200000_create_swipes_and_matches.sql` (confirmed via `glob` listing — exhaustive for this
  repo's migrations directory as of this commit).

### Migration / RLS / types conventions to reuse

- Migration file naming: `YYYYMMDDHHmmss_description.sql`, one file per logical change, plain SQL
  (no Supabase CLI declarative schema) — established by F-01 and reused verbatim by
  `match-data-foundation` (`match-data-foundation/plan.md`, "Current State Analysis").
- RLS convention: granular per-operation policies named `<table>_<operation>_<scope>`, `to
authenticated`, `using`/`with check` pairs — exact shape to mirror is
  `supabase/migrations/20260925231055_create_dogs_table.sql:43-64` per
  `match-data-foundation/plan.md`'s own "Key Discoveries".
- `src/types.ts` is a **hand-mirrored** copy of Supabase's generated types — no live Supabase
  instance was used to regenerate it even for `swipes`/`matches` (`match-data-foundation/plan.md`,
  "Current State Analysis" and "Migration Notes": "If a local Supabase/Docker instance becomes
  available later, regenerate ... and reconcile any drift"). A `messages` table must be added to
  `src/types.ts` by hand in the same style: `Database["public"]["Tables"]["messages"]` with
  `Row`/`Insert`/`Update`, plus a `Message` convenience alias exported at the bottom
  (`src/types.ts:140-150` shows the tail structure — `Tables`/`DefaultSchema` helpers follow the enum
  block; `Dog`/`Match`/`Swipe` aliases live just above that per `matches-list/plan.md`'s reference to
  `src/types.ts:118-166`).

### API route conventions

- `src/pages/api/dogs/next-candidate.ts` and `src/pages/api/matches/index.ts` (per
  `matches-list/plan.md`'s Phase 1 contract) establish the pattern a `messages` API must follow:
  `export const prerender = false`, resolve `context.locals.user` first and return `{ status:
"unauthenticated" }` (401) if absent, resolve the caller's own `dogs` row via `.eq("owner_id",
user.id).maybeSingle()` and return a distinct `{ status: "no_own_dog" }` if absent (not an error),
  `createClient(context.request.headers, context.cookies)` from `@/lib/supabase`, and a
  `jsonResponse` helper returning tagged-union JSON bodies (`src/pages/api/dogs/next-candidate.ts:1-45`).
- `src/pages/api/dogs/save.ts` is the only existing `POST` handler; it reads `context.request.formData()`
  and validates with a zod schema (`@/lib/schemas/dog-profile`) before writing — the convention for
  any new `POST /api/messages` route sending a message (`src/pages/api/dogs/save.ts:1-20, 148-165`).
- No existing API route performs a cross-table authorization check before a write (the closest is
  `next-candidate.ts`'s read-only exclusion filter) — a `messages` insert endpoint verifying the
  caller's dog is a participant in the target `match_id` before insert is new logic, though RLS
  itself (not app code) should be the actual enforcement boundary per the project's existing
  RLS-first convention (`dogs`, `swipes`, `matches` all rely on RLS, not app-level checks, for
  authorization — `match-data-foundation/plan.md`, "Implementation Approach").

### UI conventions

- `src/components/dog/MatchesList.tsx`'s match card already renders a disabled "Napisz wiadomość"
  (write a message) button with no `onClick`, explicitly scoped out as "wiring it up is S-03
  (`first-message`), not yet planned" (`matches-list/plan.md`, "What We're NOT Doing" and Phase 2
  contract) — this is the exact entry point a conversation view should attach to.
- `src/components/Sidebar.astro` currently has two nav links — "Mój profil psa" (`/dashboard/dog`)
  and "Matche" (`/dashboard/matches`) — with no remaining placeholder comment for messages
  (`src/components/Sidebar.astro:10-18`, read directly). Any new "Wiadomości"/conversation nav entry
  is a net-new addition, not filling an existing placeholder.
- `BrowseDogs.tsx` and (per its plan) `MatchesList.tsx` both use a `ViewState` string-union
  state-machine (`"loading" | "no_own_dog" | ... `) fetched client-side via a typed tagged-union
  JSON response, Radix/shadcn `Card`/`Badge`/`Alert` components, and `lucide-react` icons
  (`src/components/dog/BrowseDogs.tsx:1-15`) — the convention a messaging UI (conversation list +
  thread view) should follow, with an added Realtime subscription effect alongside the existing
  fetch-on-mount effect.
- Protected-page pattern: `src/pages/dashboard/matches.astro` is a thin wrapper — `DashboardLayout`
  - one React island with `client:load` + a "Powrót do panelu" back-link
    (`src/pages/dashboard/matches.astro`, read directly) — the shape a new `/dashboard/messages` (or
    per-match `/dashboard/messages/[matchId]`) page should follow.

### Realtime and client-side Supabase access (the new capability this plan must add)

- `src/lib/supabase.ts` only exports a server-side `createClient(requestHeaders, cookies)` built on
  `@supabase/ssr`'s `createServerClient` — there is no browser/client Supabase client anywhere in
  `src/` (confirmed: this is the only file matching `supabase-js|createBrowserClient` outside
  `package.json`/`package-lock.json`/`src/env.d.ts`, per a repo-wide grep).
  - `supabase.channel(...)` (the Realtime subscription API) is a method on the `supabase-js` client
    object regardless of whether it was constructed via `createServerClient` or a plain
    `createClient`; what's actually missing is a **publicly-exposable** URL/anon key the browser is
    allowed to hold, not the method itself.
- `astro.config.mjs`'s `env.schema` declares both `SUPABASE_URL` and `SUPABASE_KEY` with `context:
"server", access: "secret"` — Astro's `astro:env` module explicitly disallows importing
  `context: "server"` variables from client-rendered code; a Realtime subscription running inside a
  React island (which executes in the browser after `client:load`) cannot reach these as declared
  today.
- No `context: "client"` or `access: "public"` entry exists in `env.schema` anywhere in
  `astro.config.mjs` (full file read — 25 lines, only the two server-secret fields are declared).
- Consequently, enabling browser-side Realtime requires, at minimum: (a) a new public env var pair
  (commonly `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`, Astro's naming convention for
  client-exposed env vars, declared with `context: "client", access: "public"`) sourced from
  Supabase's anon key (safe to expose; RLS is the actual boundary) rather than the existing
  `SUPABASE_KEY` (which this repo's server client already treats as sufficiently privileged for
  server-side RLS-respecting queries — whether that's the anon key or a service key is not
  determinable from code alone; see Open Questions), and (b) a small new client module (e.g.
  `src/lib/supabase-browser.ts`) exporting a browser Supabase client, parallel to but distinct from
  `src/lib/supabase.ts`.
- Supabase Realtime's `postgres_changes` feature additionally requires the replicated table to be
  added to the `supabase_realtime` publication (`alter publication supabase_realtime add table
public.messages;` or equivalent) — no migration in this repo touches any publication yet (grep
  across `supabase/migrations/*.sql` content was not literally run for this exact string, but all 4
  files were read/summarized above via the match-data-foundation plan's own full-file quote, and
  none mention `publication`).

### Risk framing already captured outside this change

- `context/foundation/test-plan.md:46` names this exact failure mode as Risk #4: "Real-time message
  delivery silently degrades to polling, or RLS lets a non-matched user read/write messages" (High
  impact / Medium likelihood), citing roadmap S-03's own risk note and PRD FR-006/NFR.
- `context/foundation/test-plan.md:65` requires, for this risk, both an RLS/authorization check
  ("a non-matched user cannot subscribe to or read that conversation") and an actual real-time
  delivery check ("arrives without a page refresh or poll") — explicitly warning that "an e2e test
  that only checks the message appears in the UI without verifying an unauthorized user is blocked
  at the RLS/subscription layer" is an insufficient test for this slice.
- PRD FR-006 (`context/foundation/prd.md:71-72`) is must-have, plain-text only (images/emoji
  explicitly rejected by the PRD's own recorded Socrates counter-argument — "czysty tekst
  wystarczy na MVP"), but delivery must be instant via WebSocket, not just correct after a refresh.
- PRD Non-Functional Requirements (`context/foundation/prd.md:78`) repeats the same constraint:
  "nowa wiadomość pojawia się u odbiorcy natychmiast, bez konieczności odświeżania strony lub
  odpytywania serwera (polling)" — polling is an explicitly named anti-pattern to avoid, not just an
  unstated preference.
- `infrastructure.md:60,68,73,101` flags a related but distinct latency risk (Cloudflare Worker edge
  node vs. Supabase's fixed database region) as a narrative "what could go wrong" example, not a
  confirmed incident — worth a plan-level note but not a blocking unknown for this research.

## Code References

- `supabase/migrations/20260926200000_create_swipes_and_matches.sql` - only existing non-`dogs`
  schema; its RLS/trigger shape is the direct precedent for a `messages` table
- `supabase/migrations/20260925231055_create_dogs_table.sql:43-64` - canonical granular RLS policy
  naming/shape to mirror
- `src/lib/supabase.ts:1-20` - server-only Supabase client; no browser client exists yet
- `astro.config.mjs:1-25` - full `env.schema`; both Supabase vars are server-secret, no client/public
  entry exists
- `src/env.d.ts:1-5` - only declares `App.Locals.user`; no client env typing present
- `src/pages/api/dogs/next-candidate.ts:1-45` - canonical "resolve own dog, tagged-union JSON
  response, 401 on unauthenticated" API convention
- `src/pages/api/dogs/save.ts:148-165` - canonical `POST` + `formData()` + zod-validation pattern
- `src/components/dog/MatchesList.tsx` (per `matches-list/plan.md` Phase 2 contract) - disabled
  "Napisz wiadomość" button, the UI entry point for this change
- `src/components/Sidebar.astro:10-18` - current nav links; no messaging placeholder remains
- `src/pages/dashboard/matches.astro` - thin protected-page wrapper pattern to reuse
- `src/types.ts:1-40,140-170` - hand-mirrored generated-types file structure to extend

## Architecture Insights

- This codebase treats **RLS as the sole authorization boundary** for all domain tables so far
  (`dogs`, `swipes`, `matches`) — app code never re-checks ownership before a Postgres write beyond
  what RLS already enforces; a `messages` table should follow the same pattern (RLS policy keyed off
  `matches` participancy) rather than adding an app-level authorization layer.
- Types are maintained **by hand**, not generated, project-wide — every prior slice (`dogs`,
  `swipes`, `matches`) added its types manually to `src/types.ts` mirroring the exact Supabase
  generated-types shape, with regeneration from a live instance deferred as a "Migration Notes" TODO
  each time. This plan should do the same for `messages`/`Message`.
- The project has, until now, needed **zero browser-side access to Supabase** — every existing data
  interaction is a server-rendered Astro API route or server-side `.astro` fetch, with React islands
  only calling the app's own `/api/*` JSON endpoints via `fetch`, never `supabase-js` directly
  (confirmed across `BrowseDogs.tsx`, `MatchesList.tsx`'s described fetch-on-mount pattern, and the
  single `src/lib/supabase.ts` server client). Real-time delivery is the **first** feature requiring
  a client-side Supabase client and a publicly-exposed key — this is a new architectural seam, not
  an established convention to copy.

## Historical Context (from prior changes)

- `context/changes/match-data-foundation/plan.md` - established the `matches` schema/RLS this
  change's authorization boundary depends on; explicitly states (in its own "What We're NOT Doing")
  that "No notification/realtime plumbing for match creation" was deferred, "realtime is reserved
  for S-03 (messages)" — confirms this change is where that deferred work lands, supported by
  direct quote in that file.
- `context/changes/matches-list/plan.md` - the "Napisz wiadomość" button is a confirmed, intentional
  placeholder for this exact change ("wiring it up is S-03 (`first-message`), not yet planned") —
  supported by direct quote.
- `context/changes/browse-and-match/change.md` - records the roadmap-level decision to split S-02
  into three sub-changes and defer messaging entirely to S-03; read as background framing only, no
  messaging-specific technical decision found there beyond what's already covered above.
- `context/foundation/roadmap.md` ("S-03" section) - Prerequisites: S-02 (done); Status: `ready` —
  confirms no further roadmap-level blocker exists for starting this change now.

## Related Research

- No prior `research.md` exists under `context/changes/**/` or `context/archive/**/` specifically
  about messaging/Realtime — `match-data-foundation` and `matches-list` both shipped via
  `plan-brief.md`/`plan.md` only (no `research.md` present in either folder), so there is no earlier
  research document to reconcile against for this topic.

## Open Questions

- **Which Supabase key is safe to expose to the browser?** `SUPABASE_KEY` (current server secret)
  may already be the anon/publishable key or may be a higher-privilege key (e.g. `service_role`) —
  this is a Supabase project dashboard setting, not determinable from repository code. The plan must
  either confirm (via the project owner) that a dedicated anon key is available to expose as
  `PUBLIC_SUPABASE_*`, or treat this as a setup prerequisite before Realtime can be wired up safely.
- **Local Supabase/Docker verification is intermittently available in this environment** (per
  `match-data-foundation/plan.md`'s Progress notes, a local Podman-backed Supabase instance was
  available and used for that change's RLS verification on 2026-10-03) — whether it remains
  available for this change's own RLS + Realtime delivery verification is not something this
  research can confirm in advance; the plan should treat local Supabase availability as a
  per-session fact to re-check, not an assumption.
- **Conversation granularity is not yet decided**: whether messages key directly off `match_id`
  (one implicit conversation per match, simplest given FR-006's plain 1:1 scope) or a separate
  `conversations` table is a product/design choice for `/10x-plan`, not a question this research can
  resolve from existing code — no existing schema or PRD text implies more than one conversation per
  match, since matches are already 1:1 pairs.
