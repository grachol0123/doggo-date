# Sentry Error Tracking Implementation Plan

## Overview

Integrate Sentry error monitoring into the Astro 7 SSR application deployed to Cloudflare Workers. Capture uncaught server and browser failures plus selected unexpected operational errors, while excluding personally identifying and request-specific data from events.

## Current State Analysis

The project has no error-tracking SDK. `src/middleware.ts` reads `data.user` from Supabase auth but ignores the returned error; API routes generally convert Supabase errors to responses, and `src/pages/api/dogs/save.ts` logs only two storage cleanup failures. Cloudflare Workers runtime observability is enabled, but it does not provide application-level Sentry issue alerts.

The app uses Astro `^7.3.2`, `@astrojs/cloudflare` `^14.3.1`, and Wrangler `^4.131.1`. `wrangler.jsonc` points directly to the Astro Cloudflare server entrypoint and already enables `nodejs_compat`. GitHub Actions builds and tests the app but does not deploy it; Cloudflare Workers Builds creates production deployments.

### Key Discoveries:

- Sentry's current Astro-on-Cloudflare guide requires both `@sentry/astro` and `@sentry/cloudflare`, and documents a custom Worker entrypoint for Astro 6+ with `@astrojs/cloudflare` v13+ (`context/changes/sentry-integration/research.md`, “Sentry package requirements”).
- The Sentry server SDK auto-instruments the Astro request pipeline; handled operational failures need explicit capture calls (`research.md`, “Minimal integration shape”).
- The DSN for the Worker must come from the `env` binding passed to `Sentry.withSentry`, not `astro:env/server`; the browser DSN is public configuration (`research.md`, “DSN and secrets channel”).
- Sentry source-map upload is performed by the Astro/Vite build integration using `SENTRY_AUTH_TOKEN`. Wrangler's `upload_source_maps` uploads maps to Cloudflare Observability, not Sentry (https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro/ and https://docs.sentry.io/platforms/javascript/guides/astro/sourcemaps/).
- Cloudflare Workers expose `0ms` span durations, so this change focuses on error monitoring rather than performance tracing (`research.md`, “Known platform caveats”).

## Desired End State

Uncaught server and browser errors, plus explicitly selected unexpected operational failures, appear in the Sentry project with readable source-mapped stacks and separate production/preview environments. Events contain no user identifiers, request bodies, headers, or URL query strings. A manually configured Sentry alert notifies project members about new issues.

### Verification:

- The existing lint, build, smoke, and authorization checks pass.
- A controlled preview test produces server and browser events with the expected environment and release tags, and no PII or request secrets.
- A production Cloudflare build uploads source maps to Sentry, and the resulting issue stack points to original source files.

## What We're NOT Doing

- Performance tracing, transaction/span sampling, or latency dashboards.
- Session replay, user feedback, or Sentry logs.
- Capturing every returned Supabase error, expected validation/authentication failure, or ordinary domain outcome.
- Sending user identifiers, request bodies, headers, or URL query strings to Sentry.
- Uploading Sentry source maps from GitHub Actions; that workflow does not produce the deployed Worker.
- Enabling Cloudflare's separate `wrangler.upload_source_maps` feature as a substitute for Sentry source-map upload.
- Adding a permanent test-only endpoint or changing the GitHub Actions deployment model.
- Committing DSNs, Sentry auth tokens, or other credentials to the repository.

## Implementation Approach

Use the documented Astro-on-Cloudflare integration: add both Sentry SDK packages, register the Astro integration, and wrap the Cloudflare server handler from one custom Worker entrypoint. Keep server initialization in that entrypoint only to avoid double initialization. Configure the browser SDK separately. Use `SENTRY_DSN` as a Cloudflare runtime secret, `PUBLIC_SENTRY_DSN` as a public client value, and Cloudflare version metadata for releases. Upload Sentry source maps only in the Cloudflare production build using its build secret. Apply an allowlist-style privacy policy to events, capture only unexpected operational failures in application code, and document the manual Sentry project/alert setup.

## Phase 1: Server-Side Foundation and Error Capture

### Overview

Wire Sentry into the Cloudflare Worker and capture uncaught server errors plus selected operational failures without changing existing user-facing response contracts.

### Changes Required:

#### 1. Server SDK dependencies and Astro integration

**File**: `package.json`, `astro.config.mjs`

**Intent**: Add the compatible Sentry Astro and Cloudflare SDKs and register the Astro integration so uncaught failures in Astro's request pipeline are captured.

**Contract**: Both `@sentry/astro` and `@sentry/cloudflare` are runtime dependencies. The Astro integration is registered alongside existing integrations; `PUBLIC_SENTRY_DSN` is optional client-exposed configuration, and no server secret is added to the client env schema.

