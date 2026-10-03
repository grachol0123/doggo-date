# Plan: first-message — Pierwsza wiadomość w dopasowaniu (S-03)

## Overview

Właściciele dopasowanych psów mogą wymieniać proste wiadomości tekstowe w czasie rzeczywistym, bez odświeżania
strony. Zakres: nowa tabela `messages` (jeden wątek na dopasowanie, bez osobnej tabeli konwersacji), RLS
ograniczające dostęp do uczestników dopasowania, dostarczanie w czasie rzeczywistym przez Supabase Realtime
(`postgres_changes`, bez pollingu), oraz widok wątku pod `/dashboard/messages/[matchId]` wchodzony z przycisku
"Napisz wiadomość" na liście dopasowań.

## Current State Analysis

- `matches` i `swipes` istnieją (`supabase/migrations/20260926200000_create_swipes_and_matches.sql`) z wzorcem:
  jedna migracja na logiczną zmianę, granularne polityki RLS `to authenticated` nazwane `<table>_<operacja>_<zakres>`,
  brak polityk update/delete (niemutowalność przez pominięcie), `src/types.ts` ręcznie zsynchronizowany (nie
  generowany).
- `src/components/dog/MatchesList.tsx:228-230` renderuje wyłączony przycisk "Napisz wiadomość" w każdej karcie
  dopasowania — to jedyny punkt wejścia przewidziany w zakresie tej zmiany; nie ma osobnej listy konwersacji.
- `src/pages/api/matches/index.ts` i `src/pages/api/dogs/{save,next-candidate}.ts` ustalają konwencję API: `GET`/`POST`
  z wielkich liter, `export const prerender = false`, tagowane odpowiedzi JSON (`{status: "ok" | ...}`), autoryzacja
  przez `context.locals.user`, klient Supabase przez `createClient(context.request.headers, context.cookies)`.
- **Krytyczne odkrycie architektoniczne**: `src/lib/supabase.ts` eksportuje wyłącznie serwerowy klient
  (`@supabase/ssr`). `astro.config.mjs` deklaruje `SUPABASE_URL`/`SUPABASE_KEY` jako `context: "server", access:
"secret"`. W repozytorium nie istnieje żaden klient Supabase działający w przeglądarce ani żadna publiczna
  zmienna środowiskowa — subskrypcja Realtime z komponentu React wymaga nowego, przeglądarkowego klienta.
