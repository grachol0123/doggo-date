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

## 10xDevs AI Toolkit - Moduł 3, Lekcja 1

Rozpocznij Moduł 3 od przygotowania **trwałego, opartego na ryzyku kontraktu jakości** przed napisaniem jakiegokolwiek testu — następnie prowadź każdą fazę wdrożenia przez standardowy łańcuch zmian.

```
PRD + roadmap + archive
        │
        ▼
   /10x-test-plan  ──►  context/foundation/test-plan.md  (strategy §1–§5 frozen + cookbook §6 grows)
        │
        ▼  (one rollout phase at a time, /clear between handoffs)
   /10x-new ──► /10x-research ──► /10x-plan ──► /10x-implement
```

`/10x-test-plan` jest **stanowym orkiestratorem**, a nie jednorazowym generatorem. Przy pierwszym uruchomieniu zapisuje etapowe wdrożenie do `context/foundation/test-plan.md`. Przy każdym kolejnym uruchomieniu ponownie wyprowadza stan z artefaktów na dysku i przedstawia następne przekazanie. Tematem lekcji są **strategia i sekwencjonowanie wdrożenia, nie konfiguracja**. Hooki, serwery MCP i YAML CI są konfigurowane w późniejszych lekcjach tego modułu.

### Router zadań - od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| **Strategia jakości jako plik reguł (temat lekcji)** | |
| `/10x-test-plan` | Masz PRD (a najlepiej także roadmapę i kilka zarchiwizowanych zakresów) i zamierzasz napisać pierwsze testy projektu albo zauważyłeś, że testy generowane przez AI trafiają do funkcji pomocniczych, podczas gdy krytyczne przepływy pozostają niepokryte. Pierwsze wywołanie uruchamia discovery (PRD + roadmap + archive + skan hot-spotów), wywiad z użytkownikiem z 5 pytaniami oraz etap syntezy z obowiązkową kontrolą przez challengera, a następnie zapisuje `test-plan.md` w `context/foundation/` z mapą ryzyk (5–7 scenariuszy awarii), tabelą etapowego wdrożenia, tabelą stosu, tabelą bramek jakości, sekcją cookbook (`§6`, wypełnianą wraz z dostarczaniem faz) oraz sekcją negative-space (czego świadomie nie testujemy). Kolejne wywołania przesuwają wdrożenie o jedno przekazanie na raz. |
| `/10x-test-plan --status` | `test-plan.md` już istnieje i chcesz uzyskać zwięzły obraz stanu wdrożenia — które fazy są `not started`, `change opened`, `researched`, `planned`, `implementing` lub `complete` oraz jakie jest następne działanie. Nie wykonuje pracy; można bezpiecznie uruchomić w dowolnym momencie. |
| `/10x-test-plan --refresh` | `test-plan.md` już istnieje i wystąpiło jedno z następujących zdarzeń: nowe ryzyko z top 3 wynika z roadmapy lub archive, data `checked:` narzędzia jest starsza niż trzy miesiące, stos technologiczny projektu się zmienił albo negative-space w §7 nie odpowiada już temu, w co wierzy zespół. Otwiera nowy folder zmiany `test-plan-refresh-<YYYY-MM-DD>` zamiast edytować przewodnik w miejscu. |

### Łańcuch wdrożenia — co dzieje się po napisaniu przewodnika

Tabela §3 *Phased Rollout* przewodnika jest stanem orkiestratora. Dla każdego wiersza nieoznaczonego jako `complete` orkiestrator wybiera następne przekazanie na podstawie tego, które artefakty istnieją w `context/changes/<change-id>/`:

| Stan na dysku | Następne przekazanie | Status przechodzi na |
| --- | --- | --- |
| brak folderu zmiany | `/10x-new <change-id>` | `change opened` |
| tylko `change.md` | `/10x-research` (z opisem ryzyk do zweryfikowania) | `researched` |
| `+ research.md` | `/10x-plan` (z ograniczeniami cost × signal + aktualizacji cookbooka) | `planned` |
| `+ plan.md` z oczekującymi elementami `## Progress` | `/10x-implement <change-id> phase <N>` | `implementing` / `complete` |
| `+ plan.md` w pełni `[x]` | Oznacz wiersz §3 jako `complete`; przejdź w pętli do następnego oczekującego wiersza | — |

Każde przekazanie jest punktem **STOP**. Orkiestrator kopiuje następne polecenie do schowka, prosi użytkownika o wykonanie `/clear` i uruchomienie go, a następnie kończy działanie. Ponownie wywołaj `/10x-test-plan` (bez argumentów), aby przejść dalej.

### Reguły priorytetyzacji opartej na ryzyku

