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

## Zestaw narzędzi AI 10xDevs — Moduł 2, Lekcja 3

Przed scaleniem przejrzyj kod wygenerowany przez AI za pomocą **łańcucha przeglądu implementacji**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` jest głównym tematem lekcji. Przegląd jest bramką jakości, a nie poleceniem naprawienia każdego znaleziska.

### Router zadań — od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| **Przegląd kodu (główny temat lekcji)** | |
| `/10x-impl-review <change-id>` | Zaimplementowałeś kod i chcesz przeprowadzić ustrukturyzowany przegląd przed scaleniem. Umiejętność sprawdza zgodność z planem, dyscyplinę zakresu, bezpieczeństwo i jakość, architekturę, spójność wzorców oraz kryteria sukcesu, a następnie przedstawia znaleziska do triage. |
| **Rezultat powtarzającej się lekcji** | |
| `/10x-lesson` | Znalezisko ujawnia powtarzającą się regułę projektu lub wzorzec błędów agenta. Zapisz je w `context/foundation/lessons.md` zamiast traktować jako jednorazową notatkę. |

### Dyscyplina triage

- Severity określa, jak poważne jest znalezisko. Impact określa, jak duże znaczenie ma teraz decyzja.
- Prawidłowe rezultaty: napraw teraz, napraw inaczej, pomiń, zaakceptuj jako ryzyko, zapisz jako powtarzającą się regułę (`/10x-lesson`), nie zgódź się.
- Napraw krytyczne znaleziska. Nie poświęcaj godzin na obserwacje o niskim wpływie tylko dlatego, że agent je znalazł.
- Świadome pomijanie znalezisk o niskim wpływie jest prawidłowym wynikiem przeglądu, a nie zaniedbaniem.
- Jeśli nie zgadzasz się ze znaleziskiem, zapisz dlaczego. Błędne rozumowanie agenta również jest sygnałem.

### Granice przeglądu

- Ta lekcja dotyczy przeglądu zaimplementowanego kodu. Nie tworzy planu, nie wykonuje nowych faz ani nie uczy przeglądu CI.
- Strategia testowania i bramki jakości są wprowadzane w Module 3.
- W tej lekcji nie używaj `/10x-contract` jako wyniku triage.

### Ścieżki używane przez tę lekcję

- `context/changes/<change-id>/plan.md` — oczekiwany kontrakt implementacji
- `context/changes/<change-id>/reviews/` — wynik przeglądu
- `context/foundation/lessons.md` — powtarzające się lekcje

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: „Ta zmiana jest zarchiwizowana. Zamiast tego otwórz nową zmianę za pomocą `/10x-new`.”

<!-- END @przeprogramowani/10x-cli -->
