# Sentry Error Tracking — Plan Brief

> Full plan: `context/changes/sentry-integration/plan.md`
> Research: `context/changes/sentry-integration/research.md`

## What & Why

Doggo Date currently has no application-level error tracker; handled backend failures are usually returned to users without reaching an alerting system. This plan integrates Sentry on the existing Astro 7 / Cloudflare Workers stack so unexpected server and browser errors become actionable issues while keeping PII and request data out of event payloads.

## Starting Point

The app is an Astro SSR project with React islands, Supabase, and a Cloudflare Workers adapter. Cloudflare runtime observability is enabled, but `wrangler.jsonc` points directly to Astro's Worker entrypoint, and the app has no Sentry SDK. GitHub Actions runs builds and smoke/authz checks; Cloudflare Workers Builds handles production deployment.

## Desired End State

Sentry captures uncaught server and browser errors plus selected unexpected operational failures. Events distinguish production from preview and include a Cloudflare release identifier, with readable source-mapped stacks for production builds. A manual Sentry new-issue alert notifies project members; local development remains functional with Sentry disabled when no DSN is configured.

## Key Decisions Made

| Decision           | Choice                                                            | Why (1 sentence)                                                                            | Source              |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------- |
| Server integration | `@sentry/astro` + `@sentry/cloudflare`, custom Worker entrypoint  | This is the documented pattern for Astro 6+ and Cloudflare adapter v13+.                    | Research            |
| Server event scope | Uncaught exceptions plus selected unexpected operational failures | Captures meaningful failures without alerting on expected validation/auth/domain outcomes.  | Plan                |
| Browser capture    | Uncaught browser errors; no replay                                | Covers client-side React failures while limiting privacy and feature scope.                 | Plan                |
| Event privacy      | No user IDs, request bodies, headers, or URL query strings        | Maintains the explicit no-PII requirement.                                                  | Change notes / Plan |
| Environments       | Separate production and preview; local disabled by default        | Keeps preview diagnostics without mixing them with production issues.                       | Plan                |
| Source maps        | Sentry upload only from production Cloudflare Workers Builds      | Uploads maps from the build that actually deploys and keeps tokens out of GitHub Actions.   | Plan                |
| Alerting           | Manual Sentry new-issue alert to project members                  | Sentry project rules are configured outside this repository.                                | Plan                |
| Exclusions         | No tracing, replay, or Cloudflare source-map upload setting       | This change targets error monitoring; Cloudflare source-map upload is separate from Sentry. | Research / Plan     |

## Scope

**In scope:**

- Server and browser error monitoring with strict event redaction.
- Explicit capture of selected unexpected server/storage failures.
- Production/preview environment tagging and Cloudflare release metadata.
- Sentry source-map upload from the production Cloudflare build.
- Documentation for secrets, setup, verification, and manual issue alerts.

**Out of scope:**

- Performance tracing, session replay, and user feedback.
- Capturing expected client/domain failures or every Supabase error.
- GitHub Actions source-map upload, permanent test routes, and database changes.
- Committing credentials or sending PII/request content to Sentry.

## Architecture / Approach

The Astro Sentry integration instruments the Astro request pipeline. A single `sentry.server.config.ts` wraps the Cloudflare adapter handler and reads runtime secrets from Worker bindings; a separate `sentry.client.config.ts` captures browser errors using a public DSN. Cloudflare version metadata supplies release identity, environment variables distinguish production and preview, and Astro's build plugin uploads Sentry source maps only during production Cloudflare builds. Event filtering removes user/request data before transmission.

## Phases at a Glance

| Phase                                       | What it delivers                                                                | Key risk                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1. Server-Side Foundation and Error Capture | Server SDK, custom entrypoint, privacy filtering, selected operational captures | SDK middleware and manual captures must not duplicate issues or change existing responses |
| 2. Browser Errors and Release Diagnostics   | Browser SDK, release/environment tags, production Sentry source maps            | Cloudflare build secrets and source maps must match the deployed Worker                   |
| 3. End-to-End and Operational Verification  | Existing smoke/authz checks, manual Sentry alert, runtime verification          | Requires access to Sentry and Cloudflare build/runtime settings                           |

**Prerequisites:** A Sentry project with its runtime DSN; access to Cloudflare Workers Build settings for production and preview; an organization-scoped Sentry auth token for production source-map upload.
**Estimated effort:** Approximately 2–3 implementation sessions across three phases, plus access/configuration time for external dashboards.

## Open Risks & Assumptions

- The Sentry project and Cloudflare build/runtime settings are external prerequisites; credentials will be provisioned by an authorized project operator and not committed.
- Sentry alert rules are outside repository configuration and require a manual action in the Sentry UI.
- Cloudflare Workers may drop events if its `waitUntil` lifecycle limit is exceeded; the SDK cannot extend that platform limit.
- Exact free-tier quotas were not verified during research; confirm current Sentry plan limits separately if event volume grows.

## Success Criteria (Summary)

- Unexpected server and browser errors appear in Sentry, with production/preview and release tags, and no PII or request secrets.
- Production Cloudflare builds upload source maps so Sentry issues resolve to original source locations.
- Existing lint, build, smoke, and authorization checks pass, and the configured new-issue alert fires for a controlled preview event.
