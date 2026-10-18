# Redirect to /dashboard after sign-in — Implementation Plan

## Overview

A successful email/password sign-in currently redirects to `/` (landing page). It should redirect to `/dashboard`.

## Current State Analysis

- `src/pages/api/auth/signin.ts` ends with `context.redirect("/")` on success; error paths redirect to `/auth/signin?error=...` (unchanged).
- `/dashboard` is protected in `src/middleware.ts` (`PROTECTED_ROUTES`); the session cookie is set before the redirect, so it renders for the freshly signed-in user.
- Tests asserting the old target: `scripts/smoke.mjs:57`, `scripts/authz-test.mjs:185,261`. Comments in `tests/e2e/auth.setup.ts:25` and `tests/e2e/helpers/api-sign-in.ts:15` mention `"/"`.

## What We're NOT Doing

- No `?next=` / return-to-origin redirect.
- No change to sign-up (`/auth/confirm-email`) or sign-out (`/`) flows.
- No redirect of already-signed-in users visiting `/auth/signin`.

## Phase 1: Redirect and tests

### Changes Required:

#### 1. Sign-in endpoint

**File**: `src/pages/api/auth/signin.ts`
**Intent**: Send the user to the dashboard after successful sign-in.
**Contract**: success response is `302 Location: /dashboard`; error responses unchanged.

#### 2. Tests and comments

**Files**: `scripts/smoke.mjs`, `scripts/authz-test.mjs`, `tests/e2e/auth.setup.ts`, `tests/e2e/helpers/api-sign-in.ts`
**Intent**: Expect `/dashboard` as the post-sign-in location.
**Contract**: smoke expects `location: "/dashboard"`; authz expects `signinResponse.location === "/dashboard"`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Smoke test passes against a running server: `npm run smoke`
- Authz test passes: `npm run test:authz`

#### Manual Verification:

- Signing in via `/auth/signin` lands on `/dashboard`; a wrong password still shows the error on `/auth/signin`.

## Progress

### Phase 1: Redirect and tests

#### Automated

- [x] 1.1 Lint passes
- [x] 1.2 Smoke test passes
- [x] 1.3 Authz test passes

#### Manual

- [ ] 1.4 Sign-in lands on /dashboard; wrong password still errors on /auth/signin
