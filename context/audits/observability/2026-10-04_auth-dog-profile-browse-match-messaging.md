---
type: observability-audit
date: 2026-10-04 22:30
mode: audit
commit: b87f26f
branch: develop
dirty_tree: true
areas: [auth, dog-profile, browse-match, messaging]
area_source: foundation
runtime_proof: partial
error_tracker: Sentry (@sentry/cloudflare, @sentry/astro)
previous_report: null
findings: { critical: 2, high: 6, medium: 7, low: 0 }
---

# Audyt obserwowalności — Doggo Date (2026-10-04)

## 1. TL;DR

- Najpoważniejsze awarie w zapisie profilu i dostarczaniu wiadomości realtime mogą być niewidoczne w Sentry: błędy zapisu są zamieniane na przekierowania, a stany błędne subskrypcji nie są obsługiwane.
- Globalne hooki prywatności usuwają wartości wyjątków i większość kontekstu, więc nawet zgłoszone awarie są trudniejsze do rozróżnienia i grupowania.
- W klientowych przepływach przeglądania i listy matchy część błędów jest przechwytywana przez `catch` i pokazana jako zwykły komunikat, bez ponownego zgłoszenia do Sentry.
- Kod ustawia wydanie/środowisko w metadanych HTML używanych przez przeglądarkę; konfiguracja serwerowego SDK nie przekazuje jawnie identyfikatora wydania.
- Pierwsza poprawka powinna zapewnić wspólny, scrub-safe sposób raportowania nieoczekiwanych błędów obsłużonych przed granicą Sentry, bez zmiany bezpiecznych komunikatów dla użytkownika.

## 2. Model przechwytywania

- **Runtime i granica:** aplikacja Astro SSR działa jako Cloudflare Worker; trasy API są obsługiwane przez Astro handler opakowany przez `Sentry.withSentry` (`wrangler.jsonc:4-6`, `sentry.server.config.ts:166-172`). Interaktywne formularze i przepływy browse/message działają również w przeglądarce.
- **Inicjalizacja trackera:** serwerowy SDK jest inicjalizowany w jednym wrapperze Worker (`sentry.server.config.ts:166-172`). SDK przeglądarkowy startuje warunkowo, jeśli istnieje `PUBLIC_SENTRY_DSN`, i pobiera release/environment z meta tagów (`sentry.client.config.ts:57-68`).
- **Granice:** nieobsłużone wyjątki w handlerze trafiają do wrappera serwerowego. Jawne przechwytywanie używa wspólnego helpera (`src/lib/sentry.ts:1-7`), ale przechwycone i zamienione na odpowiedź błędy API nie są automatycznie wyjątkami dla zewnętrznej granicy. Po stronie przeglądarki wyjątki, które kod obsłuży i zamieni na stan/komunikat, nie docierają do globalnego handlera.
- **Logowanie:** kod używa `console.error` przy awariach czyszczenia plików profilu (`src/pages/api/dogs/save.ts:215,227`); pozostałe logi i retencja logów platformy są poza repozytorium. Brak centralnego loggera serializującego błędy.
- **Scrubbing i sampling:** oba SDK mają `tracesSampleRate: 0` (błędy nie są próbkowane przez sampling śladów), usuwają dane użytkownika/żądania/konteksty/breadcrumbs, a przeglądarka odrzuca breadcrumbsy (`sentry.server.config.ts:47-72,166-172`; `sentry.client.config.ts:19-53,60-68`). Wartości wyjątków są zastępowane stałymi tekstami, co ogranicza diagnostykę i grupowanie.
- **Tożsamość wdrożenia:** Wrangler deklaruje `production`/`preview` oraz binding metadanych wydania (`wrangler.jsonc:8-29`). Worker wstrzykuje release/environment do HTML (`sentry.server.config.ts:93-100,125-164`); klient odczytuje oba tagi. Serwerowa inicjalizacja Sentry ustawia environment, ale nie ustawia jawnie `release` (`sentry.server.config.ts:166-172`). Ustawienia uploadu i powiązania source maps dla produkcji są poza zakresem tego przeglądu kodu.

