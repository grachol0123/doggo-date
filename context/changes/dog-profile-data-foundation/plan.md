# Dog Profile Data Foundation Implementation Plan

## Overview

Wprowadzamy pierwszy fragment warstwy danych Doggo Date: tabelę `dogs` w Supabase,
przechowującą profil psa (dane podstawowe wymagane przez FR-002 oraz dane
rozszerzone o rasę, charakter, poziom aktywności i zainteresowania, uzgodnione
z użytkownikiem podczas planowania), wraz z granularnymi politykami RLS,
publicznym bucketem storage na zdjęcie profilowe oraz wygenerowanymi typami TS.
To fundament (F-01 na roadmapie) — nie jest samo w sobie widoczne dla
użytkownika, ale odblokowuje S-01 (CRUD profilu psa).

## Current State Analysis

- `supabase/migrations/` jest puste — to pierwsza migracja w projekcie; ustala
  konwencję nazewnictwa (`YYYYMMDDHHmmss_opis.sql`) i wzorzec RLS dla
  kolejnych tabel (matches, messages).
- `supabase/config.toml` ma sekcję `[storage]` z zakomentowanym przykładem
  `[storage.buckets.images]` — bucket trzeba faktycznie odkomentować/skonfigurować.
- Brak `src/types.ts` — zostanie utworzony w tej zmianie.
- `src/lib/supabase.ts` tworzy klienta SSR przez `@supabase/ssr`; nie ma
  osobnej tabeli `profiles` — właściciela reprezentuje `auth.users(id)`.
- `AGENTS.md`/`CLAUDE.md` wymagają: migracje w `supabase/migrations/`
  nazwane `YYYYMMDDHHmmss_short_description.sql`, RLS włączone na każdej
  nowej tabeli z granularnymi politykami per operację/rolę.
- Lokalny Supabase CLI (`npx supabase`) wspiera `supabase test db` (pgTAP)
  oraz `supabase gen types typescript --local`.

### Key Discoveries:

- Brak istniejących migracji oznacza brak wzorca do naśladowania — ten plan
  ustanawia wzorzec (enum types + tabela + RLS + storage RLS w osobnych
  migracjach, w kolejności zależności).
- Roadmap (`context/foundation/roadmap.md`, sekcja F-01 „Risk”) wprost
  wskazuje, że kształt tabeli `dogs` jest kontraktem dla S-01/S-02/S-03 —
  stąd decyzja o otwarciu SELECT dla wszystkich zalogowanych już teraz
  (S-02 potrzebuje przeglądania cudzych profili).
- PRD (`context/foundation/prd.md`, Success Criteria → Guardrails) wymaga:
  „Dane profilowe (zdjęcia, opisy) nie są udostępniane bez zgody
  użytkownika." Publiczny bucket storage (Phase 2) spełnia ten guardrail
  przez (a) nieodgadywalne ścieżki plików (`{owner_id}/{uuid}.jpg`, nigdy
  sekwencyjne ID) i (b) fakt, że pokazywanie zdjęcia profilowego innym
  użytkownikom aplikacji jest samą istotą US-01 — nie jest to
  niezamierzone udostępnienie, tylko podstawowa funkcja produktu.
  Kompromis: plik pozostaje technicznie dostępny dla każdego, kto pozna
  URL poza aplikacją (np. wklei go publicznie) — akceptowalne na MVP,
  do rewizji, jeśli wymaganie prywatności okaże się ściślejsze.

## Desired End State

Po ukończeniu tego planu:
- W lokalnej (i docelowo produkcyjnej) bazie Supabase istnieje tabela `dogs`
  z polami podstawowymi i rozszerzonymi, CHECK constraints i RLS.
- Istnieje publiczny bucket storage `dog-photos` z RLS ograniczającym zapis
  do właściciela i limitem 5MB / typy jpeg,png,webp.
- Testy pgTAP (`supabase test db`) weryfikują RLS i constraints i przechodzą.
- `src/types.ts` zawiera wygenerowane typy Supabase, w tym typ `Dog`.

Weryfikacja: `npx supabase db reset` (czysta baza + migracje) kończy się bez
błędów, `npx supabase test db` przechodzi, `npm run lint` i `npx tsc --noEmit`
(lub `npm run build`) przechodzą z nowym `src/types.ts`.

## What We're NOT Doing

- Nie budujemy żadnego UI do tworzenia/edycji profilu (to S-01).
- Nie implementujemy logiki matchowania, polubień ani wiadomości.
- Nie tworzymy słownika ras (`breeds`) ani osobnej tabeli
  złączeniowej dla zainteresowań — `breed` to wolny tekst, `interests`/
  `temperament` to tablice.
