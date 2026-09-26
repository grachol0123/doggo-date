# Dog Profile CRUD Implementation Plan

## Overview

Implement S-01 from the roadmap: the owner creates and edits their dog's profile — name, age, description, breed, temperament, activity level, interests, and one photo — on a single protected page `/dashboard/dog`. Because `dogs.owner_id` is unique (one dog per owner, enforced in F-01), "create" and "edit" are the same form and the same API route, branching on whether a row already exists.

## Current State Analysis

- The `dogs` table, its CHECK constraints, RLS policies, and the public `dog-photos` storage bucket already exist and are done (F-01, `context/archive/2026-09-25-dog-profile-data-foundation/plan.md`). No schema or migration work is needed in this plan.
- `src/types.ts` already has generated `Dog` row/insert/update types and the `dog_activity_level` / `dog_interest` enums (with a `Constants.public.Enums` runtime array for each).
- No dog-related UI, API route, or page exists yet. `src/pages/api/` only has `auth/{signin,signup,signout}.ts`; `src/middleware.ts` only protects `/dashboard`.
- `zod` is not installed anywhere in the repo despite being the documented validation convention (AGENTS.md/CLAUDE.md) — it must be added as a new dependency.
- `src/components/ui/` only has `button.tsx`; no input/textarea/select/checkbox primitives exist. shadcn/ui is configured ("new-york" variant) but these primitives were never added.
- The only form precedent is `src/components/auth/SignUpForm.tsx` + `FormField.tsx`/`ServerError.tsx`/`SubmitButton.tsx`: plain `<form method="POST" action="...">`, hand-rolled `validate()` before submit, server errors surfaced via a `?error=` query param read by the Astro page and passed down as a `serverError` prop. No JSON API, no file upload, and no multi-select exist anywhere in the repo today.

## Desired End State

An authenticated owner can visit `/dashboard/dog`, see either an empty form (no dog yet) or their existing dog's data pre-filled, submit changes (including optionally uploading/replacing one photo), and land back on the same page with the saved data reflected — or with a visible error message if validation or the save failed. The `dogs` row is written exclusively through Supabase (RLS enforces `owner_id`), and any replaced photo file is removed from storage so the bucket doesn't accumulate orphans.

### Key Discoveries:

- `src/types.ts:33-46` — the exact `dogs` Row/Insert/Update shape the form and API route must produce.
- `src/types.ts:66-78` and `Constants.public.Enums` — the fixed English enum values (`dog_activity_level`, `dog_interest`) that the zod schema and PL label map must mirror exactly.
- `src/pages/api/auth/signup.ts` — the only existing pattern for a Supabase-backed POST route (formData → Supabase call → `context.redirect` with `?error=`); this plan follows it rather than introducing a JSON API.
- `src/middleware.ts:4` — `PROTECTED_ROUTES` array to extend with `/dashboard/dog`.
- `src/components/auth/SignUpForm.tsx` + `FormField.tsx` — the form-composition and client-validation pattern to follow for `DogProfileForm.tsx`.
- CHECK constraints from the archived F-01 plan (not encoded in generated types, must be mirrored in zod and client validation): `name` 1–100 chars, `age_years` 0–40, `description` ≤500 chars, `breed` ≤100 chars.
- Storage path convention `{owner_id}/{random-filename}.{ext}` (never the original filename) is a deliberate guardrail from F-01 and must be preserved by the upload code.

## What We're NOT Doing