**Założenia (poza repozytorium, nie ustalenia):** zakładam, zgodnie z zakresem audytu, że Sentry i logi Cloudflare są zbierane w produkcji. Reguł alertów nie można potwierdzić w repozytorium. Zrzut przekazany przez użytkownika pokazuje adres IP w polu „User”, mimo że aplikacyjny hook usuwa `event.user`; jego źródło może być po stronie Sentry/ingestu i pozostaje niepotwierdzone, dlatego nie traktuję go jako ustalenia kodowego.

## 3. Co dociera do trackera

| Kształt awarii | Odpowiedź / zachowanie | Logi platformy | Sentry | Ocena |
|---|---|---|---|---|
| Nieobsłużony wyjątek serwerowy | Obsługa przez globalny Worker/Astro handler | Nie sprawdzano dla tego audytu | Zgodnie z konfiguracją dociera do wrappera; treść wyjątku jest uogólniana | Wnioskowane ze statycznego kodu |
| Błąd API przechwycony i zamieniony na redirect/JSON | Użytkownik dostaje przekierowanie lub odpowiedź błędu | Nie sprawdzano | Bez jawnego `captureException` nie ma gwarancji zdarzenia | Wnioskowane ze statycznego kodu |
| Błąd pobierania browse/matches przechwycony w `catch` | UI pokazuje ogólny komunikat/retry | Nie sprawdzano | `catch` nie raportuje wyjątku; globalny handler go nie zobaczy | Wnioskowane ze statycznego kodu |
| Awaria kanału wiadomości realtime | UI nie aktualizuje się na żywo; status kanału ignorowany | Nie sprawdzano | Brak handlera statusu subskrypcji, więc brak zgłoszenia | Wnioskowane ze statycznego kodu |
| Kontrolowany błąd browser Preview | Kontrolowana uncaught exception | Nie sprawdzano | **Zaobserwowano na dostarczonym zrzucie:** event w Sentry ma `preview` i release; URL jest pusty; stack pokazuje inline route i zminifikowany bundle | Częściowe runtime evidence; nie dowodzi kompletnej redakcji payloadu ani zachowania eventów serwerowych |

## 4. Systemowe przyczyny źródłowe

1. **Obsłużone awarie nie mają wspólnej ścieżki raportowania.** Auth i zapis profilu zamieniają błędy na redirect/odpowiedź (`src/pages/api/auth/signin.ts:13-17`, `src/pages/api/dogs/save.ts:162-169`), a UI często zamyka je w `catch` (`src/components/dog/BrowseDogs.tsx:52-57`); wrapper widzi wyłącznie wyjątki, które nie zostały wcześniej zamienione. Dotyczy ustaleń 4–10.
2. **Realtime nie traktuje błędnego statusu kanału jako błędu przepływu.** Subskrypcja nie rejestruje callbacku statusu, a konfiguracja auth jest asynchroniczna (`src/components/dog/MessageThread.tsx:195-211`). Dotyczy ustaleń 13–14.
3. **Scrubber zastępuje diagnostykę zamiast redagować konkretne pola.** Wartości wyjątków i konteksty są usuwane (`sentry.server.config.ts:47-72`, `sentry.client.config.ts:19-53`), nawet jeśli wystarczą stabilne kody błędów lub typy bez danych użytkownika. Dotyczy ustaleń 1, 9, 15.
4. **Operacje wieloetapowe nie przenoszą kontekstu między etapami.** Swipe może zostać zapisany przed nieudanym odczytem matcha (`src/pages/api/swipes/index.ts:77-113`), a po błędzie odpowiedź nie komunikuje częściowego sukcesu. Dotyczy ustalenia 11.
5. **Metadane release są silniej związane ze ścieżką HTML/przeglądarką niż inicjalizacją serwera.** Worker wstawia je do HTML (`sentry.server.config.ts:125-164`), natomiast opcje serwerowego SDK nie przekazują `release` (`sentry.server.config.ts:166-172`). Dotyczy ustalenia 2.

