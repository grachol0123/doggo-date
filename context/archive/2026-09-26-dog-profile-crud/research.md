---
date: 2026-09-26T12:55:00+02:00
researcher: Copilot CLI
git_commit: d8c26114e6590d0c66df8a1c14a5480928e6ba2c
branch: develop
repository: grachol0123/doggo-date
topic: "Contract and conventions needed to plan S-01 dog-profile-crud (create/edit dog profile)"
tags: [research, codebase, dogs-table, api-routes, auth-forms, storage, zod]
status: complete
last_updated: 2026-09-26
last_updated_by: Copilot CLI
last_updated_note: "Follow-up (18:23 CEST): S-01 is now impl_reviewed (all 5 phases committed). Recorded how each Open Question below was actually resolved by the shipped implementation."
---

# Research: Contract and conventions needed to plan S-01 dog-profile-crud

**Date**: 2026-09-26T12:55:00+02:00
**Researcher**: Copilot CLI
**Git Commit**: d8c26114e6590d0c66df8a1c14a5480928e6ba2c
**Branch**: develop
**Repository**: grachol0123/doggo-date

## Research Question

Before planning S-01 (`dog-profile-crud` — owner creates and edits their dog's profile), what does the existing codebase already provide (schema contract from F-01, API route conventions, form/UI conventions, storage upload conventions) and what conventions declared in AGENTS.md/CLAUDE.md are not yet demonstrated anywhere in the code?

## Summary

F-01 (`dog-profile-data-foundation`, archived, done) fully delivered the data contract S-01 must build on: a `dogs` table (one row per owner, enforced by a `unique` constraint on `owner_id`) with base + extended fields, granular per-operation RLS, a public `dog-photos` storage bucket with owner-scoped write RLS, and generated types in `src/types.ts` (`Dog` type, `Database["public"]["Enums"]`). No UI or API route for dogs exists yet — `src/pages/api/` only contains `auth/{signin,signup,signout}.ts`, and there is exactly one protected page (`dashboard.astro`). The existing auth API routes and forms establish two conventions S-01 should reuse: (1) Astro `APIRoute` handlers that read `request.formData()`, build a Supabase SSR client via `createClient(request.headers, cookies)`, and redirect with an `?error=` query param on failure; (2) React form components under `src/components/auth/` composed from small shared pieces (`FormField`, `SubmitButton`, `ServerError`, `PasswordToggle`) with client-side validation in a `validate()` function before submit, while still submitting as a plain `<form method="POST" action="...">` (progressive-enhancement style, no fetch/JSON). **Zod is not installed and not used anywhere in `src/` or `package.json`** despite AGENTS.md/CLAUDE.md stating "API routes use uppercase GET, POST exports; validate input with zod" — this is a gap S-01's plan must close explicitly (add the dependency, since it doesn't exist yet in this inspected codebase) rather than assume prior art to copy.

## Detailed Findings

### Dogs table contract (from F-01, done/archived)