#### 2. Custom Cloudflare Worker entrypoint

**File**: `sentry.server.config.ts` (new), `wrangler.jsonc`

**Intent**: Wrap the Astro Cloudflare server handler with Sentry's Cloudflare SDK, using Worker bindings for runtime configuration.

**Contract**: Wrangler's `main` points to the one Sentry custom entrypoint, which wraps `@astrojs/cloudflare/entrypoints/server`; the Sentry callback reads `SENTRY_DSN` and environment from Worker bindings. Do not add a second Astro Node-style server initialization file.

#### 3. Privacy filtering and handled server failures

**File**: `src/middleware.ts`, `src/pages/api/**/*.ts`, `src/pages/api/dogs/save.ts`

**Intent**: Report unexpected operational failures that are handled and returned as errors, including failed storage rollback/cleanup, while preserving expected authentication, validation, conflict, and domain outcomes.

**Contract**: Events must exclude user IDs, request bodies, headers, and URL query strings; retain only necessary exception, route, environment, and release context. Check and capture unexpected errors from `supabase.auth.getUser()` without changing existing unauthenticated redirect behavior. Explicit captures are limited to unexpected failures represented as server errors and cleanup failures; expected client/domain outcomes are not captured.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with the new Sentry configuration and server capture calls.
- `npm run build` succeeds without Sentry runtime secrets or build-upload credentials configured locally.

#### Manual Verification:

- With a Sentry project DSN configured in a preview Worker, a controlled uncaught server error and a selected operational failure appear as Sentry events, while expected validation/authentication/domain outcomes do not.
- The captured server events contain no user identifiers, request bodies, headers, or URL query strings.

## Phase 2: Browser Errors and Release Diagnostics

### Overview

Capture uncaught browser errors, distinguish production from preview, associate events with Cloudflare releases, and upload source maps from the production build that deploys the Worker.

### Changes Required:

#### 1. Browser SDK and environment configuration

**File**: `sentry.client.config.ts` (new), `astro.config.mjs`, `.env.example`

**Intent**: Capture uncaught browser errors in React islands and allow the browser SDK to be disabled by leaving its public DSN unset.

**Contract**: Initialize `@sentry/astro` using `PUBLIC_SENTRY_DSN`; apply the same PII/request-data exclusions as server events. Do not enable tracing or replay. Document optional local `SENTRY_DSN` and `PUBLIC_SENTRY_DSN` values without adding credentials.

#### 2. Release, environment, and Sentry source maps

**File**: `wrangler.jsonc`, `astro.config.mjs`

**Intent**: Make Sentry events identifiable by deployed version/environment and provide source-mapped stack traces for the actual production Worker build.

**Contract**: Add Cloudflare version metadata binding for automatic release detection. Configure distinct `production` and `preview` environment values. Configure Astro's Sentry build integration with the Sentry organization/project and `SENTRY_AUTH_TOKEN` as a Cloudflare Workers Build secret; do not expose the token to GitHub Actions or runtime/client code. Gate Sentry source-map upload behind an explicit build-time opt-in that is enabled only for production, so a token shared with preview cannot cause preview uploads.

#### 3. Deployment and operator documentation

**File**: `README.md`

**Intent**: Document the Sentry project prerequisites, secret placement, environment values, source-map upload, and manual new-issue alert setup.

**Contract**: Distinguish the Worker runtime `SENTRY_DSN` secret from the build-time `SENTRY_AUTH_TOKEN`; document public `PUBLIC_SENTRY_DSN` as non-secret and the production-only source-map opt-in. State that GitHub Actions does not deploy or upload source maps and that the alert rule is configured in the Sentry UI to notify project members.

### Success Criteria:

#### Automated Verification:

- The GitHub Actions build succeeds without the production source-map opt-in and performs no Sentry source-map upload.
- The production Cloudflare Workers Build succeeds with the source-map opt-in and Sentry build secret and reports a successful Sentry source-map upload.

#### Manual Verification:

- A controlled browser error in a preview deployment appears as a `preview` event with its Cloudflare release identifier; production events are tagged `production`, and the browser event contains no user identifier, request body, headers, or URL query string.
- A production Sentry event resolves to original source paths/lines rather than only bundled output.

## Phase 3: End-to-End and Operational Verification

### Overview

Verify the integrated error path using existing project checks and complete the manual alert configuration without adding a permanent test endpoint.

### Changes Required:

#### 1. Sentry operational handoff

**File**: `README.md`