## 5. Ustalenia według obszaru

### Platforma / wspólna warstwa

| # | Lokalizacja | Kategoria | Ważność | Co dzieje się w produkcji | Kierunek poprawki |
|---|---|---|---|---|---|
| 1 | `sentry.server.config.ts:59-63`; `sentry.client.config.ts:37-42` | config | **high** | Zdarzenie nadal trafia do Sentry, ale każda wartość wyjątku zostaje zastąpiona odpowiednio przez `Server error`/`Browser error`; różne awarie tracą oryginalny kod/typ i mogą się grupować razem. Użytkownik zwykle widzi lokalną odpowiedź, a osoba reagująca nie rozróżni awarii providera, bazy ani błędu aplikacji. | Zachować typ i ograniczony, scrubbed opis/kod błędu; odrzucać sekrety i treści użytkownika zamiast wszystkich wartości. |
| 2 | `sentry.server.config.ts:166-172` | missing-context | **medium** | Serwerowe zdarzenia dostają environment, ale kod nie przekazuje jawnego release. Jeśli SDK nie wywnioskuje go z Worker metadata, awaria nie da się powiązać z deployem ani source mapą. | Przekazać `CF_VERSION_METADATA.id` jako `release` do serwerowego SDK i sprawdzić event serwerowy. |
| 3 | `sentry.server.config.ts:125-164` | config | **medium** | Każda odpowiedź HTML jest w całości odczytywana i budowana ponownie, zanim opuści Worker. Przy dużych/strumieniowanych odpowiedziach podnosi to koszt pamięci i opóźnienie pierwszego bajtu; awaria tej transformacji może przerwać dostarczenie strony. | Ograniczyć transformację do dokumentów HTML, ocenić wpływ na streaming i utrzymać bezpieczny fallback do oryginalnej odpowiedzi, jeśli wzbogacanie metadanych zawiedzie. |

### Logowanie i rejestracja

| # | Lokalizacja | Kategoria | Ważność | Co dzieje się w produkcji | Kierunek poprawki |
|---|---|---|---|---|---|
| 4 | `src/pages/api/auth/signin.ts:6-17`; `src/pages/api/auth/signup.ts:6-17` | swallowed | **high** | Błędy providera auth są zamieniane na przekierowanie z tekstem błędu; awarie Supabase/email i błędne hasło trafiają do podobnego UX, lecz obsłużone wyjątki nie są jawnie wysyłane do Sentry. | Przechwytywać nieoczekiwane błędy operacyjne z kodem/status klasą operacji; dla użytkownika zwracać stabilną, bezpieczną wiadomość. |
| 5 | `src/pages/api/auth/signout.ts:5-10` | swallowed | **high** | Wynik `signOut()` jest ignorowany, po czym endpoint zawsze przekierowuje na stronę główną. Użytkownik widzi sukces, choć sesja/cookie mogły nie zostać unieważnione; responder nie otrzymuje sygnału o błędzie. | Sprawdzać wynik i rejestrować nieoczekiwaną awarię przed przekierowaniem; nie zmieniać oczekiwanych przypadków braku sesji w alarm. |
| 6 | `src/middleware.ts:13-19`; `src/lib/supabase.ts:7-9` | missing-context | **medium** | Middleware jawnie raportuje tylko część błędów `getUser`; w innych przypadkach auth może potraktować użytkownika jak niezalogowanego i przekierować go do sign-in. Awaria providera może wyglądać dla użytkownika jak wygaśnięta sesja, a zdarzenie nie zawsze wskaże etap/klasyfikację auth. | Ujednolicić rozróżnienie błędów uwierzytelnienia od błędów usługi i dołączać scrub-safe `operation`/klasę statusu. |

### Profil psa i zdjęcie