- Table `dogs`, columns and types generated in [src/types.ts:33-46](../../../src/types.ts) (`Row` shape): `id` (uuid, default), `owner_id` (uuid, not null, **unique** — one dog per owner), `name` (not null), `age_years` (number, not null), `description` (nullable), `photo_path` (nullable text — storage path, not a full URL), `breed` (nullable), `temperament` (nullable `string[]`), `activity_level` (nullable enum `dog_activity_level`), `interests` (nullable enum array `dog_interest[]`), `created_at`/`updated_at` (timestamps, defaulted, `updated_at` auto-maintained by a DB trigger per `context/archive/2026-09-25-dog-profile-data-foundation/plan.md` Phase 1).
- Enums, from [src/types.ts:66-78](../../../src/types.ts): `dog_activity_level`: `"homebody" | "walker" | "runner"`; `dog_interest`: 10 fixed English identifiers (`walks`, `running`, `fetch`, `swimming`, `agility`, `obedience_training`, `playing_with_other_dogs`, `hiking`, `camping`, `car_rides`). Per the archived plan, PL translations belong in the frontend layer, not the DB.
- CHECK constraints (from archived plan, not re-encoded in generated types): `name` 1–100 chars, `age_years` 0–40, `description` ≤500 chars, `breed` ≤100 chars — S-01's zod schema must mirror these exact bounds to fail client-side the same way the DB would reject server-side.
- RLS (from `supabase/migrations/20260925231055_create_dogs_table.sql` per archived plan): `SELECT` open to all `authenticated` users (needed later for S-02 browsing); `INSERT`/`UPDATE`/`DELETE` restricted to `auth.uid() = owner_id`. S-01's API routes do not need to pass an explicit owner filter for reads of "my dog", but must rely on RLS (not app-level checks alone) for writes.
- Storage: bucket `dog-photos` (public read, 5MB limit, `image/jpeg|png|webp` only) with RLS requiring the first path segment to equal `auth.uid()` (`supabase/migrations/20260925233126_create_dog_photos_bucket.sql`, contract in archived plan Phase 2). `photo_path` convention is `{owner_id}/{uuid}.{ext}` — filenames must be randomly generated, never the original filename, to avoid enumerable/guessable paths (explicit guardrail rationale in the archived plan's Current State Analysis).
- One dog per owner is enforced at the DB level (`unique` on `owner_id`), so "create" is really an upsert-shaped flow from the owner's perspective: if a row already exists, a second insert will fail RLS-adjacent unique-constraint validation, not RLS itself.

### API route conventions (existing, auth-only)

- Only three API routes exist, all under `src/pages/api/auth/`: [signin.ts](../../../src/pages/api/auth/signin.ts), [signup.ts](../../../src/pages/api/auth/signup.ts), [signout.ts](../../../src/pages/api/auth/signout.ts). No non-auth API route exists yet in this repo, so there is no direct precedent for a JSON-returning or authenticated-write endpoint to imitate beyond the pattern below.
- Pattern demonstrated in `signup.ts`: `export const POST: APIRoute = async (context) => { ... }`, reads `await context.request.formData()`, builds `const supabase = createClient(context.request.headers, context.cookies)`, returns `context.redirect(...)` both on Supabase-not-configured and on Supabase error, encoding the error message into a `?error=` query string consumed by the destination page.
- No JSON API response pattern (`return new Response(JSON.stringify(...))`) exists anywhere in `src/pages/api/` today — S-01's plan must decide fresh whether dog CRUD uses the same redirect-with-query-param style (consistent with existing forms) or introduces a JSON contract (e.g., for an eventual SPA-like edit flow), since no precedent settles this.
- `AGENTS.md`/`CLAUDE.md` state routes must export uppercase `GET`/`POST` and validate with zod — the uppercase-export convention is followed by all three existing routes, but the zod-validation half is **not observed in any existing route** (confirmed by `grep` across `src/` for `zod`: no matches, and `zod` is absent from `package.json` dependencies).

### Form / UI conventions (existing, auth-only)

- Forms live as React islands under `src/components/auth/` (e.g., [SignUpForm.tsx](../../../src/components/auth/SignUpForm.tsx)), composed from shared pieces: `FormField` (labeled input with icon/hint/error slot), `PasswordToggle`, `SubmitButton` (accepts a `pendingText` for in-flight state), `ServerError` (renders a `serverError` prop passed down from the Astro page's `?error=` query param).
- Client-side `validate()` runs synchronously in a plain function (not a schema library) before allowing native form submission (`<form method="POST" action="/api/auth/signup" onSubmit={handleSubmit} noValidate>`); errors are tracked as local `useState` per field, not through a validation library. This is a second data point (besides the API layer) that no zod usage exists anywhere client-side either — the project's forms currently hand-roll validation.
- Astro pages (`src/pages/auth/*.astro`) are responsible for reading `Astro.url.searchParams` for `error` and passing it as `serverError` into the React form island — this is the mechanism by which server errors reach the client without a JSON round-trip.
- No existing file-upload UI/component exists anywhere in `src/components/` — S-01 (photo upload to `dog-photos`) has no in-repo precedent for a file input, multipart form handling, or client-side image preview to copy; this must be designed fresh in the plan.
- `src/components/ui/` only has `button.tsx` and `LibBadge.astro` — shadcn/ui is set up ("new-york" variant per AGENTS.md) but no form-adjacent primitives (input, select, textarea, multi-select) have been added yet; S-01 will likely need `npx shadcn@latest add input textarea select` (or similar) as part of implementation.

### Auth/session conventions relevant to dog ownership

- `src/lib/supabase.ts` creates the SSR Supabase client from `SUPABASE_URL`/`SUPABASE_KEY` (`astro:env/server`); returns `null` if unconfigured, which every API route checks before calling `.auth`.
- `src/middleware.ts` resolves `context.locals.user` on every request and redirects unauthenticated requests away from paths in `PROTECTED_ROUTES = ["/dashboard"]`. S-01 will need to add its new profile route(s) (e.g., `/dashboard/dog` or similar) to this array, since dog-profile pages are inherently owner-only.
- There is no separate `profiles` table — the owner is `auth.users(id)` directly, referenced by `dogs.owner_id` (confirmed in the archived plan's Current State Analysis and mirrored in `dogs.owner_id: uuid ... references auth.users(id)`).

## Code References

- `src/types.ts:33-64` - Generated `dogs` table Row/Insert/Update shapes (source of truth for the CRUD contract)
- `src/types.ts:66-78` - `dog_activity_level` / `dog_interest` enum value lists
- `src/pages/api/auth/signup.ts` - Reference pattern for a Supabase-backed POST API route (formData → Supabase call → redirect with `?error=`)
- `src/lib/supabase.ts` - SSR Supabase client factory reused by every route/middleware
- `src/middleware.ts:4` - `PROTECTED_ROUTES` array to extend for new dog-profile pages
- `src/components/auth/SignUpForm.tsx` - Reference pattern for a React form island with local validation and shared subcomponents
- `src/pages/dashboard.astro` - Only existing protected page; shows how `Astro.locals.user` is consumed in a page template
- `context/archive/2026-09-25-dog-profile-data-foundation/plan.md` - Full F-01 contract (schema, RLS, storage, CHECK constraints) that S-01 must not re-derive or contradict
- `supabase/migrations/20260925231055_create_dogs_table.sql`, `supabase/migrations/20260925233126_create_dog_photos_bucket.sql` - Applied migrations implementing the above contract

## Architecture Insights

- The project's actual current convention for forms is "server-rendered redirect + query-string error", not JSON APIs or client-side fetch — any deviation for dog CRUD (e.g., returning JSON for an AJAX-style edit form) would be a new pattern, not a continuation of an existing one, and should be justified explicitly in the plan.
- Validation today is hand-rolled per component, not schema-driven, even though the team's own documented convention (AGENTS.md) calls for zod on the API side. This is a real gap between stated convention and inspected code — the plan should treat "add zod as a dependency and use it for the dogs API route(s)" as new setup work, not as "following existing usage".
- Storage path convention (`{owner_id}/{random-filename}.{ext}`) is a deliberate privacy/guessability guardrail established in F-01 and must be preserved by any upload code S-01 introduces.

## Historical Context (from prior changes)

- `context/archive/2026-09-25-dog-profile-data-foundation/plan.md` - Source of the full `dogs` schema, RLS policies, and storage bucket contract enumerated above; states explicitly that "Kształt tabeli `dogs` ... ustala kontrakt, z którego korzystają S-02 i S-03" — schema changes now require a migration, not a redesign.
- `context/foundation/roadmap.md` (F-01 section, Risk) - Confirms the one-dog-per-owner and single-photo decisions were deliberate MVP scoping, with "wiele zdjęć" and richer profile fields explicitly parked for a future milestone (see roadmap `## Parked` and `RQ-03`).

## Related Research

- None found under `context/changes/**/research.md` or `context/archive/**/research.md` other than the F-01 plan itself (no separate `research.md` exists in the archived F-01 folder — only `plan.md`, `plan-brief.md`, and `reviews/plan-review.md`).

## Open Questions

- Should dog-profile create/edit use the existing redirect+query-param pattern (consistent with auth) or a JSON API (more suited to inline photo upload/preview)? Not resolved by any existing code — a product/UX decision for `/10x-plan`.
- Which shadcn/ui form primitives (input, textarea, select, multi-select for `interests`) need to be added, and how should the `dog_interest`/`dog_activity_level` enums be labeled in Polish for the UI, given the DB stores English identifiers by design?
- What is the exact new protected route path for the profile page(s) (e.g., `/dashboard/dog`, `/dog/edit`) that needs adding to `PROTECTED_ROUTES` in `src/middleware.ts`?

## Follow-up (2026-09-26 18:23 CEST): how the shipped implementation resolved the Open Questions

S-01 is now fully implemented (`context/changes/dog-profile-crud/change.md:4` → `status: impl_reviewed`; every step in `plan.md`'s Progress section is checked with a commit sha, `a87fa2c`..`3d0b9ee`). Verified directly against the current code, each of the three Open Questions above was resolved as follows — no question remains open for this change:

- **Redirect+query-param vs JSON API** → resolved as **redirect+query-param**, matching the existing auth convention exactly. `src/pages/api/dogs/save.ts` exports `POST: APIRoute`, reads `context.request.formData()`, and calls `context.redirect(`/dashboard/dog?error=...`)` on every failure path (missing user, validation failure, Supabase error) and a plain `context.redirect("/dashboard/dog")` on success — no JSON response is ever returned. No new architectural pattern was introduced.
- **shadcn/ui primitives + PL enum labels** → resolved. `src/components/ui/` now additionally contains `input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `label.tsx` (new since this research's first pass, which only found `button.tsx`). `src/lib/dog-enums.ts` exports `dogActivityLevelOptions` and `dogInterestOptions`, each built by mapping `Constants.public.Enums.dog_activity_level` / `dog_interest` (from `src/types.ts`) through a hand-written `Record<Enum, string>` Polish label map (e.g. `homebody` → "Kanapowiec", `walks` → "Spacery") — confirming the plan's intent that DB values stay English while the UI shows Polish labels.
- **Route path** → resolved as **`/dashboard/dog`**. `src/middleware.ts:4` now reads `PROTECTED_ROUTES = ["/dashboard", "/dashboard/dog"]` (the second entry is redundant with the existing `startsWith("/dashboard")` prefix match, but was added explicitly per the plan's Phase 3, Change 2 intent of future-proofing against prefix changes). The page itself lives at `src/pages/dashboard/dog.astro`, and the form island at `src/components/dog/DogProfileForm.tsx`.

No further research gaps were identified for `dog-profile-crud` in this pass — the change's own Open Questions are now closed by inspection of the shipped code, not just by plan intent.