- Nie dodajemy filtrowania/wyszukiwania po nowych polach (breed, temperament,
  activity_level, interests) — to poza zakresem MVP (PRD Non-Goals, RQ-03).
- Nie wspieramy wielu psów na właściciela (unique constraint na `owner_id`).
- Nie budujemy transformacji obrazów (miniatury) — tylko surowy upload.

## Implementation Approach

Trzy migracje w kolejności zależności: (1) typy enum + tabela `dogs` + RLS na
danych, (2) konfiguracja bucketu storage + RLS na `storage.objects`, (3) brak
migracji — testy pgTAP i wygenerowane typy TS jako osobna faza weryfikacyjna
korzystająca z wyniku faz 1-2.

## Phase 1: Migracja schematu bazy — typy enum + tabela dogs + RLS

### Overview

Tworzy `supabase/migrations/<timestamp>_create_dogs_table.sql` z dwoma typami
enum, tabelą `dogs` i granularnymi politykami RLS.

### Changes Required:

#### 1. Migracja: typy enum i tabela dogs

**File**: `supabase/migrations/<timestamp>_create_dogs_table.sql`

**Intent**: Ustanowić schemat profilu psa jako pojedyncze źródło prawdy dla
S-01/S-02/S-03. Enum `dog_activity_level` koduje 3 zamknięte poziomy
aktywności; enum `dog_interest` koduje 10 uzgodnionych wartości i jest
przechowywany jako tablica (`dog_interest[]`), by pozwolić na wiele wyborów
przy zachowaniu zamkniętej listy. Wartości enum są po angielsku (identyfikatory
techniczne); tłumaczenia na język polski (i inne) dodaje warstwa frontendowa.

**Contract**:
- `CREATE TYPE dog_activity_level AS ENUM ('homebody', 'walker', 'runner');`
  (wartości po angielsku — tłumaczenia na PL/inne języki dodane na
  frontendzie, nie w bazie)
- `CREATE TYPE dog_interest AS ENUM (` 10 wartości: `'walks', 'running', 'fetch', 'swimming', 'agility', 'obedience_training', 'playing_with_other_dogs', 'hiking', 'camping', 'car_rides'` `);`
  (jw. — angielskie identyfikatory, tłumaczenia w warstwie UI)
- Tabela `dogs`:
  - `id uuid primary key default gen_random_uuid()`
  - `owner_id uuid not null unique references auth.users(id) on delete cascade`
    (unique → jeden pies na właściciela)
  - `name text not null check (char_length(name) between 1 and 100)`
  - `age_years integer not null check (age_years >= 0 and age_years <= 40)`
  - `description text check (char_length(description) <= 500)`
  - `photo_path text` (ścieżka w storage w formacie `{owner_id}/{uuid}.{ext}`;
    nullable — profil może istnieć bez zdjęcia na etapie tworzenia, S-01
    wymusi wypełnienie w UI/zod)
  - `breed text check (char_length(breed) <= 100)`
  - `temperament text[]`
  - `activity_level dog_activity_level`
  - `interests dog_interest[]`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Trigger `updated_at` używający standardowej funkcji
  `set_updated_at()` (utworzonej w tej samej migracji), odpalany `BEFORE UPDATE`.