| # | Lokalizacja | Kategoria | Ważność | Co dzieje się w produkcji | Kierunek poprawki |
|---|---|---|---|---|---|
| 7 | `src/pages/api/dogs/save.ts:162-169,184-219` | coverage-gap | **critical** | Błąd zapisu/odczytu/uploadu lub rollbacku jest zamieniany na redirect, zamiast przejść jako wyjątek przez wrapper. Użytkownik widzi błąd formularza, ale Sentry nie dostaje zdarzenia operacyjnego dla kluczowej ścieżki zapisu; responder nie widzi etapu operacji. | Przechwytywać nieoczekiwany błąd przy jego obsłudze i dodać bezpieczny etap operacji/kod; utrzymać komunikat dla użytkownika niezależnie. |
| 8 | `src/pages/dashboard/dog.astro:23-26,32-34` | coverage-gap | **medium** | Błąd odczytu profilu lub brak konfiguracji jest pokazywany jako alert w stronie, lecz nie raportowany. Użytkownik widzi problem, a responder musi znać konkretny przypadek, żeby szukać w logach. | Raportować nieoczekiwane błędy odczytu/konfiguracji z etykietą operacji, bez wartości sekretów. |
| 9 | `src/pages/api/dogs/save.ts:168-169,188-190,219`; `src/pages/dashboard/dog.astro:12,56` | flattened-response | **medium** | Surowy tekst providera trafia do komunikatu i query parametru redirectu. Użytkownik otrzymuje niestabilny tekst, a szczegóły mogą pozostać w historii/nawigacji; zgłoszenie nie ma stabilnej kategorii błędu. | Zwracać stabilny kod/tekst publiczny; oryginalny błąd zachować wyłącznie w scrubbed evencie. |

### Przeglądanie, swipe i matche

| # | Lokalizacja | Kategoria | Ważność | Co dzieje się w produkcji | Kierunek poprawki |
|---|---|---|---|---|---|
| 10 | `src/components/dog/BrowseDogs.tsx:52-57,106-108,180-183`; `src/components/dog/MatchesList.tsx:57-62,106-109` | swallowed | **high** | Błędy fetch/JSON są przechwytywane przez `catch` i zamieniane na ogólny stan retry. Globalny browser handler ich nie widzi, a żadna ścieżka nie wysyła ich do Sentry. Użytkownik może ponawiać próbę, responder nie dostaje eventu. | Raportować nieoczekiwane błędy klienta z operacją i trasą, zachowując obecny privacy scrub; rozdzielić błędy transportu od pustych wyników. |
| 11 | `src/pages/api/swipes/index.ts:77-91,96-113` | flattened-response | **high** | Swipe może zostać zatwierdzony przed nieudanym odczytem matcha; endpoint zwraca błąd mimo zapisanego swipe. Retry wygląda jak duplikat albo sprzeczna odpowiedź, a Sentry nie ma jawnego kontekstu częściowego sukcesu. | Zastosować atomową operację/RPC albo jawny status „swipe zapisany, match nieustalony”; dołączyć kontekst etapu bez PII. |
| 12 | `src/pages/api/matches/index.ts:82-91,101-119` | swallowed | **medium** | Match bez załadowanego psa jest odfiltrowany z wyniku. Użytkownik nie widzi matcha, a responder nie dostaje sygnału o niespójności/RLS/odczycie. | Zgłosić anomalię integralności z bezpiecznym identyfikatorem matcha i zwrócić jawny stan częściowych danych. |

### Wiadomości realtime