- No database schema or migration changes — the `dogs` table, RLS, and `dog-photos` bucket are already correct from F-01.
- No support for multiple photos per dog (single `photo_path` field only, per FR-002 and the roadmap's explicit MVP scoping).
- No browsing/matching UI (S-02) — this plan only covers the owner's own profile.
- No JSON/AJAX API — this plan follows the existing redirect + `?error=` convention, not a fetch-based API.
- No client-side image cropping/resizing — the browser-selected file is uploaded as-is (still subject to the bucket's 5MB / `image/jpeg|png|webp` limits, enforced by storage RLS/config from F-01).
- Photo is optional at creation time; there is no "must upload a photo before you can save" gate.

## Implementation Approach

Follow the existing auth-route/auth-form conventions rather than introducing new architectural patterns: a single Astro page reads the current user's dog server-side and renders a React form island; a single API route validates with zod, uploads/deletes storage objects, and upserts the `dogs` row via Supabase (relying on RLS + the `owner_id` unique constraint rather than app-level ownership checks). New shadcn/ui primitives are added via the CLI to close the gap noted in research, and a new `src/lib/dog-enums.ts` centralizes the enum→Polish-label maps so S-02 can reuse them later.

## Phase 1: Validation foundations and missing UI primitives

### Overview

Add `zod` as a dependency, add the shadcn/ui form primitives the form needs, and create the shared enum-label map plus the zod schema that both the API route and (indirectly, via shared bounds) the client form will use.

### Changes Required:

#### 1. Add zod dependency

**File**: `package.json`

**Intent**: Close the documented-but-unused validation convention gap identified in research; zod becomes the single source of truth for field bounds.

**Contract**: Add `zod` to `dependencies` (latest stable major compatible with the project's TypeScript version) via the package manager, not a manual edit.

#### 2. Add missing shadcn/ui primitives

**File**: `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/select.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/label.tsx` (exact set depends on what the shadcn CLI scaffolds)

**Intent**: Provide the "new-york" variant primitives needed for text inputs, the description textarea, the activity-level single-select, and the interests multi-select (checkboxes), consistent with the project's declared shadcn/ui convention.

**Contract**: Run `npx shadcn@latest add input textarea select checkbox label` and commit the generated files unmodified (aside from any project-standard formatting).

#### 3. Dog enum label map

**File**: `src/lib/dog-enums.ts`

**Intent**: Centralize the Polish display labels for `dog_activity_level` and `dog_interest` so the form (and later S-02) don't hand-roll or duplicate translations, since the DB intentionally stores English identifiers.

**Contract**: Export two ordered arrays/maps, one per enum, each entry `{ value: <db enum literal>, label: <Polish text> }`, built from `Constants.public.Enums.dog_activity_level` / `dog_interest` in `src/types.ts` (import the values, don't retype them, so a future enum change surfaces as a type error here).

#### 4. Shared dog profile zod schema

**File**: `src/lib/schemas/dog-profile.ts`

**Intent**: Define the single validation contract for create/edit: `name` (1–100 chars), `age_years` (0–40, integer), `description` (≤500 chars, optional), `breed` (≤100 chars, optional), `temperament` (optional string array), `activity_level` (optional, one of the enum literals), `interests` (optional array of enum literals). Mirrors the F-01 CHECK constraints exactly so client and server reject the same inputs the DB would.

**Contract**: Export a `dogProfileSchema` (zod object) and its inferred `DogProfileInput` type for reuse by the API route.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `zod` appears in `package.json` dependencies and resolves (`npm ls zod` exits 0)

#### Manual Verification:

- N/A for this phase (no UI-visible behavior yet)

---

## Phase 2: API route for saving the dog profile

### Overview

Add a single POST route that validates input, uploads/replaces the photo in storage, and inserts or updates the `dogs` row for the current user.

### Changes Required:

#### 1. Save route

**File**: `src/pages/api/dogs/save.ts`

**Intent**: Accept the profile form submission (multipart, since it may include a photo file), validate it against `dogProfileSchema`, resolve whether the current user already has a `dogs` row, and write the result — inserting a new row or updating the existing one. On any failure (auth missing, validation failure, Supabase error), redirect back to `/dashboard/dog` with `?error=` like the existing auth routes; on success, redirect to `/dashboard/dog` with no query param.

**Contract**: `export const POST: APIRoute = async (context) => { ... }`. Reads `await context.request.formData()`; parses `interests`/`temperament` as repeated form fields or a delimited string (implementer's choice, documented inline) before passing to `dogProfileSchema.safeParse`. Requires `context.locals.user` (already resolved by middleware) — redirect to `/auth/signin` if absent, matching the middleware's existing protection semantics. Uses `createClient(...)` from `src/lib/supabase.ts` exactly as the auth routes do.

#### 2. Photo upload + old-file cleanup

**File**: `src/pages/api/dogs/save.ts` (same file, distinct concern)

**Intent**: When a photo file is present in the submission, upload it to the `dog-photos` bucket under `{owner_id}/{random-filename}.{ext}` (never the original filename), then — if the existing `dogs` row already had a different `photo_path` — delete the old object from storage after the new upload succeeds, so replaced photos don't accumulate as orphans.

**Contract**: New path is generated with a random identifier (e.g. `crypto.randomUUID()`) + the original file's extension; only the new `photo_path` is persisted to the `dogs` row (never a full URL, matching the existing column convention). Old-file deletion happens only after the new upload's success is confirmed, and its failure must not block the profile save from succeeding (log/ignore, don't abort the request).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes
- `src/pages/api/dogs/save.ts` exports uppercase `POST`

#### Manual Verification:

- Submitting the form with valid data as a signed-in user with no existing dog creates a `dogs` row visible in Supabase Studio, owned by the correct `auth.uid()`
- Submitting again with edits updates the same row (no duplicate row, no unique-constraint violation)
- Uploading a new photo removes the previously uploaded object from the `dog-photos` bucket
- Submitting invalid data (e.g. name >100 chars) redirects back with a visible error and does not write to the database

---

## Phase 3: Protected dog profile page

### Overview

Add the Astro page that fetches the current user's dog (if any) and renders the form, and wire it into the protected-routes list and the dashboard.

### Changes Required:

#### 1. Dog profile page

**File**: `src/pages/dashboard/dog.astro`

**Intent**: Server-render the profile page for the signed-in owner: query `dogs` for a row where `owner_id = user.id` (RLS-scoped `select().eq("owner_id", user.id).maybeSingle()`), read `Astro.url.searchParams.get("error")`, and pass both the existing dog (or `null`) and the `serverError` into the `DogProfileForm` React island.

**Contract**: Follows the `dashboard.astro` pattern of reading `Astro.locals.user` from middleware; no new auth logic here.

#### 2. Extend protected routes

**File**: `src/middleware.ts`

**Intent**: Ensure unauthenticated visitors to the new profile page are redirected to sign-in, consistent with `/dashboard`.

**Contract**: Add `"/dashboard/dog"` to the `PROTECTED_ROUTES` array (already covered by the existing `startsWith` prefix match against `/dashboard`, but list it explicitly for clarity and future-proofing against prefix changes).

#### 3. Dashboard link

**File**: `src/pages/dashboard.astro`

**Intent**: Give the owner a visible entry point to the new page from the page they land on after sign-in.

**Contract**: Add a link/button to `/dashboard/dog` (e.g. "Mój profil psa") near the existing sign-out form.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- Visiting `/dashboard/dog` while signed out redirects to `/auth/signin`
- Visiting `/dashboard/dog` while signed in with no existing dog shows an empty form
- Visiting `/dashboard/dog` after saving a profile shows the previously saved values pre-filled
- The dashboard page shows a working link to `/dashboard/dog`

---

## Phase 4: Dog profile form component

### Overview

Build the React island that renders and validates the form, following the existing `SignUpForm.tsx` composition pattern but extended with a select, a multi-select, and a file input with preview.

### Changes Required:

#### 1. Form component

**File**: `src/components/dog/DogProfileForm.tsx`

**Intent**: Render fields for `name`, `age_years`, `description`, `breed`, `temperament` (free-text list), `activity_level` (single-select using the shadcn `select` primitive and PL labels from `dog-enums.ts`), `interests` (multi-select checkboxes using PL labels), and a file input for the photo with a client-side preview (existing `photo_path` rendered as an `<img>` if present, replaced by a local object-URL preview once a new file is chosen). Runs a `validate()` function mirroring `dogProfileSchema`'s bounds before allowing submission, matching `SignUpForm.tsx`'s pattern (local `useState` errors, no schema library on the client).

**Contract**: `<form method="POST" action="/api/dogs/save" encType="multipart/form-data" onSubmit={handleSubmit} noValidate>`. Props: `{ dog: Dog | null; serverError?: string | null }`. Reuses `FormField`, `ServerError`, `SubmitButton` where their shape fits (name/description/breed as text-like fields); introduces new small subcomponents only where `FormField` doesn't fit (select, multi-select checkboxes, file input+preview).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` passes

#### Manual Verification:

- All fields round-trip correctly: saved values reappear pre-filled on reload
- Client-side validation blocks submission and shows inline errors for out-of-bounds values (e.g. name >100 chars, age >40) without a network request
- Selecting a new photo shows a local preview before submitting
- Multi-select interests and single-select activity level submit and redisplay correctly

---

## Phase 5: Final verification

### Overview

Run the full lint/build gate and manually walk the create → edit → photo-replace flow end to end.

### Changes Required:

No code changes in this phase — verification only.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with zero errors
- `npm run build` passes

#### Manual Verification:

- Full flow: sign in → visit `/dashboard/dog` (empty) → create profile with a photo → reload (values + photo persist) → edit fields and replace the photo → reload (new values + new photo persist, old photo object no longer in the bucket)
- No regressions in the existing auth flow (`npm run smoke` still passes against a running server)

## Testing Strategy

### Unit Tests:

- No unit test framework exists in this repo (per AGENTS.md, `npm run smoke` is the only automated check beyond lint/build) — this plan relies on lint/build/manual verification, consistent with existing conventions.

### Integration Tests:

- `npm run smoke` (existing auth-flow smoke test) — re-run after this change to confirm no regression to sign-in/sign-up, since `/dashboard/dog` shares `PROTECTED_ROUTES` middleware logic with `/dashboard`.

### Manual Testing Steps:

1. Sign in, visit `/dashboard/dog`, confirm an empty form renders.
2. Fill in all fields including a photo, submit, confirm redirect back to `/dashboard/dog` with the saved data visible.
3. Reload the page, confirm all fields (including photo) are pre-filled from the database.
4. Edit a field and replace the photo, submit, confirm the new values persist and the old photo file is gone from the `dog-photos` bucket.
5. Submit with an intentionally invalid value (e.g. 200-character name) and confirm both the client-side block and, if bypassed, the server-side rejection with a visible error message.

## Performance Considerations

No specific performance budget beyond existing conventions; photo uploads are constrained by the bucket's existing 5MB limit (F-01), so no additional client-side size validation beyond surfacing the storage error is required.

## Migration Notes

Not applicable — no schema changes in this plan.

## References

- Related research: `context/changes/dog-profile-crud/research.md`
- Schema/RLS/storage contract: `context/archive/2026-09-25-dog-profile-data-foundation/plan.md`
- Similar route pattern: `src/pages/api/auth/signup.ts`
- Similar form pattern: `src/components/auth/SignUpForm.tsx`, `src/components/auth/FormField.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Validation foundations and missing UI primitives

#### Automated

- [x] 1.1 npm run lint passes — a87fa2c
- [x] 1.2 npm run build passes — a87fa2c
- [x] 1.3 zod appears in package.json dependencies and resolves (npm ls zod exits 0) — a87fa2c

### Phase 2: API route for saving the dog profile

#### Automated

- [x] 2.1 npm run lint passes — bc699c2
- [x] 2.2 npm run build passes — bc699c2
- [x] 2.3 src/pages/api/dogs/save.ts exports uppercase POST — bc699c2

#### Manual

- [x] 2.4 Submitting the form with valid data as a signed-in user with no existing dog creates a dogs row visible in Supabase Studio, owned by the correct auth.uid()
- [x] 2.5 Submitting again with edits updates the same row (no duplicate row, no unique-constraint violation)
- [x] 2.6 Uploading a new photo removes the previously uploaded object from the dog-photos bucket
- [x] 2.7 Submitting invalid data (e.g. name >100 chars) redirects back with a visible error and does not write to the database

### Phase 3: Protected dog profile page

#### Automated

- [x] 3.1 npm run lint passes — c791714
- [x] 3.2 npm run build passes — c791714

#### Manual

- [x] 3.3 Visiting /dashboard/dog while signed out redirects to /auth/signin — c791714
- [x] 3.4 Visiting /dashboard/dog while signed in with no existing dog shows an empty form — c791714
- [x] 3.5 Visiting /dashboard/dog after saving a profile shows the previously saved values pre-filled — c791714
- [x] 3.6 The dashboard page shows a working link to /dashboard/dog — c791714

### Phase 4: Dog profile form component

#### Automated

- [x] 4.1 npm run lint passes — c791714
- [x] 4.2 npm run build passes — c791714

#### Manual

- [x] 4.3 All fields round-trip correctly: saved values reappear pre-filled on reload — c791714
- [x] 4.4 Client-side validation blocks submission and shows inline errors for out-of-bounds values without a network request — c791714
- [x] 4.5 Selecting a new photo shows a local preview before submitting — c791714
- [x] 4.6 Multi-select interests and single-select activity level submit and redisplay correctly — c791714

### Phase 5: Final verification

#### Automated

- [x] 5.1 npm run lint passes with zero errors
- [x] 5.2 npm run build passes

#### Manual

- [x] 5.3 Full flow: sign in → visit /dashboard/dog (empty) → create profile with a photo → reload (values + photo persist) → edit fields and replace the photo → reload (new values + new photo persist, old photo object no longer in the bucket)
- [x] 5.4 No regressions in the existing auth flow (npm run smoke still passes against a running server)
