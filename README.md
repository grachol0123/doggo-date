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