- **Rozstrzygnięcie otwartego pytania z research.md**: `.github/workflows/ci.yml` (krok "Write local Supabase
  credentials to .dev.vars") mapuje `auth.anon_key` lokalnego Supabase na `SUPABASE_KEY`. To potwierdza, że istniejący
  `SUPABASE_KEY` JEST kluczem anon — bezpiecznym do użycia również jako publiczny klucz przeglądarkowy. Nie jest to
  klucz bardziej uprzywilejowany.
- Komponenty kliencki (`MatchesList.tsx`, `BrowseDogs.tsx`) same pobierają swoje dane przez `fetch()` po stronie
  przeglądarki (`client:load`), bez przekazywania danych biznesowych jako propsy ze stron `.astro`. Ten wzorzec jest
  zachowany dla danych wątku wiadomości; jedynym wyjątkiem jest token dostępu sesji (patrz niżej), którego nie da się
  pobrać przez istniejące, czysto klienckie API.
- Autoryzacja kanału Realtime w Supabase wymaga przekazania JWT użytkownika do klienta Realtime (RLS jest również
  egzekwowane na `postgres_changes`, ale klient musi "uwierzytelnić" połączenie WebSocket tym JWT — sam klucz anon nie
  wystarcza do odebrania wierszy zastrzeżonych przez RLS). Aplikacja używa sesji opartych na ciasteczkach
  (`@supabase/ssr`), więc token dostępu nie jest nigdzie dostępny po stronie przeglądarki domyślnie.

### Key Discoveries

- `src/middleware.ts:4` chroni każdą ścieżkę zaczynającą się od `/dashboard` (`PROTECTED_ROUTES.some(... startsWith
...)`) — nowa ścieżka `/dashboard/messages/[matchId]` jest już chroniona bez zmian w middleware.
- `supabase/tests/database/matches_rls.test.sql` to gotowy do skopiowania szkielet pgTAP (fixture z ustalonymi UUID,
  `set_config('request.jwt.claims', ...)` + `set local role authenticated` do symulacji różnych użytkowników,
  `results_eq`/`throws_ok`, `select plan(N)` / `select * from finish()` / `rollback`).
- `src/lib/schemas/dog-profile.ts` ustala konwencję walidacji zod z osobnym obiektem `*Bounds` (min/max) obok schematu.

## Desired End State

Po wdrożeniu: właściciel psa klika "Napisz wiadomość" na karcie dopasowania → trafia na `/dashboard/messages/<id
dopasowania>` → widzi historię wiadomości (lub podpowiedź "napisz pierwszą wiadomość", jeśli wątek jest pusty) → może
wysłać wiadomość tekstową → druga strona, jeśli ma otwarty wątek, widzi nową wiadomość natychmiast przez Supabase
Realtime, bez odświeżania strony i bez pollingu. Próba dostępu do wątku dopasowania, którego użytkownik nie jest
uczestnikiem, kończy się odmową zarówno na poziomie API, jak i na poziomie bazy danych (RLS).

### Verification

- `npm run lint` i `npm run build` przechodzą.
- `supabase test db` (pgTAP) przechodzi, w tym nowy plik `messages_rls.test.sql`.
- `npm run smoke` przechodzi bez regresji.
- Ręczna weryfikacja dwusesyjna (dwie przeglądarki/sesje incognito) potwierdza dostarczanie w czasie rzeczywistym.
- Ręczna próba odczytu/zapisu wiadomości w cudzym dopasowaniu (inny użytkownik, inny `matchId`) kończy się odmową.

## What We're NOT Doing

- Brak osobnej tabeli/encji "konwersacja" — `match_id` jest jedynym identyfikatorem wątku.
- Brak edycji, usuwania i potwierdzeń odczytu (read receipts) wiadomości.
- Brak UI optymistycznego — wiadomość pojawia się dopiero po potwierdzonym zapisie w bazie.
- Brak mechanizmu fallback (polling) przy utracie połączenia Realtime — PRD FR-006 wprost wyklucza polling jako
  mechanizm dostarczania.
- Brak osobnej strony/listy konwersacji — `MatchesList` pozostaje jedynym punktem wejścia do wątków.
- Brak odświeżania tokenu dostępu w trakcie trwania wątku — token pobierany jest przy renderowaniu strony; sesja
  wygasająca w trakcie długiej wizyty na stronie może przerwać autoryzację kanału Realtime do czasu odświeżenia
  strony. Akceptowalne dla zakresu MVP tej zmiany.
- Brak testów e2e (Playwright) — w repozytorium nie ma jeszcze skonfigurowanego frameworka e2e; pokrycie manualne +
  pgTAP + smoke jest zgodne z `context/foundation/test-plan.md`.
- Brak zmian w `scripts/authz-test.mjs` / `npm run test:authz` — rozszerzenie pokrycia autoryzacji o `messages` jest
  poza zakresem tej zmiany (możliwa przyszła faza rollout planu testów).

## Implementation Approach

Cztery fazy, każda niezależnie weryfikowalna: (1) schemat + RLS + Realtime publication w bazie, (2) API + nowy
przeglądarkowy klient Supabase, (3) UI wątku i podłączenie przycisku na liście dopasowań, (4) końcowa weryfikacja
całościowa. Fazy 1-3 są sekwencyjne (API zależy od schematu, UI zależy od API i klienta przeglądarkowego).

## Phase 1: Schemat, RLS i Realtime publication

### Overview

Nowa tabela `messages`, granularne RLS mirror `matches_select_participant`, dodanie tabeli do publikacji
`supabase_realtime`, ręczna synchronizacja `src/types.ts`, nowy test pgTAP.

### Changes Required:

#### 1. Migracja `supabase/migrations/<timestamp>_create_messages.sql`

**Intent**: Utworzyć tabelę `messages` jako niemutowalny log wiadomości przypisany do `match_id`, z RLS
ograniczającym select/insert do uczestników dopasowania, oraz włączyć tabelę do publikacji Realtime.

**Contract**: `messages(id uuid pk default gen_random_uuid(), match_id uuid not null references public.matches(id)
on delete cascade, sender_dog_id uuid not null references public.dogs(id) on delete cascade, body text not null,
created_at timestamptz not null default now())`, plus `constraint messages_body_not_blank check (char_length(trim(body))

> 0)`. Brak polityk update/delete (niemutowalność przez pominięcie, jak `matches`/`swipes`).

RLS select mirror `matches_select_participant`:

```sql
create policy messages_select_participant
on public.messages
for select
to authenticated
using (
  exists (
    select 1 from public.matches m
    join public.dogs d on d.owner_id = auth.uid() and d.id in (m.dog_a_id, m.dog_b_id)
    where m.id = messages.match_id
  )
);
```

RLS insert musi dodatkowo potwierdzić, że `sender_dog_id` należy do wywołującego:

```sql
create policy messages_insert_participant
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1 from public.dogs d
    where d.id = sender_dog_id and d.owner_id = auth.uid()
  )
  and exists (
    select 1 from public.matches m
    where m.id = match_id and sender_dog_id in (m.dog_a_id, m.dog_b_id)
  )
);
```

Włączenie do Realtime (publikacja może już istnieć w lokalnym Supabase, więc warunkowo):

```sql
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.messages;
```

#### 2. `src/types.ts`

**Intent**: Ręcznie zsynchronizować typ `Database["public"]["Tables"]["messages"]` z nową tabelą, mirror stylu
istniejących wpisów `swipes`/`matches` (ten plik nie jest generowany automatycznie — patrz `Match`/`Swipe` na końcu
pliku).

**Contract**: Dodać blok `messages: { Row: {...}; Insert: {...}; Update: {...}; Relationships: [] }` do
`Database["public"]["Tables"]` oraz eksport `export type Message = Database["public"]["Tables"]["messages"]["Row"];`
obok istniejących `Dog`/`Swipe`/`Match`.

#### 3. `supabase/tests/database/messages_rls.test.sql`

**Intent**: Mirror konwencji `matches_rls.test.sql` — dowieść, że uczestnik dopasowania może czytać/wstawiać
wiadomości we własnym wątku, a osoba spoza dopasowania nie widzi ani nie może wstawić żadnego wiersza (także przy
próbie podstawienia cudzego `match_id`/`sender_dog_id`).

**Contract**: Fixture z trzema psami/właścicielami (dwaj uczestnicy dopasowania + jeden "obcy"), `set_config` +
`set local role authenticated` do przełączania tożsamości, asercje na `results_eq`/`throws_ok`/`is_empty` dla selecta
jako uczestnik vs. obcy, oraz `throws_ok` dla próby insertu z `sender_dog_id` nienależącym do wywołującego.

### Success Criteria:

#### Automated Verification:

- `supabase test db` przechodzi, w tym nowy plik `messages_rls.test.sql`.
- `npx astro sync && npm run lint` przechodzi (typy `src/types.ts` spójne z użyciem w kolejnych fazach).

#### Manual Verification:

- W lokalnym Supabase Studio potwierdzić, że `messages` pojawia się w `supabase_realtime` publication (`select *
from pg_publication_tables where pubname = 'supabase_realtime';`).

## Phase 2: API wiadomości i przeglądarkowy klient Supabase

### Overview

Nowe endpointy `GET`/`POST /api/messages`, nowy moduł `src/lib/supabase-browser.ts`, nowe publiczne zmienne
środowiskowe, aktualizacja `.env.example` i kroku CI zapisującego `.dev.vars`.

### Changes Required:

#### 1. `astro.config.mjs`

**Intent**: Udostępnić URL i klucz anon Supabase po stronie przeglądarki, bez naruszania istniejących sekretów
serwerowych.

**Contract**: Dodać do `env.schema`: `PUBLIC_SUPABASE_URL: envField.string({ context: "client", access: "public",
optional: true })` i `PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: "client", access: "public", optional:
true })`.

#### 2. `src/lib/supabase-browser.ts` (nowy plik)

**Intent**: Dostarczyć leniwie tworzony klient `@supabase/supabase-js` dla przeglądarki, używany wyłącznie do
subskrypcji Realtime (odczyt/zapis wiadomości nadal idzie przez `/api/messages`, zgodnie z konwencją
`MatchesList`/`BrowseDogs`).

**Contract**: `export function createBrowserClient(): SupabaseClient<Database> | null` — zwraca `null`, gdy brak
publicznych zmiennych środowiskowych (mirror `createClient` w `src/lib/supabase.ts`), inaczej
`createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)` z `astro:env/client`.

#### 3. `src/lib/schemas/message.ts` (nowy plik)

**Intent**: Walidacja treści wiadomości wejściowej, mirror stylu `dog-profile.ts` (obiekt `messageBounds` + schemat
zod).

**Contract**: `messageBounds = { body: { min: 1, max: 2000 } }`; `sendMessageSchema = z.object({ matchId:
z.string().uuid(), body: z.string().trim().min(1).max(2000) })`.

#### 4. `src/pages/api/messages/index.ts` (nowy plik)

**Intent**: `GET` zwraca historię wątku + dane drugiego psa (dla nagłówka UI); `POST` wstawia nową wiadomość. Oba
sprawdzają autoryzację jawnie w API (czytelny błąd `404`/`not_participant` zamiast polegać wyłącznie na RLS, zgodnie
z `src/pages/api/matches/index.ts`), RLS pozostaje ostateczną granicą.

**Contract**:
`GET /api/messages?matchId=<uuid>` → `{status: "unauthenticated"}` 401 | `{status: "invalid_request"}` 400 (brak/zły
format `matchId`) | `{status: "not_participant"}` 404 (dopasowanie nie istnieje lub wywołujący nie jest jego
uczestnikiem — nie ujawniać różnicy) | `{status: "ok", otherDog: Dog, otherDogPhotoUrl: string | null, messages:
Array<{id: string; body: string; createdAt: string; senderDogId: string; isMine: boolean}>}`.
`POST /api/messages` (JSON body zgodny z `sendMessageSchema`) → `{status: "unauthenticated"}` 401 |
`{status: "invalid_body"}` 400 | `{status: "not_participant"}` 404 | `{status: "ok", message: {...jak wyżej}}` |
`{status: "error", message}` 500. Autoryzacja: znajdź własnego psa wywołującego (`dogs.owner_id = user.id`),
potwierdź że jest uczestnikiem `matches` o podanym `matchId`, dopiero wtedy wykonaj select/insert na `messages`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` i `npm run build` przechodzą.

#### Manual Verification:

- `curl`/REST client: `GET /api/messages?matchId=<cudze-dopasowanie>` zwraca `not_participant`, nie `ok`.
- `POST /api/messages` z poprawnym `matchId` i pustym/za długim `body` zwraca `invalid_body`.

## Phase 3: Wątek wiadomości (UI) i podłączenie przycisku

### Overview

Nowy komponent React `MessageThread.tsx` (fetch historii + subskrypcja Realtime + formularz wysyłki), nowa strona
`/dashboard/messages/[matchId].astro`, odblokowanie przycisku "Napisz wiadomość" w `MatchesList.tsx`.

### Changes Required:

#### 1. `src/pages/dashboard/messages/[matchId].astro` (nowy plik)

**Intent**: Cienka strona serwerowa, chroniona już przez istniejący prefiks `/dashboard` w `src/middleware.ts:4`.
Jedyna rola po stronie serwera: pobrać token dostępu bieżącej sesji i przekazać go jako prop do komponentu — token
jest potrzebny wyłącznie do autoryzacji kanału Realtime w przeglądarce (`supabase.realtime.setAuth(...)`); dane
biznesowe wątku komponent pobiera sam przez `fetch("/api/messages?matchId=...")`, zgodnie z wzorcem
`MatchesList`/`BrowseDogs`.

**Contract**: Użyć `createClient(Astro.request.headers, Astro.cookies)` z `@/lib/supabase.ts` +
`supabase.auth.getSession()`, przekazać `accessToken={session?.access_token ?? null}` i `matchId={Astro.params.matchId}`
do `<MessageThread client:load ... />` wewnątrz `DashboardLayout`, wraz z linkiem powrotnym do `/dashboard/matches`
(mirror stopki `matches.astro`).

#### 2. `src/components/dog/MessageThread.tsx` (nowy plik)

**Intent**: Pobrać historię wiadomości i dane drugiego psa z `/api/messages?matchId=`, zasubskrybować
`postgres_changes` (insert) na `messages` przefiltrowane po `match_id=eq.<matchId>` autoryzując kanał tokenem
sesji, renderować listę wiadomości (pusty stan: podpowiedź "napisz pierwszą wiadomość") i formularz wysyłki przez
`POST /api/messages` (bez optymistycznego UI — wiadomość dopisywana do listy dopiero po odpowiedzi `ok` z API albo
przez event Realtime, który i tak nadejdzie).

**Contract (nieoczywisty fragment — autoryzacja kanału Realtime)**:

```ts
const browserClient = createBrowserClient();
if (browserClient && accessToken) {
  browserClient.realtime.setAuth(accessToken);
}
const channel = browserClient
  ?.channel(`messages:${matchId}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
    (payload) => appendIncomingMessage(payload.new),
  )
  .subscribe();
```

Stany widoku (mirror `MatchesList.tsx`): `loading` | `not_participant` | `error` (z przyciskiem ponowienia) | `ready`.
Błąd wysyłki: inline `Alert` + możliwość ponowienia, bez utraty wpisanej treści (mirror konwencji błędów w
`MatchesList.tsx`/`BrowseDogs.tsx`).

#### 3. `src/components/dog/MatchesList.tsx:228-230`

**Intent**: Odblokować nawigację do wątku dla danego dopasowania — jedyny punkt wejścia do wiadomości w tej zmianie.

**Contract**: Zastąpić `<Button type="button" className="w-full" disabled>Napisz wiadomość</Button>` na `<Button
asChild className="w-full"><a href={`/dashboard/messages/${match.matchId}`}>Napisz wiadomość</a></Button>`.

#### 4. `.env.example`, `.github/workflows/ci.yml`

**Intent**: Udokumentować i dostarczyć nowe publiczne zmienne środowiskowe lokalnie i w CI, tak samo jak dla
istniejących `SUPABASE_URL`/`SUPABASE_KEY`.

**Contract**: `.env.example` — dodać linie `PUBLIC_SUPABASE_URL=###` i `PUBLIC_SUPABASE_ANON_KEY=###`. `ci.yml` —
rozszerzyć krok "Write local Supabase credentials to .dev.vars" o dwa kolejne `--override-name`
(`api.url=PUBLIC_SUPABASE_URL`, `auth.anon_key=PUBLIC_SUPABASE_ANON_KEY`) i odpowiadające `grep -q` asercje, zgodnie z
potwierdzeniem, że `auth.anon_key` to ta sama wartość co istniejący `SUPABASE_KEY`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` i `npm run build` przechodzą.
- `npm run smoke` przechodzi bez regresji.

#### Manual Verification:

- Kliknięcie "Napisz wiadomość" na karcie dopasowania prowadzi do `/dashboard/messages/<matchId>`.
- Pusty wątek pokazuje podpowiedź napisania pierwszej wiadomości, nie błąd.
- Wysłanie wiadomości z błędem sieci pokazuje inline błąd z możliwością ponowienia, bez utraty wpisanego tekstu.
- Dwie równoległe sesje przeglądarki (dwaj uczestnicy tego samego dopasowania) — wiadomość wysłana w jednej pojawia
  się w drugiej bez odświeżania strony.
- Próba wejścia na `/dashboard/messages/<matchId>` cudzego dopasowania (inny użytkownik) kończy się stanem
  `not_participant`, nie ujawnia treści wiadomości.

## Phase 4: Końcowa weryfikacja

### Overview

Całościowy przebieg weryfikacji automatycznej i manualnej po scaleniu wszystkich faz.

### Changes Required:

Brak nowych zmian w kodzie — ta faza jest wyłącznie weryfikacyjna.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi.
- `npm run build` przechodzi.
- `supabase test db` przechodzi (wszystkie testy pgTAP, w tym `messages_rls.test.sql`).
- `npm run smoke` przechodzi.

#### Manual Verification:

- Pełny przepływ end-to-end: dwa konta → swipe wzajemny → dopasowanie → "Napisz wiadomość" → wymiana wiadomości w
  czasie rzeczywistym w dwóch sesjach jednocześnie.
- RLS blokuje nieuczestnika: bezpośrednie zapytanie `select`/`insert` do `messages` jako inny użytkownik (np. przez
  Supabase Studio SQL editor z `set local role authenticated` + cudzym JWT) zwraca pusty wynik / błąd uprawnień.

## Testing Strategy

- **pgTAP** (`supabase test db`): nowy `messages_rls.test.sql` mirror `matches_rls.test.sql` — jedyny automatyczny
  test granicy autoryzacji dla tej zmiany (zgodnie z decyzją: brak rozszerzenia `scripts/authz-test.mjs` w tym
  zakresie).
- **Manualna weryfikacja Realtime dwusesyjna**: wymagana przez `context/foundation/test-plan.md` (ryzyko #4) —
  dostarczanie w czasie rzeczywistym nie jest łatwo pokrywalne automatycznym testem bez frameworka e2e.
- **`npm run smoke`**: regresja istniejącego przepływu auth po dodaniu nowych zmiennych środowiskowych publicznych.
- Brak Playwright/e2e w tej zmianie — repozytorium nie ma jeszcze skonfigurowanego frameworka e2e.

## Performance Considerations

- Historia wiadomości pobierana jednym zapytaniem przy wejściu na wątek (brak paginacji w zakresie tej zmiany —
  liczba wiadomości w nowym produkcie jest niska; paginacja może być przyszłą iteracją, jeśli wątki się rozrosną).
- Jeden kanał Realtime na wątek, zamykany (`channel.unsubscribe()`) przy odmontowaniu komponentu, aby uniknąć
  wycieku połączeń WebSocket przy nawigacji między wątkami.

## Migration Notes

- Migracja Fazy 1 jest addytywna (nowa tabela) — brak zmian w istniejących tabelach, brak ryzyka dla danych
  `dogs`/`swipes`/`matches`.
- Brak potrzeby wycofania danych — jeśli funkcja wymaga wycofania, wystarczy usunięcie trasy/komponentów UI; tabela
  `messages` może pozostać nieużywana bez wpływu na resztę aplikacji.

## References

- `supabase/migrations/20260926200000_create_swipes_and_matches.sql` — wzorzec schematu/RLS do mirror.
- `supabase/tests/database/matches_rls.test.sql` — konwencja pgTAP do mirror.
- `src/pages/api/matches/index.ts`, `src/pages/api/dogs/{save,next-candidate}.ts` — konwencja API routes.
- `src/lib/schemas/dog-profile.ts` — konwencja walidacji zod.
- `src/components/dog/MatchesList.tsx:228-230` — punkt wejścia UI.
- `src/lib/supabase.ts`, `astro.config.mjs`, `src/env.d.ts` — istniejący wzorzec dostępu serwerowego do rozszerzenia.
- `.github/workflows/ci.yml` — krok generujący `.dev.vars`, potwierdzający że `SUPABASE_KEY` to klucz anon.
- `context/changes/first-message/research.md` — pełne badanie leżące u podstaw tego planu.
- `context/foundation/test-plan.md` (ryzyko #4) — wymóg manualnej weryfikacji Realtime.

## Progress

### Phase 1: Schemat, RLS i Realtime publication

#### Automated

- [x] 1.1 `supabase test db` przechodzi, w tym nowy plik `messages_rls.test.sql` — 9c4e348
- [x] 1.2 `npx astro sync && npm run lint` przechodzi — 9c4e348

#### Manual

- [x] 1.3 `messages` widoczna w `supabase_realtime` publication w lokalnym Supabase Studio — 9c4e348

### Phase 2: API wiadomości i przeglądarkowy klient Supabase

#### Automated

- [x] 2.1 `npm run lint` przechodzi — 8275945
- [x] 2.2 `npm run build` przechodzi — 8275945

#### Manual

- [x] 2.3 `GET /api/messages?matchId=<cudze-dopasowanie>` zwraca `not_participant` — 8275945
- [x] 2.4 `POST /api/messages` z pustym/za długim `body` zwraca `invalid_body` — 8275945

### Phase 3: Wątek wiadomości (UI) i podłączenie przycisku

#### Automated

- [x] 3.1 `npm run lint` przechodzi
- [x] 3.2 `npm run build` przechodzi
- [x] 3.3 `npm run smoke` przechodzi bez regresji

#### Manual

- [x] 3.4 Kliknięcie "Napisz wiadomość" prowadzi do `/dashboard/messages/<matchId>`
- [x] 3.5 Pusty wątek pokazuje podpowiedź, nie błąd
- [x] 3.6 Błąd wysyłki pokazuje inline alert z ponowieniem, bez utraty tekstu
- [x] 3.7 Dwie sesje: wiadomość wysłana w jednej pojawia się w drugiej bez odświeżania
- [x] 3.8 Wejście na cudzy wątek kończy się `not_participant`, bez ujawnienia treści

### Phase 4: Końcowa weryfikacja

#### Automated

- [ ] 4.1 `npm run lint` przechodzi
- [ ] 4.2 `npm run build` przechodzi
- [ ] 4.3 `supabase test db` przechodzi (cały pakiet pgTAP)
- [ ] 4.4 `npm run smoke` przechodzi

#### Manual

- [ ] 4.5 Pełny przepływ end-to-end dwusesyjny działa bez pollingu
- [ ] 4.6 RLS blokuje bezpośredni select/insert nieuczestnika na `messages`
