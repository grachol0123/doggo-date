# 10x Astro Starter

![](./public/template.png)

A starter template for building Astro + React apps with Supabase auth, deployed to Cloudflare Workers.

## Tech Stack

- [Astro](https://astro.build/) v7
- [React](https://react.dev/) v19
- [TypeScript](https://www.typescriptlang.org/) v6
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Supabase](https://supabase.com/)
- [Cloudflare Workers](https://workers.cloudflare.com/)

See `package.json` for exact versions of all dependencies.

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm run smoke` - Smoke test the auth flow against a running server (`BASE_URL`, defaults to `http://localhost:4321`)

## Project Structure

See `src/` for the application code (layouts, pages, API routes under `pages/api/`, components, lib) and `wrangler.jsonc` for the Cloudflare Workers config.

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication, dog profiles, and photo storage. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Start the local stack (downloads Docker images on first run and applies the migrations in `supabase/migrations/`):

```bash
npx supabase start
```

3. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

4. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

The migrations create `public.dogs`, its row-level security policies, and the `dog-photos` storage bucket. If the database already existed before those migrations were added, apply them to that database before opening `/dashboard/dog`.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

To apply the migrations to the same hosted project referenced by `SUPABASE_URL`, link the Supabase CLI to that project and check the pending changes before pushing:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Do not use `supabase db reset` on a hosted database.

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

### Sentry

Sentry is optional locally: leave both DSNs blank to disable event reporting. `SENTRY_DSN` is the Worker runtime secret; put it in `.dev.vars` for local Cloudflare development and configure it separately for the production Worker and the `preview` Wrangler environment:

```bash
npx wrangler secret put SENTRY_DSN
npx wrangler secret put SENTRY_DSN --env preview
```

`PUBLIC_SENTRY_DSN` is a public, write-only Sentry DSN used by the browser bundle. Set it in `.env` for local builds and as a non-secret Cloudflare Workers Build variable for deployed builds. It is not an auth credential.

The root Wrangler configuration tags the default production Worker as `production` and defines the `preview` environment as `preview`. Configure the Workers Builds Preview command as `npx wrangler preview --env preview` so preview deployments use the preview bindings. Both environments use Cloudflare version metadata for their Sentry release identifier.

Sentry source maps are uploaded only by the production Cloudflare Workers Build. In that Worker's **Build variables and secrets**, set `SENTRY_ORG` and `SENTRY_PROJECT` to the Sentry organization and project slugs, set `SENTRY_PRODUCTION_BRANCH` to the Worker's configured production branch, and set `SENTRY_UPLOAD_SOURCE_MAPS` to `true`. Add `SENTRY_AUTH_TOKEN` as a **build secret** with source-map upload permission. The build additionally checks Cloudflare's `WORKERS_CI_BRANCH` against `SENTRY_PRODUCTION_BRANCH`; a token shared with preview builds cannot enable uploads there. Do not add `SENTRY_AUTH_TOKEN` to Wrangler variables/secrets, application runtime settings, or GitHub Actions. GitHub Actions builds do not deploy Workers or upload Sentry source maps.

Create the Sentry new-issue alert in the Sentry project UI and target project members for notifications.

#### Verify the Sentry setup

Before testing, confirm the production Worker has the runtime `SENTRY_DSN` secret and the browser build has the public `PUBLIC_SENTRY_DSN` variable. Configure the preview build separately with its own DSNs and `SENTRY_ENVIRONMENT=preview`; do not reuse the production DSN if production/preview issue separation is required. In **Workers & Pages > doggo-date > Settings > Builds**, enable preview builds and use `npx wrangler preview --env preview` when preview-specific Wrangler bindings are needed. Preview builds must not have `SENTRY_UPLOAD_SOURCE_MAPS=true`.

For a controlled preview check:

1. Confirm the preview URL is served by the `preview` environment and that production remains untouched.
2. On a temporary branch used only for preview, add a short-lived browser event-handler error and a short-lived uncaught server error. Do not include user data, request bodies, headers, cookies, or secrets in either test. Never add a permanent public test endpoint.
3. Trigger both errors on the preview URL. In Sentry, verify the events arrive as `preview`, include the Cloudflare release identifier, and contain no user/request data. Confirm the production issue stream remains separate.
4. For the closed M3L5 training deployment, use the opt-in lesson probes below to verify production source maps. Otherwise use an existing safe operational failure; do not enable lesson probes on a public deployment.
5. Configure a new-issue alert for project members and confirm it fires for the preview event.
6. Remove the temporary preview error code, then run `npm run lint`, `npm run build`, `npm run smoke`, and `npm run test:authz` before merging. With both DSNs absent locally, confirm the app starts normally and no Sentry event is received.

The production source-map upload gate requires all of `WORKERS_CI=1`, `SENTRY_UPLOAD_SOURCE_MAPS=true`, `SENTRY_PRODUCTION_BRANCH` matching Cloudflare's `WORKERS_CI_BRANCH`, and `SENTRY_AUTH_TOKEN`. Set `SENTRY_ORG` and `SENTRY_PROJECT` as build variables and `SENTRY_AUTH_TOKEN` as a build secret in Workers Builds. Cloudflare injects `WORKERS_CI` and `WORKERS_CI_BRANCH` for Workers Builds; verify the production build log reports the Sentry upload succeeded. Do not infer upload success solely from a green deployment.

#### Temporary M3L5 production probes

The lesson harness at `/sentry-preview-test` also works on the closed production training deployment. Both the page and `/api/sentry-preview-test` return 404 unless the **Worker runtime** binding `SENTRY_TEST_ENABLED` is exactly `true`. For this lesson release, `wrangler.jsonc` enables it in production and explicitly disables it in preview. Log in with an existing Supabase account. Server probes require an authenticated session and a same-origin POST; no data is written to Supabase.

After deploying this code, open `https://doggo-date.maciej-graszek.workers.dev/sentry-preview-test`. The browser, handled-server and uncaught-server buttons produce `SentryBrowserTestError`, `SentryHandledTestError` and `SentryUncaughtTestError` respectively. The server responses should be 503 and 500. Events retain the deployment's environment/release; production tests deliberately enter the production issue stream and may trigger notifications.

In Sentry, check the new **production** events for source-mapped original files/lines, redaction and alert delivery. SDK capture or an HTTP error alone does not prove ingestion or notification delivery. Set `SENTRY_TEST_ENABLED` to `false` in `wrangler.jsonc` and redeploy immediately afterward (a temporary runtime override must also be reflected in this file before the next deploy). Confirm both routes are unavailable; remove the harness before opening production to real users.

## Smoke test

`scripts/smoke.mjs` is a dependency-free Node script that walks the whole auth flow (sign-up, sign-in, protected page, sign-out) over HTTP. Run it against the dev server or the production preview after dependency upgrades:

```bash
npm run dev            # or: npm run build && npm run preview
BASE_URL=http://localhost:4321 npm run smoke
```

It needs a reachable Supabase instance (local or cloud) with email confirmation disabled.

> **Note:** this script exists primarily to guard the development of the starter itself — it is a fast sanity check that dependency upgrades did not break the build, the Cloudflare adapter or the Supabase auth flow. It is **not** a substitute for a real test suite. Once you build your own product on top of this starter, add proper tests (unit, integration, end-to-end) suited to your application.

## CI

GitHub Actions runs two jobs on every push and PR to `master`:

- **ci** — lint, `astro check` and build. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.
- **smoke** — starts a local Supabase via the Supabase CLI, builds, serves the production preview on the Cloudflare runtime and runs `npm run smoke` against it. No secrets required.

## License

MIT
