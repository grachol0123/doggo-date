<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Dog Profile Data Foundation Implementation Plan

- **Plan**: context/changes/dog-profile-data-foundation/plan.md
- **Mode**: Deep
- **Date**: 2026-09-25
- **Verdict**: SOUND (po zastosowaniu poprawek F1, F2, F3 — patrz sekcja Findings poniżej)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: existing paths 5/5 ✓ (supabase/config.toml, src/lib/supabase.ts, AGENTS.md, CLAUDE.md, context/foundation/roadmap.md); net-new paths (supabase/migrations/*, supabase/tests/database/*, src/types.ts) correctly absent — this is greenfield foundation work; symbols 3/3 plausible ✓ (gen_random_uuid() built-in since PG13, confirmed local major_version=17; storage.foldername() is a documented Supabase storage helper; auth.users exists as Supabase default schema) but pgTAP auto-provisioning by `supabase test db` could not be confirmed from repo config (see F1); brief↔plan ✓ (decyzje i wartości enum spójne po ostatniej edycji na angielskie identyfikatory).

## Findings

### F1 — pgTAP auth-user simulation left as an "either/or" without a chosen mechanism

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Testy pgTAP dla tabeli dogs
- **Detail**: Plan.md (Phase 3.1 Contract) opisuje symulację różnych użytkowników jako „tworzy dwóch testowych użytkowników w auth.users (lub używa supabase_test_helpers, jeśli dostępne)" i przełączanie roli przez `set_config('request.jwt.claims', ...)` **lub** `SET LOCAL ROLE ... SET LOCAL "request.jwt.claim.sub"`. Subagent potwierdził: repo nie ma żadnego istniejącego wzorca testowania RLS (brak w `supabase/`, `scripts/`, `AGENTS.md`, `CLAUDE.md`), `supabase/config.toml` nie wspomina pgTAP ani rozszerzeń, a plik testowy jeszcze nie istnieje. To zostawia implementującemu decyzję między dwoma niekompatybilnymi podejściami w środku budowy Phase 3 — realne ryzyko utknięcia na automatycznym kryterium sukcesu 3.1.
- **Fix**: Wybierz jeden konkretny mechanizm przed implementacją — rekomendacja: ręczny insert do `auth.users` (bez zależności od `supabase_test_helpers`, którego dostępność nie jest potwierdzona) + `set_config('request.jwt.claims', json_build_object('sub', <uuid>, 'role','authenticated')::text, true); set local role authenticated;` przed każdym testowanym zapytaniem. Zaktualizuj Contract w Phase 3.1, usuwając gałąź „lub".
- **Decision**: FIXED via Fix (single mechanism specified in plan.md Phase 3.1 Contract)

### F2 — Public storage bucket vs. PRD guardrail on profile-data sharing not cross-checked

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Konfiguracja storage; Overview/Current State Analysis
- **Detail**: PRD (`context/foundation/prd.md`, Success Criteria → Guardrails) stwierdza: „Dane profilowe (zdjęcia, opisy) nie są udostępniane bez zgody użytkownika." Plan robi bucket `dog-photos` publicznym (`public = true`), co oznacza, że zdjęcia są dostępne pod publicznym URL-em bez żadnego uwierzytelnienia — szerzej niż "wszyscy zalogowani" (decyzja przyjęta dla SELECT na tabeli `dogs`). Plan nigdzie nie odnosi decyzji o public bucket do tego konkretnego guardrail-a z PRD — brakuje jawnego uzasadnienia, dlaczego publiczny, niezalogowany dostęp do zdjęć jest zgodny z tym wymaganiem.
- **Fix A ⭐ Recommended**: Zachowaj publiczny bucket, ale udokumentuj w planie (Current State Analysis / Key Discoveries), że guardrail jest spełniony przez (a) losowe/nieodgadywalne nazwy plików (np. `{owner_id}/{uuid}.jpg`, nigdy sekwencyjne) i (b) fakt, że udostępnienie zdjęcia profilowego innym użytkownikom aplikacji jest samą istotą US-01.
  - Strength: Zero dodatkowej złożoności w S-02 (brak potrzeby generowania signed URL per zdjęcie w liście przeglądania); zgodne z pierwotną decyzją z rundy pytań.
  - Tradeoff: Zdjęcie pozostaje technicznie dostępne dla każdego z URL-em poza aplikacją — nieodwracalne bez re-uploadu pod nową ścieżką.
  - Confidence: MED — brak w PRD jednoznacznej definicji "zgody"; to interpretacja rozsądna, ale nie potwierdzona przez użytkownika/product ownera.
  - Blind spot: Nie zweryfikowano z użytkownikiem, czy "zgoda" w PRD oznacza coś węższego.
- **Fix B**: Zmień bucket na prywatny + generuj signed URL po stronie serwera przy renderowaniu list/kart w S-02 (poza zakresem tego planu, ale trzeba to odnotować jako zależność dla S-02).
  - Strength: Ściślejsza zgodność z guardrail — zdjęcie nigdy nie jest dostępne bez przejścia przez logikę aplikacji.
  - Tradeoff: S-02 musi generować signed URL dla każdego zdjęcia na liście — dodatkowy koszt przy każdym renderze, dokładnie ryzyko nazwane w oryginalnym pytaniu planowania.
  - Confidence: HIGH — standardowy, bezpieczniejszy wzorzec Supabase Storage.
  - Blind spot: Wpływ na wydajność S-02 (NFR: <1s ładowanie kolejnego profilu) nie zmierzony.
- **Decision**: FIXED via Fix A (guardrail justification + UUID filename convention added to plan.md Current State Analysis and Phase 2.2 Intent)

### F3 — Enum types require out-of-transaction `ALTER TYPE ... ADD VALUE` for future additions

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Migracja: typy enum i tabela dogs
- **Detail**: `dog_activity_level` i `dog_interest` jako natywne enumy Postgres oznaczają, że dodanie nowej wartości w przyszłości wymaga `ALTER TYPE ... ADD VALUE`, które w niektórych kontekstach nie może być użyte w tej samej transakcji, w której nowa wartość jest odczytywana. Nie blokuje to obecnego planu, ale warto to odnotować dla przyszłych zmian schematu (RQ-03 z roadmapy już przewiduje rozszerzenia).
- **Fix**: Dodaj jedno zdanie w Migration Notes: „Dodawanie nowych wartości do dog_activity_level/dog_interest wymaga osobnej migracji z samym ALTER TYPE ... ADD VALUE, bez użycia nowej wartości w tej samej migracji."
- **Decision**: FIXED via Fix (added to plan.md Migration Notes)
