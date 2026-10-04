---
date: 2026-10-04T09:25:00+02:00
researcher: Copilot CLI
git_commit: d29e8f4
branch: develop
repository: grachol0123/doggo-date
topic: "Integrating Sentry error tracking into the Astro 7 SSR app on Cloudflare Workers"
tags: [research, observability, sentry, cloudflare, astro, error-handling]
status: complete
last_updated: 2026-10-04
last_updated_by: Copilot CLI
---

# Research: Integrating Sentry error tracking into the Astro 7 SSR app on Cloudflare Workers

**Date**: 2026-10-04T09:25:00+02:00
**Researcher**: Copilot CLI
**Git Commit**: d29e8f4
**Branch**: develop
**Repository**: grachol0123/doggo-date

## Research Question

How should Sentry be integrated into this Astro 7 SSR app, deployed to Cloudflare
Workers via `@astrojs/cloudflare`, given the current conventions for env/secrets
and the current state of error handling in the codebase? This follows from the
2026-10-04 observability audit (`/10x-observability-audit`), which found no
error-tracker SDK anywhere in the code — only `console.error` calls reaching
Cloudflare Workers runtime logs with no alerting.

## Summary

The codebase has **zero error-tracker SDK usage** today (confirmed by a repo-wide
search for `Sentry|@sentry|datadog|rollbar|bugsnag|honeybadger|opentelemetry|
Application Insights|captureException`, which only matched documentation/skill
files, never `src/`). Error handling is uniform and shallow: API routes check
Supabase `{ error }` results and convert them into JSON responses (exposing only
`error.message`, discarding the original error object/stack) or redirects;
malformed-JSON bodies are caught and turned into 400s without logging; two
cleanup/rollback failures in `src/pages/api/dogs/save.ts` are logged with
`console.error` but don't change the response; `src/middleware.ts` ignores the
`error` returned by `supabase.auth.getUser()`; and the Realtime subscription in
`src/components/dog/MessageThread.tsx` has no error handling on subscribe/receive
callbacks. There is no global error page (`404.astro`/`500.astro`).

For this exact stack — Astro `^7.3.2` (`output: "server"`), `@astrojs/cloudflare`
`^14.3.1`, `wrangler` `^4.131.1` with `compatibility_date: "2026-05-08"` and
`compatibility_flags: ["nodejs_compat"]` — Sentry's own documentation requires
**both** `@sentry/astro` and `@sentry/cloudflare` together (current `latest`
dist-tag `11.4.0` for both), using the **custom-entrypoint pattern**: a new
`sentry.server.config.ts` at the project root wraps
`@astrojs/cloudflare/entrypoints/server`'s default export with
`Sentry.withSentry(...)`, and `wrangler.jsonc`'s `main` is repointed to that file.
Astro's own middleware/API-route pipeline is then **auto-instrumented** by
`@sentry/astro`'s injected middleware (`auto.middleware.astro` mechanism) — no
code changes are required in `src/middleware.ts` or `src/pages/api/**` for
baseline uncaught-exception capture. Event flushing before Worker isolate
teardown is handled internally by the SDK via `ctx.waitUntil` wrapping, bounded
by Cloudflare's hard 30-second `waitUntil` ceiling.

The project's existing `nodejs_compat` flag and `compatibility_date` already
satisfy the SDK's `AsyncLocalStorage` requirement (needs `2024-09-23`+). DSN
should be supplied via a Wrangler secret (`SENTRY_DSN`, `.dev.vars` locally,
`wrangler secret put` in prod) read through the `env` argument Sentry's
`withSentry` callback receives — not through the existing `astro:env/server`
mechanism, since `sentry.server.config.ts` becomes the Worker's `main` and runs
before Astro's own env-resolution context is available. Release tagging can be
fully automatic via a `version_metadata` Wrangler binding (`CF_VERSION_METADATA`)
with zero CI changes. Source maps require the bundled `@sentry/bundler-plugins`
machinery (configured via `sentry()` integration options in `astro.config.mjs`)
plus `"upload_source_maps": true` in `wrangler.jsonc`.

