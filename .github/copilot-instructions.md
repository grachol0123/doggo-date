# Copilot Instructions — 10x Astro Starter

## Commands

- `npm run dev` — dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` / `npm run lint:fix` — ESLint (type-checked rules)
- `npm run format` — Prettier (astro + tailwind plugins)
- `npm run smoke` — dependency-free auth-flow smoke test (`scripts/smoke.mjs`) against a running server (`BASE_URL`, default `http://localhost:4321`). There is no unit/integration test suite in this repo — this smoke test is the only automated check beyond lint/build; run it after dependency upgrades.

Pre-commit (husky + lint-staged): `eslint --fix` on `*.{ts,tsx,astro}`, `prettier --write` on `*.{json,css,md}`.

CI (`.github/workflows/ci.yml`) runs lint + build on every push/PR to `master`, and a separate job runs the smoke test against a local Supabase + production preview.

## Architecture

Astro 7 **SSR app** (`output: "server"`) with React 19 islands, Tailwind 4, Supabase auth, shadcn/ui, deployed to Cloudflare Workers. API routes must export `const prerender = false`.

**Auth flow** — the pattern to follow when adding protected features:
- `src/lib/supabase.ts` — Supabase SSR client (`@supabase/ssr`, cookie-based sessions). Reads `SUPABASE_URL`/`SUPABASE_KEY` via `astro:env/server` (declared as server-only secrets in `astro.config.mjs` `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user onto `context.locals.user`, and redirects unauthenticated requests away from paths listed in `PROTECTED_ROUTES`. Add new protected paths to that array.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- `src/pages/dashboard.astro` is the reference protected page.

## Key conventions

- Path alias `@/*` → `./src/*`.
- Astro components for static content/layout; React components only where interactivity is needed. No Next.js directives (`"use client"`, etc.) — extract hooks to `src/components/hooks/`.
- Use the `cn()` helper (`@/lib/utils`, clsx + tailwind-merge) for conditional/merged Tailwind classes instead of concatenating strings.
- shadcn/ui components live in `src/components/ui/` ("new-york" variant); add new ones via `npx shadcn@latest add [name]`.
- API routes use uppercase `GET`/`POST` exports and validate input with zod.
- Supabase migrations go in `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`; always enable RLS with granular per-operation, per-role policies.
- Shared types/DTOs live in `src/types.ts`; business logic/services go in `src/lib/` (or `src/lib/services/`).

## Environment

- Node v22.14.0 (`.nvmrc`).
- `SUPABASE_URL`/`SUPABASE_KEY` go in `.env` (Node) or `.dev.vars` (Cloudflare local dev, gitignored).
- Local Supabase: `npx supabase start` (requires Docker); disable "Confirm email" in the Supabase dashboard for local sign-up/sign-in without email verification.
- Deploy: `npx wrangler deploy` (secrets set via Cloudflare dashboard or `wrangler secret put`).

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs - Moduł 2, Lekcja 1

Przejdź od konfiguracji sprint-zero do orkiestracji projektu za pomocą **łańcucha roadmapy**:

```
(Module 1 foundation docs) -> /10x-roadmap -> backlog-ready roadmap items
```

`/10x-roadmap` jest głównym tematem lekcji. `/10x-new` jest celowo wprowadzane w Module 2, Lesson 2, gdy wybrany element roadmapy staje się folderem zmiany implementacyjnej.

### Router zadań - Od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| **Roadmapa (główny temat lekcji)** | |
| `/10x-roadmap` | Masz `context/foundation/prd.md` oraz bazę projektu ze szkieletem i potrzebujesz roadmapy MVP z podejściem vertical-first. Umiejętność odczytuje PRD, sprawdza bazę kodu, korzysta z dostępnych dokumentów fundamentowych, takich jak `tech-stack.md`, `infrastructure.md` i `deploy-plan.md`, a następnie zapisuje `context/foundation/roadmap.md`. Użyj jej PRZED tworzeniem folderów dla poszczególnych zmian lub planów implementacji. |
| **Ponownie uruchom wcześniejsze kroki, jeśli to konieczne** | |
| `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-agents-md` / `/10x-infra-research` | Zebrane z Module 1, aby kontrakty fundamentowe można było poprawić przed sekwencjonowaniem roadmapy. Jeśli generowanie roadmapy ujawni lukę w PRD, popraw PRD, zanim uznasz, że backlog jest gotowy. |

### Jak łańcuch przekazuje dalej

- `/10x-roadmap` łączy produkt z implementacją. Nie wybiera frameworków, nie projektuje schematów ani nie pisze planu implementacji dla poszczególnych zmian.
- Wynikiem jest `context/foundation/roadmap.md`: uporządkowane kamienie milowe, vertical slices, ograniczone fundamenty, zależności, niewiadome, ryzyko oraz pola przekazania do backlogu.
- Elementy roadmapy powinny otrzymać stabilne, czytelne dla człowieka identyfikatory w narzędziach backlogu. Właściwy folder `context/changes/<change-id>/` jest tworzony w Lesson 2 za pomocą `/10x-new`.

### Granice roadmapy

- Domyślnie stosuj vertical slices: widoczne dla użytkownika rezultaty obejmujące UI, dane, logikę biznesową i integracje.
- Praca horyzontalna jest dozwolona wyłącznie jako ograniczony enabler, który wskazuje odblokowywany przez siebie późniejszy pionowy kamień milowy.
- Unikaj osieroconej pracy horyzontalnej, takiej jak „zbuduj całą bazę danych”, „zbuduj wszystkie endpointy API” lub „zaprojektuj całe UI” przed pierwszym widocznym dla użytkownika przepływem.
- Roadmapa nie jest estymacją kalendarzową. Nie wymyślaj dat, story points ani velocity sprintu, chyba że użytkownik wyraźnie prosi o osobny artefakt planistyczny.

### Ścieżki fundamentów używane przez tę lekcję

- `context/foundation/prd.md` - wejście
- `context/foundation/tech-stack.md` - opcjonalne wejście
- `context/foundation/infrastructure.md` - opcjonalne wejście
- `context/deployment/deploy-plan.md` - opcjonalne wejście
- `context/foundation/roadmap.md` - wyjście
- `context/foundation/lessons.md` - powtarzające się reguły i pułapki
- `docs/reference/contract-surfaces.md` - rejestr kluczowych nazw

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozstrzygnięta ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
