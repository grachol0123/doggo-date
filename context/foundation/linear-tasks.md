# Tasks (na podstawie Linear)

> Wygenerowano na podstawie `list_issues` w workspace Linear (`doggo-date`), zespół **Doggo-date**, 2026-09-22; statusy odświeżone 2026-10-03.
> Wszystkie zadania roadmapy zostały zmigrowane z GitHub Issues (etykieta `Migrated`) i są 1:1 powiązane z odpowiadającymi issues w `grachol0123/doggo-date` (patrz `tasks-github.md`).

## Milestone: M-1 — Pierwsza pętla dopasowań — profil, przeglądanie, match, wiadomość

**Linear:** [DOG-9](https://linear.app/doggo-date/issue/DOG-9/m-1-pierwsza-petla-dopasowan-profil-przegladanie-match-wiadomosc) · **Status:** Backlog
**GitHub:** [#5](https://github.com/grachol0123/doggo-date/issues/5)

**Intent:** Dostarczyć najmniejszy kompletny przepływ end-to-end: właściciel zakłada profil psa → przegląda inne psy → tworzy dopasowanie → wymienia pierwszą wiadomość z innym właścicielem.

**North star 🌟:** DOG-8 — Właściciel wysyła pierwszą wiadomość do dopasowanego właściciela.

### Zadania (kolejność zależności)

- [x] **DOG-5 — [F-01] Minimalny schemat danych profilu psa** — status: **Done** ✅
  - Etykiety: `roadmap`, `foundation`, `status:ready`, `Migrated`
  - GitHub: [#1](https://github.com/grachol0123/doggo-date/issues/1) — zamknięty
  - Outcome: tabela `dogs` (imię, wiek, jedno zdjęcie, opis) w Supabase z granularnymi RLS ograniczonymi do właściciela + storage bucket na zdjęcie. Nie jest widoczne dla użytkownika.
  - PRD refs: FR-002
  - Unlocks: DOG-6 (S-01)
  - Prerequisites: brak (projekt Supabase już skonfigurowany)
  - Archived 2026-09-25 → `context/archive/2026-09-25-dog-profile-data-foundation/`.

- [x] **DOG-6 — [S-01] Właściciel tworzy i edytuje profil swojego psa** — status: **Done** ✅
  - Etykiety: `roadmap`, `slice`, `status:proposed`, `Migrated`
  - GitHub: [#2](https://github.com/grachol0123/doggo-date/issues/2) — zamknięty
  - Outcome: właściciel tworzy profil psa (imię, wiek, jedno zdjęcie, opis) i może go edytować.
  - PRD refs: FR-001, FR-002
  - Blocked by: DOG-5
  - Archived 2026-09-26 → `context/archive/2026-09-26-dog-profile-crud/`.

- [x] **DOG-13 — [F-02] Sidebar nawigacyjny dashboardu** — status: **Done** ✅ (nie uwzględnione w migracji 2026-09-22, dodane później)
  - Etykiety: `roadmap`, `foundation`, `status:proposed`
  - GitHub: [#9](https://github.com/grachol0123/doggo-date/issues/9) — zamknięty
  - Outcome: sidebar nawigacyjny zastępujący treść dashboardu, zwalniający stronę główną pod przeglądanie (S-02).
  - Merged (PR #10), pending formal archive.

- [x] **DOG-7 — [S-02] Właściciel przegląda profile i tworzy dopasowanie** — status: **Done** ✅ (przełożone z Backlog, 2026-10-03)
  - Etykiety: `roadmap`, `slice`, `status:proposed` (nieaktualna, nieczyszczona przy zamknięciu — patrz konwencja #2/#9), `Migrated`
  - GitHub: [#3](https://github.com/grachol0123/doggo-date/issues/3) — zamknięty automatycznie przez integrację Linear↔GitHub
  - Outcome: przeglądanie profili psów (swipe, bez filtrów); przy obustronnym polubieniu powstaje match widoczny natychmiast na liście matchy.
  - PRD refs: US-01, FR-003, FR-004, FR-005
  - Blocked by: DOG-6
  - Zaimplementowane jako 3 pod-zmiany (`match-data-foundation`, `browse-dogs`, `matches-list`), zweryfikowane 2026-10-03. Formalny `/10x-archive` pozostaje do wykonania.

- [ ] **DOG-8 — [S-03] Właściciel wysyła pierwszą wiadomość** 🌟 North star — status: **In Progress** (przełożone z Backlog, 2026-10-03)
  - Etykiety: `roadmap`, `slice`, `status:proposed` (nieaktualna — prerequisite DOG-7 już done), `Migrated`
  - GitHub: [#4](https://github.com/grachol0123/doggo-date/issues/4)
  - Outcome: wysyłanie/odbieranie prostych wiadomości tekstowych do/od dopasowanego właściciela, dostarczanych natychmiast bez odświeżania strony.
  - PRD refs: US-01, FR-006
  - Blocked by: DOG-7 (odblokowane)
  - `context/changes/first-message/change.md` → status: implemented (kod wdrożony i zweryfikowany wg planu), jeszcze nie impl_reviewed/zarchiwizowany.

## Otwarte pytania roadmapy (nie blokują M-1)

- [ ] **DOG-10 — [RQ-01] AI-owy ranking profili wg podobieństwa do wcześniejszych rozmów** — status: **Backlog**
  - Etykiety: `question`, `roadmap`, `Migrated`
  - GitHub: [#6](https://github.com/grachol0123/doggo-date/issues/6)
  - Status: potwierdzony kandydat na rozszerzenie po M-1 (M-2).

- [ ] **DOG-11 — [RQ-02] Brak mechanizmu zgłaszania/blokowania użytkowników (trust & safety)** — status: **Backlog**
  - Etykiety: `question`, `roadmap`, `Migrated`
  - GitHub: [#7](https://github.com/grachol0123/doggo-date/issues/7)
  - Status: decyzja w toku (nie potwierdzone jako kandydat na rozszerzenie ani jako świadomy Non-Goal).

## Uwagi

- Domyślne, niezwiązane z projektem taski onboardingowe Linear (DOG-1 „Get familiar with Linear”, DOG-2 „Connect your tools”, DOG-3 „Import your data”, DOG-4 „Set up your teams”) — status: Todo, pominięte w powyższym zestawieniu roadmapy.
- Porównanie z GitHub Issues: pełna zgodność 1:1, brak rozbieżności w zakresie (patrz `tasks-github.md` w katalogu głównym repo).
