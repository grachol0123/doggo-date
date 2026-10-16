# Brief: first-message — Pierwsza wiadomość w dopasowaniu (S-03)

📄 Pełny plan: [plan.md](./plan.md)

## What & Why

Właściciele dwóch dopasowanych psów mogą wymieniać proste wiadomości tekstowe w czasie rzeczywistym (PRD FR-006).
To "north star" slice S-03 — pierwsza funkcja, w której dopasowanie przeradza się w rzeczywistą interakcję między
użytkownikami, nie tylko listę kart.

## Starting Point

- `matches`/`swipes` już istnieją i działają (`match-data-foundation`); `MatchesList.tsx` pokazuje listę dopasowań
  z **wyłączonym** przyciskiem "Napisz wiadomość" (`src/components/dog/MatchesList.tsx:228-230`) — świadomie
  przygotowanym jako punkt wejścia na przyszłość.
- W repozytorium nie istnieje żaden przeglądarkowy klient Supabase ani publiczna zmienna środowiskowa — tylko
  serwerowy klient oparty o ciasteczka (`src/lib/supabase.ts`). To nowy grunt wymagany dla Realtime w przeglądarce.
- Brak tabeli `messages` i jakiejkolwiek logiki wiadomości.

## Desired End State

Kliknięcie "Napisz wiadomość" na karcie dopasowania otwiera `/dashboard/messages/[matchId]` z historią wiadomości i
polem wysyłki. Nowe wiadomości pojawiają się u obu uczestników natychmiast (Supabase Realtime, bez pollingu, bez
odświeżania). Dostęp do wątku i same wiadomości są ograniczone wyłącznie do uczestników danego dopasowania, zarówno
przez API, jak i przez RLS.

## Key Decisions Made

| #   | Decyzja                         | Wybór                                                                                                                                                                                            | Źródło           |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | Klucz Supabase dla przeglądarki | Nowe `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY` (ten sam anon key co `SUPABASE_KEY` — potwierdzone w `ci.yml`), bez zmian w `SUPABASE_KEY` serwerowym                                      | Research + Plan  |
| 2   | Granulacja konwersacji          | Jedno dopasowanie = jeden wątek (`match_id`), bez osobnej tabeli `conversations`                                                                                                                 | Plan (pytanie 2) |
| 3   | Schemat `messages`              | `(id, match_id, sender_dog_id, body text not null, created_at)`, niemutowalny, mirror `swipes`/`matches`                                                                                         | Plan (pytanie 3) |
| 4   | Mechanizm Realtime              | `postgres_changes` na `messages` + RLS jako jedyna granica autoryzacji (dodanie do `supabase_realtime` publication); RLS mirror `matches_select_participant`                                     | Plan (pytanie 4) |
| 5   | Zakres UI                       | Tylko widok wątku `/dashboard/messages/[matchId]`, wejście z istniejącego przycisku w `MatchesList`; brak osobnej listy konwersacji                                                              | Plan (pytanie 5) |
| 6   | Pusty wątek                     | Podpowiedź "napisz pierwszą wiadomość", brak specjalnej logiki pierwszego nadawcy                                                                                                                | Plan (pytanie 6) |
| 7   | UI wysyłki / błędów             | Brak optymistycznego UI; inline `Alert` + ponowienie przy błędzie, mirror `MatchesList`/`BrowseDogs`; brak fallbacku pollingowego przy utracie Realtime                                          | Plan (pytanie 7) |
| 8   | Zakres testów                   | Nowy pgTAP `messages_rls.test.sql` (mirror `matches_rls.test.sql`), manualna weryfikacja dwusesyjna Realtime, `npm run smoke`; brak e2e (brak frameworka w repo), brak rozszerzenia `test:authz` | Plan (pytanie 8) |

## Scope

**In:**

- Tabela `messages` + RLS + dodanie do `supabase_realtime` publication.
- `GET`/`POST /api/messages`.
- Nowy przeglądarkowy klient Supabase (`src/lib/supabase-browser.ts`) używany wyłącznie do autoryzacji kanału
  Realtime.
