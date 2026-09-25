# Dog Profile Data Foundation — Plan Brief

> Full plan: `context/changes/dog-profile-data-foundation/plan.md`

## What & Why

Budujemy pierwszą warstwę danych Doggo Date: tabelę `dogs` w Supabase z
profilem psa (dane podstawowe z FR-002 plus rozszerzenia: rasa, charakter,
poziom aktywności, zainteresowania), granularnym RLS oraz storage na zdjęcie
profilowe. To fundament (F-01), niewidoczny dla użytkownika, ale wymagany
zanim S-01 (CRUD profilu) może powstać.

## Starting Point

`supabase/migrations/` jest puste — brak jakiegokolwiek schematu domenowego.
Istnieje tylko auth (Supabase `auth.users` + scaffold email/hasło). Nie ma
`src/types.ts` ani skonfigurowanego bucketu storage.

## Desired End State

W lokalnej bazie Supabase istnieje w pełni zabezpieczona RLS tabela `dogs`,
publiczny bucket `dog-photos` z ograniczonym zapisem, przechodzące testy
pgTAP oraz wygenerowane typy TS w `src/types.ts` — gotowe do użycia przez
S-01.

## Key Decisions Made

| Decision                         | Choice                                            | Why (1 sentence)                                                                 | Source |
| --------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| Typ pola wiek                     | `age_years` integer                                | Prostsze niż birth_date, wystarczające na MVP                                       | Plan   |
| Psy na właściciela                 | Jeden (unique `owner_id`)                           | PRD mówi o "profilu psa" w liczbie pojedynczej                                      | Plan   |
| Zakres RLS SELECT                  | Wszyscy zalogowani                                  | S-02 (przeglądanie) potrzebuje odczytu cudzych profili — unika migracji wstecznej   | Plan   |
| Widoczność bucketu zdjęć           | Publiczny (public read)                             | S-02 musi wyświetlać cudze zdjęcia bez generowania signed URL per rekord            | Plan   |
| Limity zdjęcia                     | 5MB, jpeg/png/webp                                  | Chroni koszty/nadużycia storage                                                     | Plan   |
| Usunięcie konta właściciela        | `ON DELETE CASCADE`                                 | Unika osieroconych rekordów psa                                                     | Plan   |
| Limit długości opisu               | 500 znaków (CHECK)                                  | Chroni UI list/kart przed nadmiernie długim tekstem                                 | Plan   |
| Strategia typów TS                 | Generowane (`supabase gen types`)                   | Źródło prawdy = schemat SQL, brak ręcznego dryfu                                     | Plan   |
| Weryfikacja RLS                    | Automatyczne testy pgTAP                            | Trwałe zabezpieczenie przed regresją przy przyszłych migracjach (matches, messages)  | Plan   |
| Rasa (`breed`)                     | Wolny tekst                                         | Brak słownika ras w PRD; słownik to nadmiarowa złożoność na MVP                     | Plan   |
| Charakter (`temperament`)          | `text[]`                                            | Wielowartościowa cecha, spójna z `interests`                                         | Plan   |
| Poziom aktywności                  | Natywny enum Postgres (3 wartości, EN: homebody/walker/runner) | Zamknięta lista wymuszona przez bazę; tłumaczenia na frontendzie             | Plan   |
| Zainteresowania (`interests`)      | Enum (10 wartości, EN) jako tablica `dog_interest[]`| Zamknięta lista + wiele wyborów; identyfikatory EN, tłumaczenia na frontendzie | Plan   |
| Wymagalność nowych pól             | Opcjonalne (NULL dozwolony)                         | Poza pierwotnym zakresem FR-002, nie blokują flow US-01                             | Plan   |

## Scope

**In scope:**
- Tabela `dogs` (podstawowe + rozszerzone pola), enumy `dog_activity_level` i `dog_interest`
- RLS na `dogs` (SELECT: authenticated, write: owner)
- Bucket storage `dog-photos` + RLS na `storage.objects`
- Testy pgTAP dla RLS i constraints
- Wygenerowane typy TS w `src/types.ts`

**Out of scope:**
- UI tworzenia/edycji profilu (S-01)
- Logika matchowania, polubień, wiadomości
- Słownik ras, filtrowanie po nowych polach
- Wiele psów na właściciela
- Transformacje/miniatury obrazów

## Architecture / Approach

Trzy migracje SQL w Supabase, w kolejności zależności: (1) enumy + tabela
`dogs` + RLS danych, (2) bucket storage + RLS `storage.objects` (konwencja
ścieżki `{owner_id}/{filename}`), (3) testy pgTAP + generowanie typów TS jako
faza weryfikacyjna nad wynikiem faz 1-2.

## Phases at a Glance

| Phase                         | What it delivers                                     | Key risk                                                    |
| ------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| 1. Migracja schematu bazy       | Enumy + tabela `dogs` + RLS na danych                   | Zły zakres SELECT RLS złamałby S-02 wstecznie                   |
| 2. Konfiguracja storage         | Bucket `dog-photos` + RLS na `storage.objects`          | Zła konwencja ścieżki uniemożliwi RLS bez dodatkowego zapytania |
| 3. Weryfikacja i typy           | Testy pgTAP + `src/types.ts`                            | Brak testów oznacza ciche regresje RLS w przyszłych migracjach  |

**Prerequisites:** Lokalny Supabase CLI + Docker uruchomione (`npx supabase start`); brak zależności od innych zmian.
**Estimated effort:** ~1 sesja implementacyjna, 3 fazy.

## Open Risks & Assumptions

- Zakładamy, że `authenticated` SELECT na wszystkich profilach jest
  akceptowalne z perspektywy prywatności na MVP (PRD nie definiuje inaczej;
  zgodne z US-01 — przeglądanie cudzych profili jest rdzeniem produktu).
- 10 wartości enum `interests` (i 3 wartości `activity_level`) zostało
  zaproponowane przez agenta na wyraźną prośbę użytkownika ("wymyśl 10") —
  zapisane po angielsku jako identyfikatory techniczne; tłumaczenia dodaje
  frontend. Do rewizji, jeśli okażą się nietrafne po pierwszych realnych
  profilach.
- Konwencja ścieżki storage `{owner_id}/{filename}` jest założeniem
  implementacyjnym — S-01 musi jej przestrzegać przy uploadzie.

## Success Criteria (Summary)

- `npx supabase db reset` stosuje wszystkie migracje bez błędów.
- `npx supabase test db` — testy RLS/constraints przechodzą.
- `src/types.ts` zawiera aktualny typ `Dog` gotowy do użycia przez S-01.