- `alter table dogs enable row level security;`
- Polityki RLS (per operację, zgodnie z AGENTS.md):
  - `dogs_select_authenticated`: `FOR SELECT TO authenticated USING (true)`
    (świadoma decyzja — patrz Key Discoveries: S-02 wymaga przeglądania
    cudzych profili).
  - `dogs_insert_own`: `FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id)`
  - `dogs_update_own`: `FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)`
  - `dogs_delete_own`: `FOR DELETE TO authenticated USING (auth.uid() = owner_id)`

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset --local` stosuje migrację bez błędów
- `npx supabase db lint` nie zgłasza błędów dla nowej migracji

#### Manual Verification:

- W Supabase Studio (lokalnym): próba `INSERT` do `dogs` jako zalogowany
  użytkownik A z `owner_id` użytkownika B kończy się odrzuceniem przez RLS
- `SELECT * FROM dogs` jako zalogowany użytkownik B zwraca profil użytkownika A

---

## Phase 2: Konfiguracja storage — bucket na zdjęcia + RLS

### Overview

Konfiguruje publiczny bucket `dog-photos` w `supabase/config.toml` i dodaje
migrację z politykami RLS na `storage.objects` ograniczającymi zapis do
właściciela na podstawie ścieżki pliku.

### Changes Required:

#### 1. Konfiguracja bucketu lokalnie

**File**: `supabase/config.toml`

**Intent**: Zdefiniować lokalny bucket `dog-photos` tak, by odpowiadał
bucketowi utworzonemu w Phase 2.2, z limitami zgodnymi z decyzją planowania
(5MB, jpeg/png/webp).

**Contract**: Sekcja `[storage.buckets.dog-photos]` z `public = true`,
`file_size_limit = "5MiB"`, `allowed_mime_types = ["image/jpeg", "image/png", "image/webp"]`.

#### 2. Migracja: utworzenie bucketu + RLS na storage.objects

**File**: `supabase/migrations/<timestamp>_create_dog_photos_bucket.sql`

**Intent**: Utworzyć bucket `dog-photos` (public read) i ograniczyć zapis/
usuwanie plików do właściciela, przy założeniu konwencji ścieżki
`{owner_id}/{uuid}.{ext}` (nazwa pliku to losowy UUID, nigdy nazwa
oryginalna/sekwencyjna — patrz uzasadnienie guardrail w Current State
Analysis) — pozwala to napisać politykę RLS bez dodatkowego zapytania do
tabeli `dogs`.

**Contract**:
- `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('dog-photos', 'dog-photos', true, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;`
- Polityki na `storage.objects` (bucket_id = 'dog-photos'):
  - `dog_photos_public_read`: `FOR SELECT USING (bucket_id = 'dog-photos')`
    (spójne z publicznym bucketem — read jest i tak publiczny, ale jawna
    polityka dokumentuje intencję)
  - `dog_photos_owner_write`: `FOR INSERT TO authenticated WITH CHECK (bucket_id = 'dog-photos' AND (storage.foldername(name))[1] = auth.uid()::text)`
  - `dog_photos_owner_update`: `FOR UPDATE TO authenticated USING (bucket_id = 'dog-photos' AND (storage.foldername(name))[1] = auth.uid()::text)`
  - `dog_photos_owner_delete`: `FOR DELETE TO authenticated USING (bucket_id = 'dog-photos' AND (storage.foldername(name))[1] = auth.uid()::text)`

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset --local` stosuje obie migracje bez błędów (bucket
  widoczny w `storage.buckets`)

#### Manual Verification:

- Upload pliku do ścieżki `{own_uid}/photo.jpg` jako zalogowany właściciel
  się udaje; upload do ścieżki innego `uid` jest odrzucany przez RLS
- Publiczny URL pliku (bez sesji) zwraca zdjęcie (public read działa)

---

## Phase 3: Weryfikacja i typy — testy pgTAP + wygenerowane typy TS

### Overview

Dodaje testy pgTAP potwierdzające RLS i constraints z Phase 1-2 oraz
generuje typy TypeScript z rzeczywistego schematu do `src/types.ts`.

### Changes Required:

#### 1. Testy pgTAP dla tabeli dogs

**File**: `supabase/tests/database/dogs_rls.test.sql`

**Intent**: Zweryfikować automatycznie granularne RLS (SELECT dla wszystkich
zalogowanych, INSERT/UPDATE/DELETE tylko właściciel) oraz CHECK constraints
(`age_years`, długość `description`/`name`/`breed`, unikalność `owner_id`),
tak by regresje w przyszłych migracjach (matches, messages) były wykrywane
automatycznie zamiast ręcznie.

**Contract**: Plik zgodny z konwencją `supabase test db` — używa `pgtap`
(`plan()`, `results_eq`/`throws_ok`/`lives_ok`). Mechanizm symulacji
użytkowników (jeden, bez alternatyw): ręczny `insert into auth.users (id, ...)
values (...)` dla dwóch testowych UUID, następnie przed każdym testowanym
zapytaniem `set_config('request.jwt.claims', json_build_object('sub', '<uuid>', 'role', 'authenticated')::text, true); set local role authenticated;`.
Sprawdza: (a) insert własnego psa się udaje, (b) insert psa dla innego
`owner_id` rzuca błąd RLS, (c) drugi insert dla tego samego `owner_id` rzuca
błąd unikalności, (d) `age_years = -1` rzuca błąd CHECK, (e) SELECT jako inny
zalogowany użytkownik zwraca wiersz.

#### 2. Testy pgTAP dla storage.objects

**File**: `supabase/tests/database/dog_photos_storage_rls.test.sql`

**Intent**: Zweryfikować, że RLS na `storage.objects` faktycznie ogranicza
zapis do właściciela na podstawie prefiksu ścieżki, zapobiegając regresji
konwencji `{owner_id}/{filename}` ustalonej w Phase 2.

**Contract**: Analogicznie do pliku powyżej — insert do
`storage.objects` z `name = '<own_uid>/x.jpg'` jako właściciel się udaje;
insert z `name = '<other_uid>/x.jpg'` rzuca błąd RLS.

#### 3. Wygenerowane typy TypeScript

**File**: `src/types.ts`

**Intent**: Dostarczyć typowany dostęp do tabeli `dogs` (i całego schematu)
dla przyszłych zmian (S-01 CRUD), zgodnie z konwencją AGENTS.md
(„Shared types … go in `src/types.ts`”), generowane bezpośrednio ze
schematu, by uniknąć ręcznego dryfu typów.

**Contract**: Wynik `npx supabase gen types typescript --local` zapisany
jako eksportowany typ `Database` w `src/types.ts`, plus wygodny alias
`export type Dog = Database["public"]["Tables"]["dogs"]["Row"];`.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` — wszystkie testy pgTAP przechodzą
- `npx supabase gen types typescript --local` generuje się bez błędów i
  plik `src/types.ts` zawiera typ `dogs`
- `npm run lint` przechodzi (types.ts zgodny z ESLint)
- `npm run build` przechodzi (brak błędów typów w projekcie)

#### Manual Verification:

- Przegląd wygenerowanego `src/types.ts` — pola `dogs` odpowiadają
  kolumnom z Phase 1 (nazwy, nullability, typy enum)

---

## Testing Strategy

### Unit Tests:

- Brak (fundacja bez logiki aplikacyjnej poza SQL) — pokrycie zapewniają
  testy pgTAP w Phase 3.

### Integration Tests:

- Testy pgTAP (Phase 3) pełnią rolę testów integracyjnych bazy danych:
  RLS end-to-end (insert/select/update/delete pod różnymi rolami) i
  constraints.

### Manual Testing Steps:

1. `npx supabase start` (lokalnie) → `npx supabase db reset`
2. W Supabase Studio: utworzyć dwóch testowych użytkowników przez
   `auth.users`, spróbować insert/select/update/delete na `dogs` pod każdym
   z nich zgodnie z Manual Verification z Phase 1
3. Wgrać plik testowy do bucketu `dog-photos` pod właściwą i cudzą ścieżką
   (Manual Verification z Phase 2) i sprawdzić publiczny URL

## Performance Considerations

Brak istotnych ograniczeń wydajnościowych na tym etapie — tabela `dogs` będzie
mała (setki-tysiące wierszy w horyzoncie MVP, zgodnie z `target_scale` w
`prd.md`: `data_volume: small`). Indeks unikalności na `owner_id` (tworzony
automatycznie przez `UNIQUE`) wystarcza do lookupów po właścicielu; S-02 może
później dodać indeks na `created_at` dla sortowania „najnowsze pierwsze” —
poza zakresem tej zmiany.

## Migration Notes

Baza jest pusta (brak istniejących danych) — migracje są czystym `CREATE`,
bez potrzeby backfillu ani wycofania danych.

Dodawanie nowych wartości do `dog_activity_level`/`dog_interest` w przyszłości
wymaga osobnej migracji zawierającej wyłącznie `ALTER TYPE ... ADD VALUE`, bez
używania nowej wartości w tej samej migracji/transakcji (ograniczenie
Postgresa dot. enumów).

## References

- Roadmap: `context/foundation/roadmap.md` (F-01: dog-profile-data-foundation)
- PRD: `context/foundation/prd.md` (FR-002, Non-Goals, Business Logic)
- Auth pattern: `src/lib/supabase.ts`
- Konwencje: `AGENTS.md` / `CLAUDE.md` (sekcja "Key conventions" — migracje,
  RLS, `src/types.ts`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migracja schematu bazy — typy enum + tabela dogs + RLS

#### Automated

- [x] 1.1 Migracja `db reset --local` stosuje się bez błędów — a9bbf9f
- [x] 1.2 `db lint` nie zgłasza błędów dla nowej migracji — a9bbf9f

#### Manual

- [x] 1.3 INSERT z cudzym owner_id odrzucony przez RLS — a9bbf9f
- [x] 1.4 SELECT jako inny zalogowany użytkownik zwraca profil — a9bbf9f

### Phase 2: Konfiguracja storage — bucket na zdjęcia + RLS

#### Automated

- [x] 2.1 `db reset --local` stosuje obie migracje, bucket widoczny w storage.buckets — e0a09ff

#### Manual

- [x] 2.2 Upload do własnej ścieżki działa, do cudzej jest odrzucony — e0a09ff
- [x] 2.3 Publiczny URL zwraca zdjęcie bez sesji — e0a09ff

### Phase 3: Weryfikacja i typy — testy pgTAP + wygenerowane typy TS

#### Automated

- [x] 3.1 `supabase test db` — wszystkie testy przechodzą — 9416905
- [x] 3.2 `supabase gen types typescript --local` generuje się bez błędów — 9416905
- [x] 3.3 `npm run lint` przechodzi — 9416905
- [x] 3.4 `npm run build` przechodzi — 9416905

#### Manual

- [x] 3.5 Przegląd wygenerowanego src/types.ts pod kątem zgodności ze schematem — 9416905