| # | Lokalizacja | Kategoria | Ważność | Co dzieje się w produkcji | Kierunek poprawki |
|---|---|---|---|---|---|
| 13 | `src/components/dog/MessageThread.tsx:197-211` | coverage-gap | **critical** | Status subskrypcji Supabase Realtime nie jest obsługiwany. `CHANNEL_ERROR`, timeout lub zamknięcie może pozostawić rozmowę bez nowych wiadomości bez błędu w UI/Sentry; użytkownik zakłada, że wiadomość dotarła, a responder nie dostaje sygnału. | Obsłużyć status subskrypcji, pokazać stan połączenia/reconnect i raportować awarię kanału z identyfikatorem operacji/matcha. |
| 14 | `src/components/dog/MessageThread.tsx:195-198,207-210` | swallowed | **high** | `setAuth` jest uruchomione bez oczekiwania na rezultat, a callback danych nie waliduje `payload.new`. Błąd auth albo zmiana kształtu payloadu może przerwać odbiór/aktualizację bez kontekstu operacji. | Ustawić auth przed subskrypcją, walidować payload i obsługiwać błędy callbacku/statusu w jednym miejscu. |
| 15 | `src/pages/api/messages/index.ts:83-85,94-96,113-125,197-203` | identity-lost | **medium** | API zwraca surowe teksty Supabase, a co najmniej część błędów integralności/foreign key jest spłaszczana do „not participant”. Użytkownik dostaje błędną klasyfikację, responder nie rozróżni RLS od awarii danych. | Oddzielić oczekiwany brak uczestnictwa od nieoczekiwanych błędów bazy; używać bezpiecznych kodów odpowiedzi i scrub-safe metadanych operacji. |

## 6. Rekomendowana kolejność poprawek

1. Dodać wspólny, scrub-safe kontrakt raportowania dla błędów obsłużonych, zanim trasy zamienią je w redirect/JSON lub komponent w stan fallbacku (**#7, #8, #4, #6, #10**). Priorytetem jest brak niewidocznych awarii; nie wysyłać PII.
2. Obsłużyć lifecycle Realtime: auth przed subscribe, statusy kanału, walidacja payloadu i UI degraded/reconnect (**#13, #14**).
3. Zachować bezpieczny typ/kod/ograniczony opis wyjątku w scrubberach zamiast jednej stałej wartości (**#1, #15**); nie przywracać request body, user email, headers ani query.
4. Naprawić semantykę częściowego sukcesu swipe/match i jawnie raportować niespójne match rows (**#11, #12**).
5. Przekazać release do serwerowego SDK oraz ocenić koszt transformacji HTML (**#2, #3**).

## 7. Zmiany od poprzedniego audytu

Brak wcześniejszego raportu w `context/audits/observability/`.

## 8. Metoda i ograniczenia

- Audytowano cztery obszary wynikające z PRD i roadmapy: auth, dog profile, browse/match i messaging. Pięciu niezależnych, tylko-do-odczytu audytorów prześledziło te przepływy oraz wspólną warstwę.
- Sprawdzenie ma charakter **statyczny** dla kodu przepływów; nie uruchamiano lokalnej sondy/fake ingest, nie wstrzykiwano wyjątków i nie używano bazy ani zewnętrznych kont.
- Częściowy dowód runtime pochodzi wyłącznie ze zrzutu dostarczonego przez użytkownika: browser event dotarł do Sentry jako `preview` z release ID, URL nie był widoczny, a stack pozostawał inline/minifikowany. Nie weryfikowano payloadu JSON, eventu serwerowego, produkcyjnego source mappingu ani wpływu błędu na logi Cloudflare.
- Potwierdzono w audytorach źródła ustaleń przez śledzenie wskazanych przepływów. Nie rozstrzygano zachowania ustawień dostawcy, których repozytorium nie zawiera.
- Tożsamość audytu: commit `b87f26f`, gałąź `develop`, drzewo robocze brudne. Zmiany robocze widoczne przed audytem należały do innych prac; audyt nie modyfikował kodu aplikacji.
- Repozytoryjny sweep przekrojowy wykazał jawne `captureException` w helperze Sentry oraz użycia w middleware/obsłudze czyszczenia zdjęć; błędy przechwycone i zamieniane na wynik/redirect w analizowanych przepływach stanowią główną klasę niewidoczności. Pełne liczniki globalnych `catch`/promise fallback nie były celem osobnego automatycznego skanera, więc raport nie przedstawia ich jako wyczerpującej metryki.
- Nie utworzono worktree ani harnessu runtime dla tego audytu. Dostarczony wcześniej worktree testu Sentry to odrębna gałąź testowa, nie jest częścią tego audytu.