- Widok wątku `/dashboard/messages/[matchId]` + odblokowanie przycisku w `MatchesList.tsx`.
- Nowy pgTAP test RLS.

**Out:**

- Osobna tabela/lista konwersacji, edycja/usuwanie wiadomości, potwierdzenia odczytu.
- Optymistyczne UI, fallback pollingowy.
- Paginacja historii wiadomości, odświeżanie tokenu sesji w trakcie trwania wątku.
- Testy e2e, rozszerzenie `scripts/authz-test.mjs`.

## Architecture / Approach

Cztery sekwencyjne fazy: schemat+RLS+Realtime w bazie → API + klient przeglądarkowy → UI wątku → końcowa
weryfikacja. Dane biznesowe wątku (historia, dane drugiego psa) komponent React pobiera sam przez `fetch()` do
`/api/messages`, zgodnie z istniejącym wzorcem (`MatchesList`, `BrowseDogs`). Jedynym wyjątkiem jest token dostępu
sesji — przekazywany jako prop ze strony `.astro` do komponentu, bo jest potrzebny wyłącznie do autoryzacji kanału
Realtime (`supabase.realtime.setAuth(accessToken)`), czego nie da się uzyskać czysto klienckim `fetch`.

## Phases at a Glance

| Faza                           | Co robi                                                                  | Automatyczna weryfikacja                     | Manualna weryfikacja                                                     |
| ------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Schemat, RLS, Realtime      | Tabela `messages`, polityki RLS, publication, `src/types.ts`, pgTAP test | `supabase test db`, `lint`                   | `messages` w `supabase_realtime` publication                             |
| 2. API + klient przeglądarkowy | `/api/messages` GET/POST, `supabase-browser.ts`, env vars                | `lint`, `build`                              | odmowa dostępu do cudzego dopasowania, walidacja treści                  |
| 3. UI wątku                    | `MessageThread.tsx`, strona `[matchId].astro`, odblokowany przycisk      | `lint`, `build`, `smoke`                     | nawigacja, pusty stan, błąd wysyłki, dwusesyjny Realtime, odmowa dostępu |
| 4. Końcowa weryfikacja         | Brak nowego kodu — pełny przebieg testów                                 | `lint`, `build`, `supabase test db`, `smoke` | pełny przepływ end-to-end, RLS blokuje nieuczestnika                     |

**Prerequisites & estimated effort:** lokalny Supabase (Docker/Podman) uruchomiony dla pgTAP i weryfikacji manualnej;
brak zależności od innych niezakończonych zmian (S-02 `match-data-foundation`/`matches-list` są `done`). Rozmiar:
średni — jedna nowa tabela, dwa endpointy, jeden nowy komponent, jedna nowa strona.

## Open Risks & Assumptions

- **Wygasanie tokenu sesji**: token dostępu przekazywany jest raz przy renderowaniu strony; długo otwarty wątek może
  stracić autoryzację kanału Realtime po wygaśnięciu sesji do czasu odświeżenia strony. Zaakceptowane dla MVP
  (patrz "What We're NOT Doing" w planie).
- **Dostępność lokalnego Supabase**: weryfikacja manualna Realtime i `supabase test db` wymagają uruchomionego
  Dockera/Podmana lokalnie (patrz `CLAUDE.md` w repo — na tej maszynie to Podman z `DOCKER_HOST` ustawionym na
  nazwany pipe).
- Założenie potwierdzone badaniem: `SUPABASE_KEY` to klucz anon Supabase (dowód: `ci.yml` mapuje `auth.anon_key` →
  `SUPABASE_KEY`) — bezpieczny do powielenia jako publiczny klucz przeglądarkowy.

## Success Criteria Summary

Lint, build i `npm run smoke` przechodzą bez regresji; `supabase test db` przechodzi z nowym testem RLS dla
`messages`; manualna dwusesyjna weryfikacja potwierdza dostarczanie w czasie rzeczywistym bez pollingu i bez
odświeżania strony; próba dostępu do cudzego wątku (API i bezpośrednio przez RLS) kończy się odmową bez ujawnienia
treści.
