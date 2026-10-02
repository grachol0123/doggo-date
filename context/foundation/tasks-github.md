# Tasks (na podstawie GitHub Issues)

> Wygenerowano na podstawie `gh issue list` w repo `grachol0123/doggo-date` (2026-09-22).
> Wszystkie 7 issues jest otwartych, brak zamkniętych.

## Milestone: M-1 — Pierwsza pętla dopasowań — profil, przeglądanie, match, wiadomość

**Issue:** [#5](https://github.com/grachol0123/doggo-date/issues/5) · **Milestone ID:** `first-match-and-message`

**Intent:** Dostarczyć najmniejszy kompletny przepływ end-to-end: właściciel zakłada profil psa → przegląda inne psy → tworzy dopasowanie → wymienia pierwszą wiadomość z innym właścicielem.

**North star 🌟:** #4 — Właściciel wysyła pierwszą wiadomość do dopasowanego właściciela.

### Baseline (2026-09-22)

| Obszar        | Status                                                  |
| ------------- | ------------------------------------------------------- |
| Frontend      | partial — szkielet Astro+React, brak UI domenowego      |
| Backend/API   | partial — tylko endpointy auth                          |
| Data          | absent — brak migracji Supabase                         |
| Auth          | present — pełny scaffold email+hasło                    |
| Deploy/infra  | present — Cloudflare Workers + CI, wdrożone             |
| Observability | partial — podstawowe Workers Logs, brak error trackingu |

### Zadania (kolejność zależności)

- [ ] **#1 — [F-01] Minimalny schemat danych profilu psa** (`foundation`, status: **ready**)
  - Change ID: `dog-profile-data-foundation`
  - Outcome: tabela `dogs` (imię, wiek, jedno zdjęcie, opis) w Supabase z granularnymi RLS ograniczonymi do właściciela + storage bucket na zdjęcie. Nie jest widoczne dla użytkownika.
  - PRD refs: FR-002
  - Unlocks: S-01 (#2)
  - Prerequisites: brak (projekt Supabase już skonfigurowany, potwierdzone przez `src/lib/supabase.ts`)
  - Ryzyko: warstwa danych obecnie nieobecna — trzeba ustalić wzorzec migracji + RLS raz, zanim dojdą kolejne 3 tabele (polubienia, matche, wiadomości).
  - Do zaplanowania: `/10x-plan dog-profile-data-foundation`

- [ ] **#2 — [S-01] Właściciel tworzy i edytuje profil swojego psa** (`slice`, status: **proposed**, blocked by #1)
  - Change ID: `dog-profile-crud`
  - Outcome: właściciel tworzy profil psa (imię, wiek, jedno zdjęcie, opis) i może go edytować.
  - PRD refs: FR-001, FR-002
  - Ryzyko: kształt tabeli `dogs` ustala kontrakt używany przez S-02 i S-03 — zmiana schematu później = migracja wsteczna.
  - Do zaplanowania: `/10x-plan dog-profile-crud`

- [ ] **#3 — [S-02] Właściciel przegląda profile i tworzy dopasowanie** (`slice`, status: **proposed**, blocked by #2)
  - Change ID: `browse-and-match`
  - Outcome: przeglądanie profili psów (swipe, bez filtrów); przy obustronnym polubieniu powstaje match widoczny natychmiast na liście matchy.
  - PRD refs: US-01, FR-003, FR-004, FR-005
  - Wymaga też: co najmniej kilku zasilonych profili psów do testów.
  - Ryzyko: sortowanie (najpierw najnowsze, potem trafność) + logika „nie pokazuj ponownie ocenionych profili” to kluczowa logika MVP — błąd narusza NFR płynności (<1s, zawsze inny nieoceniony profil).
  - Do zaplanowania: `/10x-plan browse-and-match`

- [ ] **#4 — [S-03] Właściciel wysyła pierwszą wiadomość** 🌟 North star (`slice`, status: **proposed**, blocked by #3)
  - Change ID: `first-message`
  - Outcome: wysyłanie/odbieranie prostych wiadomości tekstowych do/od dopasowanego właściciela, dostarczanych natychmiast bez odświeżania strony.
  - PRD refs: US-01, FR-006
  - Ryzyko: wiadomości muszą iść przez WebSocket (Supabase Realtime), nie polling — błędna konfiguracja Realtime/RLS może po cichu zdegradować UX do pollingu albo złamać prywatność wiadomości między niezmatchowanymi użytkownikami.
  - Do zaplanowania: `/10x-plan first-message`

## Otwarte pytania roadmapy (nie blokują M-1)

- [ ] **#6 — [RQ-01] AI-owy ranking profili wg podobieństwa do wcześniejszych rozmów**
  - Status: potwierdzony kandydat na rozszerzenie po M-1 (M-2)
  - Kontekst: `tech-stack.md` deklaruje `has_ai: true`, `infrastructure.md` przewiduje `OPENROUTER_API_KEY`, ale PRD nie zawiera FR opisującego funkcję AI.
  - Pomysł (potwierdzony przez użytkownika): ranking proponowanych profili psów uwzględniający AI — preferowanie profili podobnych do tych, z którymi użytkownik już rozmawiał; im więcej rozmów, tym silniejszy wpływ podobieństwa.
  - Next step: potrzebny nowy FR w kolejnej rewizji PRD — doprecyzować definicję „podobieństwa” (cechy profilu vs. podsumowanie rozmów przez OpenRouter) zanim trafi na roadmapę jako slice.

- [ ] **#7 — [RQ-02] Brak mechanizmu zgłaszania/blokowania użytkowników (trust & safety)**
  - Status: decyzja w toku (nie potwierdzone jako kandydat na rozszerzenie ani jako świadomy Non-Goal)
  - Kontekst: aplikacja umożliwia czat w czasie rzeczywistym między obcymi osobami (FR-006), ale PRD nie wspomina o zgłaszaniu/blokowaniu nadużywających profili — jedyny guardrail dotyczy zgody na dane/zdjęcia.
  - Next step: zdecydować i zapisać jedno z:
    - (a) jawnie przenieść do `## Non-Goals` dla MVP z uzasadnieniem, lub
    - (b) dodać jako FR (must-have/nice-to-have) w rewizji PRD.

## Odłożone poza zakres M-1 (kandydaci na M-2)

- System kojców (PRD §Non-Goals)
- Historia randek/spotkań (PRD §Non-Goals)
- Aparat w aplikacji do zdjęć (PRD §Non-Goals)
- Filtry dopasowania (wiek/zainteresowania/lokalizacja)
- Usuwanie matchy
- Moduł spacerów grupowych (GPS + mapa Leaflet, FR-007)
- Wiele zdjęć w profilu psa (zamiast jednego)
- AI-owy ranking profili (#6)