- Ryzyka to **scenariusze awarii w kategoriach użytkownika / biznesu**, a nie nazwy testów. „Wylogowany użytkownik uzyskuje dostęp do płatnej treści przez nieaktualny token” jest ryzykiem; „przetestuj formularz logowania” nim nie jest.
- Od 5 do 7 ryzyk. Mniej oznacza zbyt duże uogólnienie; więcej czyni priorytetyzację bezużyteczną.
- Wpływ i prawdopodobieństwo są ocenami użytkownika/biznesu, a nie złożoności technicznej.
- Każde ryzyko odwołuje się do źródła: sekcji PRD, zarchiwizowanego zakresu, wpisu roadmapy, pytania wywiadu z Fazy 2, katalogu hot-spot z liczbą zmian lub ograniczenia stosu technologicznego. Żadnych wymyślonych ryzyk.
- **Sygnał, nie wiedza.** §2 cytuje *dowody, które zwiększyły ryzyko*, nigdy plik jako „miejsce występowania awarii”. Kotwice plik:linia, nazwy funkcji, nazwy schematów i nazwy modułów są zabronione w §2 — należą do wyniku `/10x-research`, tworzonego dla każdej fazy wdrożenia względem aktualnego kodu. Plan jest specyfikacją QA; nie jest audytem kodu.
- Pokrycie nie jest metryką. Metryką jest **pokrycie ryzyk**.

### Reguły mapowania dwóch warstw

- Najpierw warstwa klasyczna: wygrywa najtańszy test, który daje rzeczywisty sygnał. Promuj do e2e tylko wtedy, gdy żadna tańsza warstwa nie pokrywa ryzyka.
- Następnie warstwa AI-native i tylko tam, gdzie daje sygnał, którego testy klasyczne nie zapewniają tanio.
- Każdy wiersz AI-native zawiera linię **„When NOT to use”**. Jeśli nie potrafisz jej napisać, usuń wiersz.
- Każda nazwa narzędzia zawiera datę `checked: <YYYY-MM-DD>`. Nazwy narzędzi są przykładami kategorii, a nie rekomendacjami.
- Obie warstwy muszą być niepuste w końcowym przewodniku, jeśli projekt ich wymaga. Tylko klasyczne testy to plan z 2020 roku; tylko AI-native to hype. Fazy AI-native nie są obowiązkowe — uwzględniaj je tylko wtedy, gdy uzasadnia je brief w ramach cost × signal.

### Reguły bramek jakości

- Wymagane bramki (lint, typecheck, unit+integration, e2e dla krytycznych przepływów) muszą być mapowane na rzeczywiste kroki CI. Jeśli wymagana bramka nie jest jeszcze podłączona, oznacz ją jako `required after §3 Phase <N>` i pozwól wskazanej fazie wdrożenia ją podłączyć.
- Hook po edycji jest **zalecany lokalnie**, nie stanowi zamiennika CI.
- Wielomodalny przegląd wizualny jest **selektywny**, stosowany do 1–3 krytycznych ekranów, a nie do każdej strony.
- Fallback sterowany wizją (Anthropic Computer Use lub OpenAI CUA) jest zarezerwowany dla powierzchni niedostępnych przez DOM; kosztowny na akcję.

### Wzorce cookbook (§6) — wypełniane z czasem

`test-plan.md` jest zarówno etapową strategią, jak i **rosnącym cookbookiem**. §6 zaczyna jako placeholdery (`TBD — see §3 Phase <N>`) i jest wypełniany stopniowo — plan każdej fazy wdrożenia kończy się podfazą aktualizującą odpowiedni wpis §6 (lokalizacja, nazewnictwo, test referencyjny, polecenie uruchomienia). Po ukończeniu Modułu 3 §6 staje się kanoniczną odpowiedzią na pytanie „jak dodać test dla X w tym projekcie?” — i to właśnie czyta `/10x-tdd` w Lekcji 2.

### Granice lekcji

- Nie pisz kodu testów. To temat Lekcji 2 (`/10x-tdd` i tworzenie testów jednostkowych).
- Nie konfiguruj hooków, cyklu życia hooków ani hooków debugowania. To temat Lekcji 3.
- Nie konfiguruj serwerów MCP, Playwright API, kodu e2e ani kodu scenariuszy wielomodalnych. To temat Lekcji 4.
- Nie uruchamiaj przepływu pracy od błędu przez poprawkę do testu regresyjnego. To temat Lekcji 5.
- Nie twórz od podstaw pipeline'ów CI/CD ani nie pisz YAML GitHub Actions. Przewodnik wskazuje bramki; konfiguracja należy do Modułu 1 Lekcji 5 i Modułu 2 Lekcji 5.
- Nie porównuj modeli wielomodalnych. Cytuj kryteria (koszt, opóźnienie, przyjazność dla agentów), nigdy ranking.
- Nie czytaj kodu dla zdobycia wiedzy (grafy wywołań, schematy, „który plik odpowiada za tę awarię”). To zadanie `/10x-research`, wykonywane dla każdej fazy wdrożenia.

### Ścieżki używane w tej lekcji

- `context/foundation/test-plan.md` — kontrakt jakości tworzony i utrzymywany przez `/10x-test-plan`
- `context/foundation/prd.md` — podstawowe źródło ryzyk
- `context/foundation/roadmap.md` — ważenie prawdopodobieństwa
- `context/foundation/tech-stack.md` — dane wejściowe stosu technologicznego (jeśli istnieje)
- `context/archive/<change-id>/plan.md` — wdrożona powierzchnia ryzyka
- `context/changes/<change-id>/` — folder zmiany dla każdej fazy wdrożenia (jeden na wiersz w §3)

<!-- END @przeprogramowani/10x-cli -->