**Intent**: Provide a short repeatable procedure for confirming event ingestion, privacy filtering, environment/release tags, source maps, and the new-issue alert after setup.

**Contract**: The verification instructions use a controlled preview test and require removal of any temporary test trigger before merging/deploying. They do not add a public production test route or commit any credentials.

### Success Criteria:

#### Automated Verification:

- The existing `npm run smoke` and `npm run test:authz` checks pass against the production preview with the local Supabase test setup.

#### Manual Verification:

- A Sentry new-issue alert is configured to notify project members and fires for a controlled preview test event.
- A preview event remains separate from production events, and local development with no Sentry DSN sends no event.

## Testing Strategy

### Unit Tests:

- No unit-test runner currently exists. Do not add a test framework solely for this integration.
- Verify the privacy filter against a representative event containing a user identifier, query string, request body, and authorization header; none may be present in the emitted event.

### Integration Tests:

- Use the existing Astro/Cloudflare production build to verify server and browser SDK configuration.
- Use the existing `npm run smoke` and `npm run test:authz` checks to guard authentication and protected-route behavior.
- Use a controlled preview error to verify ingestion, environment/release tags, and source-map symbolication.

### Manual Testing Steps:

1. Provision the Sentry project and configure runtime DSNs separately for Cloudflare production and preview.
2. Configure `SENTRY_AUTH_TOKEN`, organization, and project in Cloudflare Workers Build settings; set the explicit source-map upload opt-in only for production, then verify the production upload and the absence of preview uploads.
3. Trigger a controlled server and browser error in preview, then verify the Sentry events, redaction, tags, and source-mapped stack.
4. Configure the Sentry new-issue alert to notify project members and confirm it fires for the controlled preview event.
5. Confirm a local run without Sentry DSNs works normally and sends no event; remove any temporary error trigger before release.

## Performance Considerations

This change enables error reporting only; it does not enable traces, replay, or performance sampling. Worker event delivery uses the SDK's Cloudflare lifecycle integration and remains subject to Cloudflare's `waitUntil` limits.

## Migration Notes

No database or user-data migration is required. Before deployment, provision a Sentry project, set `SENTRY_DSN` and `PUBLIC_SENTRY_DSN` for the production/preview runtime as appropriate, and set `SENTRY_AUTH_TOKEN` plus Sentry org/project values in the Cloudflare build environment. Missing DSN should disable reporting without breaking local development or builds.

## References

- Related research: `context/changes/sentry-integration/research.md`
- Astro on Cloudflare: https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro/
- Sentry Astro source maps: https://docs.sentry.io/platforms/javascript/guides/astro/sourcemaps/
- Cloudflare Worker source maps (distinct from Sentry source maps): https://developers.cloudflare.com/workers/observability/source-maps/
- Current application configuration: `astro.config.mjs`, `wrangler.jsonc`, `.github/workflows/ci.yml`
- Existing server error handling: `src/middleware.ts`, `src/pages/api/dogs/save.ts:197-219`, and the API routes listed in `research.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server-Side Foundation and Error Capture

#### Automated

- [x] 1.1 `npm run lint` passes with the new Sentry configuration and server capture calls.
- [x] 1.2 `npm run build` succeeds without Sentry runtime secrets or build-upload credentials configured locally.

#### Manual

- [ ] 1.3 With a Sentry project DSN configured in a preview Worker, a controlled uncaught server error and a selected operational failure appear as Sentry events, while expected validation/authentication/domain outcomes do not.
- [ ] 1.4 The captured server events contain no user identifiers, request bodies, headers, or URL query strings.

### Phase 2: Browser Errors and Release Diagnostics

#### Automated

- [ ] 2.1 The GitHub Actions build succeeds without the production source-map opt-in and performs no Sentry source-map upload.
- [ ] 2.2 The production Cloudflare Workers Build succeeds with the source-map opt-in and Sentry build secret and reports a successful Sentry source-map upload.

#### Manual

- [ ] 2.3 A controlled browser error in a preview deployment appears as a `preview` event with its Cloudflare release identifier; production events are tagged `production`, and the browser event contains no user identifier, request body, headers, or URL query string.
- [ ] 2.4 A production Sentry event resolves to original source paths/lines rather than only bundled output.

### Phase 3: End-to-End and Operational Verification

#### Automated

- [ ] 3.1 The existing `npm run smoke` and `npm run test:authz` checks pass against the production preview with the local Supabase test setup.

#### Manual

- [ ] 3.2 A Sentry new-issue alert is configured to notify project members and fires for a controlled preview test event.
- [ ] 3.3 A preview event remains separate from production events, and local development with no Sentry DSN sends no event.
