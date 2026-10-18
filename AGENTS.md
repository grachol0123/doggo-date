# Rules for AI

This file provides guidance to AI agents when working with code in this repository.

Before starting work, also read `LESSONS_LEARNED.md` at the repo root — an incident log of concrete git/tooling pitfalls hit by prior AI agent sessions in this repo (shared working trees, background-agent git operations, Windows `git mv` failures, etc.) and the fixes applied. It complements `context/foundation/lessons.md` (durable planning/implementation rules used by the `/10x-*` skills).

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)
- `npm run smoke` — dependency-free auth-flow smoke test (`scripts/smoke.mjs`) against a running server, `BASE_URL` env (default `http://localhost:4321`). Run after dependency upgrades; CI runs it against the production preview with a local Supabase.

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 7 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

## The `context/` folder

Project knowledge managed by the `/10x-*` skills — read it before planning or implementing non-trivial work:

- `context/foundation/` — living, cross-change docs that outlive any single change: `prd.md` (product requirements), `roadmap.md`, `tech-stack.md`, `test-plan.md`/`test-stack.md`, `lessons.md` (durable planning/implementation rules), `infrastructure.md`. Edited in place as the project evolves; see `context/foundation/README.md` for conventions.
- `context/changes/<change-id>/` — one folder per in-flight change, created via `/10x-new` and identified by a `change.md` file. Holds that change's research, plan, and reviews. See `context/changes/README.md`.
- `context/archive/` — completed changes, moved here from `context/changes/` via `/10x-archive`. Read-only historical record.
- `context/audits/` — point-in-time audit reports (e.g. `observability/`) produced by audit skills, not routinely edited.

Don't confuse this with `LESSONS_LEARNED.md` at the repo root, which is a git/tooling incident log for AI agent sessions, not product/planning context.

## Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

### Container runtime: Podman, not Docker

This machine has **Podman** installed instead of Docker Desktop (no `docker` CLI
on PATH). The Supabase CLI (`npx supabase start`, used for the local dev stack
and E2E test-user setup) shells out to a Docker-compatible API, so point it at
Podman's exposed named pipe before running it:

```powershell
$env:DOCKER_HOST = "npipe:////./pipe/podman-machine-default"
npx supabase start
```

Ensure the machine is running first (`podman machine list` / `podman machine start`).
Without `DOCKER_HOST` set, `supabase start` fails trying to find Docker.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint + build on every push and PR to master. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.
<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — moduł 5, lekcja 4 (wspólny rejestr AI)

Udostępniaj umiejętności zespołu, prompty i reguły jako wersjonowany pakiet w rejestrze, który Twoja organizacja już posiada. GitHub Packages to domyślna ścieżka; AWS CodeArtifact z Terraform to opcjonalna ścieżka zarządzanej infrastruktury.

```
m5l4-shared-* -> m5l4-github-packages-spec-* + config templates -> publish -> npm install in consumer repos
```

### Router zadań — od czego zacząć

| Umiejętność / prompt / szablon                                                                                   | Użyj, gdy                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `m5l4-shared-conventions`, `m5l4-shared-spec-skill` (prompty)                                                    | Definiujesz pierwszą wspólną umiejętność zespołu i jej konwencje.                                                                                                                                  |
| `m5l4-github-packages-spec-pack`, `m5l4-github-packages-spec-cicd` (prompty) + `m5l4-github-packages-*.template` | Tworzysz domyślny pakiet: package.json, instalator i dezinstalator, konsumencki `.npmrc`, początkowy `rules/AGENTS.md` oraz workflow publikacji.                                                   |
| `/pack-init` -> `/tf-registry` -> `/setup-cicd`                                                                  | Opcjonalna ścieżka CodeArtifact: utwórz szkielet pakietu, skonfiguruj rejestr za pomocą Terraform, a następnie dodaj CI/CD. Odczytują specyfikacje `m5l4-*` z katalogu promptów Twojego narzędzia. |

### Twarde reguły

- **Nigdy nie nadpisuj tego, co napisał konsument.** Instalatory modyfikują wyłącznie pliki, które śledzą w swoim manifeście, i tylko tekst między ich znacznikami wartowniczymi.
- **Dezinstalacja usuwa dokładnie to, co dodała instalacja**, używając manifestu.
- **Publikuj tylko nową wersję.** Zwiększ wersję przed publikacją; rejestr odrzuca wersję, która już istnieje.
- **Tokeny pozostają w sekretach CI lub lokalnym env**, nigdy w zatwierdzonym `.npmrc`.

<!-- END @przeprogramowani/10x-cli -->
