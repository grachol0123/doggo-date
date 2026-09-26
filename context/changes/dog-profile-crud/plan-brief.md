# Dog Profile CRUD — Plan Brief

> Full plan: `context/changes/dog-profile-crud/plan.md`
> Research: `context/changes/dog-profile-crud/research.md`

## What & Why

S-01 on the roadmap: the owner creates and edits their dog's profile (name, age, description, photo, plus the extended fields F-01 already schema'd — breed, temperament, activity level, interests). This is the foundation FR-001/FR-002 requires before S-02 (browsing/matching) and S-03 (messaging) can exist.

## Starting Point

F-01 (done) already provides the `dogs` table with RLS, CHECK constraints, and a public `dog-photos` storage bucket — but no UI, no API route, and no page exist yet. The only precedent in the repo is the auth flow: formData → Supabase call → redirect with `?error=`, and hand-rolled React form validation (`SignUpForm.tsx`). Zod is documented as the validation convention but isn't installed anywhere yet.

## Desired End State

A signed-in owner visits `/dashboard/dog`, sees an empty or pre-filled form depending on whether they already have a dog, submits create/edit changes including an optional photo, and is redirected back to the same page with the saved data reflected (or a visible error if something failed).

## Key Decisions Made

| Decision                    | Choice                                                             | Why (1 sentence)                                                                 | Source   |
| ---------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Field scope                  | Full F-01 field set (base + breed/temperament/activity_level/interests) | Schema already supports it at no extra migration cost; S-02 will want these fields | Plan     |
| API pattern                  | FormData + `context.redirect` with `?error=`                          | Only existing pattern in the repo (auth routes); avoids introducing a JSON API     | Plan     |
| Create vs edit                | One page/form, insert-or-update in one API route                     | One dog per owner (unique constraint) makes "create" and "edit" the same action   | Plan     |
| Route                        | `/dashboard/dog`                                                      | Groups with the existing `/dashboard`, easy to find and protect                   | Plan     |
| Photo required?               | Optional at creation, addable later                                  | Lowers the barrier to creating a profile; simpler validation                      | Plan     |
| Photo replacement              | Delete old storage object after new upload succeeds                   | Prevents orphaned files accumulating in a public bucket                           | Plan     |
| PL enum labels                | New `src/lib/dog-enums.ts` constants file                             | Reusable by S-02 later; keeps translations out of the form component              | Plan     |
| Missing form primitives        | Add via `npx shadcn@latest add ...`                                   | Matches the project's declared shadcn/ui ("new-york") convention                  | Plan     |

## Scope

**In scope:** create/edit form for all `dogs` fields (base + extended), photo upload with old-file cleanup, new protected page + API route, zod schema + missing shadcn/ui primitives.

**Out of scope:** database/migration changes (already done in F-01), multiple photos per dog, browsing/matching UI (S-02), a JSON/AJAX API, client-side image cropping/resizing.

## Architecture / Approach

Astro SSR page (`src/pages/dashboard/dog.astro`) reads the current user's `dogs` row server-side and renders a React form island (`DogProfileForm.tsx`). The form posts (multipart, for the optional photo) to a single API route (`src/pages/api/dogs/save.ts`) that validates with a shared zod schema, uploads/replaces the photo in the `dog-photos` bucket, and inserts-or-updates the `dogs` row, relying on RLS + the `owner_id` unique constraint rather than app-level ownership checks.

## Phases at a Glance

| Phase                                              | What it delivers                                           | Key risk                                                      |
| --------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Validation foundations & missing UI primitives    | zod dependency, shadcn primitives, enum labels, zod schema      | None significant — additive setup work                          |
| 2. API route for saving the dog profile              | `POST /api/dogs/save`: validate, upload/replace photo, insert-or-update | Orphaned storage files if old-photo cleanup is skipped/misordered |
| 3. Protected dog profile page                        | `/dashboard/dog` page, `PROTECTED_ROUTES` update, dashboard link | Forgetting the route in `PROTECTED_ROUTES` would leave data exposed via SSR fetch |
| 4. Dog profile form component                        | `DogProfileForm.tsx` with all fields, select/multi-select/file preview | First multi-select and file-upload UI in the repo — no pattern to copy |
| 5. Final verification                                | Lint/build gate + full manual create→edit→replace-photo walkthrough | None — verification only                                        |

**Prerequisites:** F-01 (`dog-profile-data-foundation`) is done — schema, RLS, and storage bucket already exist.
**Estimated effort:** ~3-4 sessions across 5 phases (Phase 2 and Phase 4 are the largest units of work).

## Open Risks & Assumptions

- Assumes the shadcn CLI's generated primitives (input/textarea/select/checkbox/label) need no visual customization beyond the project's existing Tailwind theme.
- Assumes `npm run smoke`'s existing auth-flow coverage is sufficient regression protection for the `PROTECTED_ROUTES` change; no smoke coverage is added for the new page itself.
- Assumes storage delete-on-replace failures should be logged/ignored rather than blocking the save — a stricter transactional guarantee was not requested.

## Success Criteria (Summary)

- An owner can create their dog's profile (all fields + one photo) and see it persist across reloads.
- An owner can edit an existing profile, including replacing the photo, without creating a duplicate `dogs` row or leaving orphaned storage files.
- Invalid input (exceeding any CHECK-constraint bound) is rejected both client-side and server-side with a visible error.