One upstream caveat (open as of 2026-10-03, PR #25016 in sentry-javascript) notes
a double-init/span-drop issue when both Astro's default Node-style init and the
Cloudflare wrapper try to initialize Sentry — avoidable by keeping init solely in
`sentry.server.config.ts` and not adding a stray `sentry.server.config.*`
auto-picked-up-by-Astro file. Span durations are permanently `0ms` on Workers
(a platform-level timing-attack mitigation, not an SDK bug) — tracing-latency
features should not be relied on, though error capture is unaffected.

## Detailed Findings

### Current error-handling surface (8 API route files total)

- `src/pages/api/swipes/index.ts:38-42` — catches malformed `request.json()`,
  swallows the exception, returns `{status:"invalid"}` HTTP 400.
- `src/pages/api/messages/index.ts:137-141` — same pattern, `{status:"invalid_body"}`.
- `src/pages/api/dogs/save.ts:42-57` — catches malformed JSON form field,
  swallows it, falls through to comma-delimited parsing (intentional fallback).
- `src/pages/api/dogs/save.ts:206` — `console.error("Failed to delete uploaded dog
photo after save error", rollbackError)`, response unaffected.
- `src/pages/api/dogs/save.ts:217` — `console.error("Failed to delete replaced dog
photo", cleanupError)`, response unaffected.
- 3 of 8 API route files contain at least one `try/catch`
  (`swipes/index.ts`, `messages/index.ts`, `dogs/save.ts`); the other 5
  (`matches/index.ts`, `dogs/next-candidate.ts`, and the remaining route files)
  handle only Supabase `{ error }` checks without a `try/catch` wrapper, per this
  inspected set of 8 files.
- No `console.warn` or `console.log` calls exist under `src/`, per this inspected
  tree (excluding `node_modules`/`dist`/`.astro`).

### Supabase error handling

- `src/lib/supabase.ts:6-8` and `src/lib/supabase-browser.ts:5-9` — return `null`
  when config is missing; no catch/log.
- No `src/lib/services/` directory exists — all Supabase `{ data, error }`
  handling happens directly inline in API routes and one Astro page
  (`src/pages/dashboard/dog.astro:23-29`).
- `src/middleware.ts:9-14` calls `supabase.auth.getUser()` and discards its
  `error` field entirely (only `data.user` is read).
- Across the inspected API routes, returned error payloads expose only
  `error.message` — the original Supabase error object (code, hint, details) and
  any stack are discarded before reaching the response, per the cited lines in
  `swipes/index.ts`, `matches/index.ts`, `messages/index.ts`, and
  `dogs/save.ts`.

### Realtime (background, non-request-response) path

- `src/components/dog/MessageThread.tsx:195-213` — establishes a Supabase
  Realtime channel subscription; `setAuth()` and `removeChannel()` calls are
  fire-and-forget (`void ...`) with no rejection handling, and the `.subscribe()`
  callback does not check subscription status/error, per this inspected
  component.

### No global error page

- No `src/pages/404.astro`, `500.astro`, or equivalent exists in this repository,
  per this inspected `src/pages/` tree (only `index.astro` and `dashboard.astro`
  at the top level, plus `auth/` and `dashboard/` subdirectories).

### Sentry package requirements for this exact stack

- Plain `@sentry/astro` alone is documented as Node-runtime-only and explicitly
  insufficient for Cloudflare Workers deployments — Sentry's Astro docs direct
  Cloudflare users to a separate "Astro on Cloudflare" guide
  (docs.sentry.io/platforms/javascript/guides/astro/, fetched 2026-10-04).
- The "Astro on Cloudflare" guide requires Astro `6.0.0`+, `@astrojs/cloudflare`
  v13+, `@sentry/astro` v10.40.0+, and `@sentry/cloudflare` v10.40.0+ — this
  project's Astro `^7.3.2` and `@astrojs/cloudflare` `^14.3.1` both clear those
  floors (docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro/,
  fetched 2026-10-04).
- npm registry confirms both packages' `latest` dist-tag is `11.4.0`
  (registry.npmjs.org/@sentry/astro and /@sentry/cloudflare, fetched 2026-10-04).
- Because `@astrojs/cloudflare` is v13+ in this project, the applicable pattern
  is the **custom entry point** (`sentry.server.config.ts` as the Worker's
  `main`), not the older auto-wrap-via-env-vars-only pattern used for
  `@astrojs/cloudflare` v12 and below.

### Minimal integration shape (per upstream docs)

| File                                          | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `astro.config.mjs`                            | Add `sentry()` to `integrations: []` alongside the existing `cloudflare()` adapter; optionally pass `org`/`project`/`authToken` for source-map upload.                                                                                                                                                                                                                                                                                                                                                                               |
| `sentry.server.config.ts` (new, project root) | Becomes the Worker's `main` (set via `wrangler.jsonc`). Wraps `@astrojs/cloudflare/entrypoints/server`'s default export with `Sentry.withSentry((env) => ({ dsn: env.SENTRY_DSN, tracesSampleRate: ... }), handler)`.                                                                                                                                                                                                                                                                                                                |
| `sentry.client.config.ts` (new, project root) | Browser-side `Sentry.init({ dsn: ... })` for the React 19 islands / client errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `wrangler.jsonc`                              | Add `"main": "./sentry.server.config.ts"`; add `"version_metadata": {"binding": "CF_VERSION_METADATA"}` for automatic release tagging; add `"upload_source_maps": true`; keep `SENTRY_DSN` in `.dev.vars` locally and as a `wrangler secret put` value in prod.                                                                                                                                                                                                                                                                      |
| `src/pages/api/**/*.ts`, `src/middleware.ts`  | No required changes for baseline uncaught-exception capture — `@sentry/astro`'s injected middleware auto-captures errors thrown in the Astro render/middleware/API-route pipeline (mechanism tag `auto.middleware.astro`). Manual `Sentry.captureException(...)` calls are only needed where a _handled_ error (one already caught in application code, e.g. the Supabase `{ error }` branches and the two `dogs/save.ts` rollback/cleanup catches) should still be reported, since those are swallowed/logged rather than rethrown. |

### DSN and secrets channel (uncertain idiom, flagged for the plan)

- `sentry.server.config.ts`'s `withSentry` callback receives `env` directly
  (`(env) => ({ dsn: env.SENTRY_DSN, ... })`), independent of the project's
  existing `astro:env/server` mechanism — this is necessary because the Sentry
  wrapper file runs as the Worker's `main`, before Astro's own env-resolution
  context exists.
- For reading Worker bindings _elsewhere_ in the app (if ever needed alongside
  Sentry), Astro's adapter docs (fetched 2026-10-04) document
  `cloudflare:workers`'s `env` export and `astro:env/server` as the current
  idioms; `context.locals.runtime.env` is not mentioned on the fetched page and
  should be treated as unverified/legacy for the pinned `@astrojs/cloudflare@14.3.1`
  — worth a smoke test rather than an assumption if the plan ends up needing it.
- Client-side DSN: Sentry DSNs are not secret (public, write-only), so it is
  conventional to inline it or expose it via a `PUBLIC_SENTRY_DSN`-style var,
  consistent with this repo's existing `PUBLIC_`-prefix convention for
  client-exposed values (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` in
  `astro.config.mjs`).

### Release/environment and source maps

- Release can be fully automatic via a `version_metadata` Wrangler binding
  (`{"version_metadata": {"binding": "CF_VERSION_METADATA"}}`) with no CI step —
  Cloudflare's own deployment version ID becomes the Sentry release.
- `environment` has no auto-detection; set explicitly via `SENTRY_ENVIRONMENT`
  per Wrangler environment block, or hardcode conditionally in the two Sentry
  config files.
- Source maps need `"upload_source_maps": true` in `wrangler.jsonc` plus
  `org`/`project`/`authToken` passed to the `sentry()` Astro integration (token
  conventionally supplied via a `.env.sentry-build-plugin` file, auto-read by
  the bundled Sentry build plugin without extra config wiring).

### Known platform caveats

- `nodejs_compat` + `compatibility_date >= 2024-09-23` is a hard requirement for
  `AsyncLocalStorage`; this project's `compatibility_date: "2026-05-08"` and
  `compatibility_flags: ["nodejs_compat"]` already satisfy it.
- Span durations read `0ms` on Cloudflare Workers (timing-attack mitigation,
  not an SDK bug) — affects tracing/latency features uniformly across
  frameworks on Workers, not error capture.
- A double-init/span-drop issue is tracked upstream (sentry-javascript#23809,
  PR #25016, open as of 2026-10-03) when both Astro's default init path and the
  Cloudflare wrapper initialize Sentry; avoided by keeping init solely in the
  one `sentry.server.config.ts` custom entry point.
- Events still in flight when Cloudflare's 30-second `waitUntil` ceiling is hit
  are dropped; this is a hard platform limit the SDK cannot exceed, not
  something a config change can fix.
- Whether `@sentry/astro`'s integration also wires in the Vite-plugin-only
  `buildTimeInstrumentation` (needed to get spans for bundled dependencies like
  the Supabase client, as opposed to error capture) is **not confirmed** in the
  docs reviewed — flagged as an open question below; does not affect baseline
  error-capture functionality.

## Code References

- `src/pages/api/swipes/index.ts:38-42,57-66,72-85,92-99` — malformed-body catch and Supabase error checks.
- `src/pages/api/messages/index.ts:85-91,96-112,115-125,137-141,161-168,176-190` — malformed-body catch and Supabase error checks.
- `src/pages/api/dogs/save.ts:42-57,161-168,182-189,197-212,214-219` — malformed-JSON fallback and rollback/cleanup logging.
- `src/pages/api/matches/index.ts:43-48,57-62,71-75` — Supabase error checks, no `try/catch`.
- `src/pages/api/dogs/next-candidate.ts:35-109` — Supabase error checks, no `try/catch`.
- `src/pages/dashboard/dog.astro:23-29` — page-level Supabase error check.
- `src/middleware.ts:1-25` — only middleware file in the repo; ignores `getUser()`'s `error`.
- `src/lib/supabase.ts:6-8`, `src/lib/supabase-browser.ts:5-9` — client factories, no error handling.
- `src/components/dog/MessageThread.tsx:195-213` — unhandled Realtime subscription/cleanup.
- `astro.config.mjs:1-21` — current `env.schema` convention (`envField.string`) and adapter wiring.
- `wrangler.jsonc:1-13` — current `main`, `compatibility_date`, `compatibility_flags`, `observability.enabled`.
- `package.json:19,29,61` — pinned versions: `@astrojs/cloudflare ^14.3.1`, `astro ^7.3.2`, `wrangler ^4.131.1`.

## Architecture Insights

- The dominant error-handling pattern across this inspected codebase is
  "check-and-flatten": Supabase `{ error }` results are checked and converted
  directly into JSON responses or redirects carrying only `error.message`,
  with no logging and no distinction between error classes beyond a few
  special-cased Postgres error codes (`swipes/index.ts`, `messages/index.ts`).
  This matches the "flattened-response" and "identity-lost" categories from the
  observability audit's gap taxonomy.
- The two existing `console.error` calls (both in `dogs/save.ts`, for
  rollback/cleanup failures) are the only places any error is surfaced beyond
  an HTTP response — and neither changes the response, so they are purely a
  server-log artifact with no alerting path today.
- Sentry's recommended integration shape for this exact Astro+Cloudflare
  combination requires almost no changes to existing application code (no
  touching `src/middleware.ts` or any `src/pages/api/**` file for baseline
  capture) because the auto-injected middleware wraps the whole render/API
  pipeline — the main new surface area is two new root-level config files plus
  `wrangler.jsonc` additions, which keeps the integration isolated from the
  "check-and-flatten" pattern described above. Reporting the already-swallowed
  Supabase errors (to upgrade them from flattened-response to captured) would
  still require deliberate, separate follow-up edits inside those routes.

## Historical Context (from prior changes)

- `context/foundation/infrastructure.md:72,92,94` — Sentry was already
  recommended (not implemented) as mitigation for three separate risks: no
  built-in error/limit alerting on Cloudflare's free plan, no `wrangler tail`
  access without the paid plan, and no built-in silent-failure alerting. This
  change directly closes that previously-identified gap.
- No other `context/changes/**/` or `context/archive/**/` folder references
  Sentry, monitoring, or observability implementation work, per a repo-wide
  search for `Sentry|sentry` limited to `context/foundation/infrastructure.md`
  as the only non-skill, non-audit match.

## Related Research

- `context/audits/observability/` — no report file was persisted this run (the
  observability audit was paused before Step 6 in favor of this change); the
  capture-model findings gathered during that paused audit (no tracker SDK
  anywhere in `src/`, confirmed via the same repo-wide search cited above) are
  the direct trigger for this research and are restated in the Summary above.

## Open Questions

- Whether `context.locals.runtime.env` is still a valid Worker-binding read
  idiom for the pinned `@astrojs/cloudflare@14.3.1` (the fetched adapter docs
  page documents `cloudflare:workers`'s `env` export and `astro:env/server`
  instead) — resolve with a quick smoke test if the plan needs a binding-read
  path outside the Sentry config files.
- Whether `@sentry/astro`'s integration also wires in Vite-plugin-level
  `buildTimeInstrumentation` for tracing bundled dependencies (e.g. the
  Supabase client) — unconfirmed in the docs reviewed; irrelevant to baseline
  error capture, relevant only if dependency-level tracing becomes a goal.
- Exact current free-tier event/quota limits on Sentry's Developer plan were
  not confirmed (pricing page renders its comparison table via client-side JS
  that could not be scraped) — confirm directly on sentry.io/pricing before
  assuming the free tier covers expected traffic.
