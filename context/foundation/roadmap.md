---
project: "Doggo Date"
version: 1
status: draft
created: 2026-09-22
updated: 2026-10-08
prd_version: 1
main_goal: speed
top_blocker: capacity
milestone_id: first-match-and-message
milestone_seq: 1
milestone_status: closed
---

# Roadmap: Doggo Date

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: Pierwsza pętla dopasowań — profil, przeglądanie, match, wiadomość** — Status: closed

- **Intent:** Dostarczyć najmniejszy kompletny przepływ end-to-end, w którym właściciel psa zakłada profil, przegląda inne psy, tworzy dopasowanie i wymienia pierwszą wiadomość z innym właścicielem — udowadniając, że mechanizm swatania psów (a przy okazji ich właścicieli) działa.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** każde F-NN i S-NN poniżej ma status `done`.
- **Scope anchors:** US-01; FR-001, FR-002, FR-003, FR-004, FR-005, FR-006 (wszystkie must-have). FR-007 (nice-to-have) jest jawnie poza zakresem tego kamienia milowego — patrz `## Parked`.

## Vision recap

Właściciele psów nie mają dedykowanego miejsca, w którym mogliby znaleźć partnera dla swojego pupila — istniejące grupy na Facebooku i fora hodowców nie oferują dopasowania ani filtrów specyficznych dla psów. Doggo Date przedstawia psa jako „użytkownika” aplikacji, podczas gdy profilem faktycznie zarządza właściciel; dopasowanie działa jednocześnie na poziomie psów (spacer, hodowla, zabawa) i samych właścicieli, którzy poznają się nawzajem dzięki profilom swoich pupili.

## North star

**S-03: Właściciel wysyła pierwszą wiadomość do dopasowanego właściciela** — to domknięcie jedynej historyjki użytkownika z PRD (US-01): dopiero natychmiastowa wiadomość dowodzi, że mechanizm dopasowania faktycznie prowadzi do połączenia między właścicielami, a nie tylko do listy nazwisk na ekranie.

> Gwiazda przewodnia (ang. _north star_) to najmniejszy kompletny przepływ widoczny dla użytkownika, którego udane dostarczenie dowodzi głównej hipotezy produktu — umieszczony tak wcześnie, jak pozwalają na to jego zależności, ponieważ cała reszta ma znaczenie tylko wtedy, gdy ten przepływ działa.

## At a glance

| ID   | Change ID                   | Outcome (user can …)                                                                                             | Prerequisites | PRD refs                      | Status |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------- | ------ |
| F-01 | dog-profile-data-foundation | (foundation) schemat danych profilu psa (tabela `dogs` + storage zdjęcia + RLS)                                  | —             | FR-002                        | done   |
| S-01 | dog-profile-crud            | Właściciel tworzy i edytuje profil swojego psa                                                                   | F-01          | FR-001, FR-002                | done   |
| F-02 | dashboard-sidebar-nav       | (foundation) sidebar nawigacyjny zastępujący treść dashboardu, zwalniający stronę główną pod przeglądanie (S-02) | S-01          | —                             | done   |
| S-02 | browse-and-match            | Właściciel przegląda profile innych psów i tworzy dopasowanie widoczne na liście matchy                          | S-01, F-02    | US-01, FR-003, FR-004, FR-005 | done   |
| S-03 | first-message               | Właściciel wysyła i odbiera wiadomości tekstowe w czasie rzeczywistym z dopasowanym właścicielem                 | S-02          | US-01, FR-006                 | done   |

## Baseline

Co jest już na miejscu w kodzie na dzień `2026-09-22` (zbadane automatycznie + potwierdzone przez użytkownika).
Foundations poniżej zakładają, że to jest obecne i NIE odtwarzają tego od nowa.

- **Frontend:** partial — szkielet Astro+React jest (`dashboard.astro`, `Topbar`, `Banner`, komponenty auth), brak UI domenowego (profil psa, swipe, lista matchy, czat).
- **Backend / API:** partial — istnieją tylko endpointy auth (`src/pages/api/auth`), brak endpointów domenowych (psy, polubienia, matche, wiadomości).
- **Data:** absent — brak migracji Supabase (`supabase/migrations` puste), brak schematu dla psów/matchy/wiadomości.
- **Auth:** present — pełny scaffold email+hasło (signup/signin/confirm-email, `src/middleware.ts`, chronione trasy) zgodnie z FR-001.
- **Deploy / infra:** present — `wrangler.jsonc` skonfigurowany pod Cloudflare Workers, CI (lint+build), plan wdrożenia już wykonany (`context/changes/deployment/deployment-plan.md`).
- **Observability:** partial — włączone podstawowe Workers Logs (`observability.enabled` w `wrangler.jsonc`), brak app-level error trackingu (np. Sentry).

## Foundations

### F-01: Minimalny schemat danych profilu psa

- **Outcome:** (foundation) w Supabase istnieje minimalny schemat dla profili psów — tabela `dogs` (imię, wiek, jedno zdjęcie, opis) z granularnymi politykami RLS ograniczonymi do właściciela oraz bucket storage na zdjęcie profilowe. Nie jest to samo w sobie widoczne dla użytkownika.
- **Change ID:** dog-profile-data-foundation
- **PRD refs:** FR-002
- **Unlocks:** S-01 (dog-profile-crud)
- **Prerequisites:** — (zewnętrzny stan: projekt Supabase jest już skonfigurowany — potwierdzone przez istniejącą integrację auth w `src/lib/supabase.ts`)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Warstwa danych jest obecnie całkowicie nieobecna w kodzie; ustalenie wzorca migracji + RLS raz, przy pierwszej tabeli, utrzymuje spójność konwencji (wg AGENTS.md: migracje nazwane `YYYYMMDDHHmmss_opis.sql`, granularne RLS per operację) zanim kolejne trzy tabele (polubienia, matche, wiadomości) zostaną dodane slice-po-slice.
- **Status:** done

### F-02: Sidebar nawigacyjny dashboardu

- **Outcome:** (foundation) treść dashboardu (powitanie, link do profilu psa, wylogowanie) przenosi się do bocznego panelu nawigacyjnego (`Sidebar`), zwalniając stronę główną `/dashboard` pod przyszły widok przeglądania psów (S-02, browse-dogs). Nie jest to samo w sobie widoczne jako nowa funkcja użytkownika — porządkuje architekturę UI przed dodaniem kolejnych ekranów domenowych (przeglądanie, matche).
- **Change ID:** dashboard-sidebar-nav
- **PRD refs:** — (architektura UI, nie osobne FR)
- **Unlocks:** S-02 (browse-and-match) — a dokładniej jego pod-zmianę `browse-dogs`
- **Prerequisites:** S-01 (dog-profile-crud, impl_reviewed) — sidebar linkuje do `/dashboard/dog`
- **Parallel with:** match-data-foundation (pod-zmiana S-02, brak współdzielonych plików)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Niski — czysto prezentacyjna zmiana UI, bez zmian schematu ani logiki biznesowej. Ryzyko ograniczone do regresji istniejących linków (profil psa, wylogowanie) podczas przenoszenia ich z `dashboard.astro` do `Sidebar`.
- **Status:** done

## Slices

### S-01: Właściciel tworzy i edytuje profil swojego psa

- **Outcome:** właściciel może utworzyć profil swojego psa (imię, wiek, jedno zdjęcie, opis) i go edytować.
- **Change ID:** dog-profile-crud
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Kształt tabeli `dogs` (jedno zdjęcie, opis) ustala kontrakt, z którego korzystają S-02 i S-03; zmiana schematu później oznacza migrację wsteczną.
- **Status:** done

### S-02: Właściciel przegląda profile innych psów i tworzy dopasowanie

- **Outcome:** właściciel przegląda profile innych psów (swipe, bez filtrów), a przy obustronnym polubieniu powstaje match widoczny natychmiast na liście matchy.
- **Change ID:** browse-and-match
- **PRD refs:** US-01, FR-003, FR-004, FR-005
- **Prerequisites:** S-01; F-02 (dashboard-sidebar-nav); zewnętrzny stan: co najmniej kilka zasilonych profili psów do przeglądania w testach
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Reguła sortowania (najpierw najnowsze profile, potem trafność dopasowania — zdefiniowana jako liczba wspólnych `interests`) i logika „nie pokazuj ponownie już ocenionych profili” to główna logika biznesowa MVP — błąd tu bezpośrednio narusza NFR dot. płynności przeglądania (<1s, zawsze inny nieoceniony profil). Tworzenie matcha przy równoczesnym obustronnym polubieniu wymaga trigger'a DB (atomowość), nie logiki aplikacyjnej.
- **Status:** done
- **Implementation split:** ta zmiana została zrealizowana jako 3 osobne foldery zmian, wykonane po kolei, wszystkie w pełni zaimplementowane i zweryfikowane 2026-10-03: `match-data-foundation` (tabele `swipes`/`matches` + RLS + trigger — **impl_reviewed**, migracja + typy zweryfikowane lokalnie), `browse-dogs` (API przeglądania/swipe + strona główna — **implemented**, wszystkie fazy zweryfikowane), `matches-list` (API + strona listy matchy — **impl_reviewed**, APPROVED bez ustaleń krytycznych). `dashboard-sidebar-nav` (F-02) — **zmergowany do `develop`** (PR #10). Formalne `/10x-archive` dla trzech pod-zmian i przeniesienie wpisu do `## Done` pozostaje do wykonania osobno (Change ID tej umbrelli nie pokrywa się 1:1 z żadnym z trzech folderów).

### S-03: Właściciel wysyła i odbiera wiadomości w czasie rzeczywistym z dopasowanym właścicielem

- **Outcome:** właściciel wysyła i odbiera proste wiadomości tekstowe do/od dopasowanego właściciela, dostarczane natychmiast bez odświeżania strony.
- **Change ID:** first-message
- **PRD refs:** US-01, FR-006
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Wiadomości muszą być dostarczane natychmiast przez WebSocket (Supabase Realtime), nie przez polling — błędna konfiguracja Realtime/RLS na tabeli wiadomości może po cichu zdegradować UX do pollingu albo złamać prywatność wiadomości między niezmatchowanymi użytkownikami.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                   | Suggested issue title                                            | Ready for `/10x-plan`  | Notes                                                                                                 |
| ---------- | --------------------------- | ---------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| F-01       | dog-profile-data-foundation | Add minimal dog profile data schema (dogs table + RLS + storage) | yes                    | Run `/10x-plan dog-profile-data-foundation`                                                           |
| S-01       | dog-profile-crud            | Owner can create and edit their dog's profile                    | no                     | Archived, done                                                                                        |
| F-02       | dashboard-sidebar-nav       | Add sidebar navigation, free up main page for browsing           | no                     | Merged (PR #10), pending archive                                                                      |
| S-02       | browse-and-match            | Owner can browse dogs and create a match                         | n/a — już zrealizowane | Wszystkie 3 pod-zmiany zaimplementowane i zweryfikowane 2026-10-03; pozostaje formalne `/10x-archive` |
| S-03       | first-message               | Owner can send/receive real-time messages with a match           | yes                    | Odblokowane — S-02 ukończone; run `/10x-plan first-message`                                           |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. Include one row for every `F-NN` and `S-NN`. It should be compact enough to copy into issues, but it must not duplicate the detailed roadmap body.

## Open Roadmap Questions

Pełne szczegóły w `context/foundation/roadmap-questions.md` (append-only rejestr pytań przekrojowych ujawnionych przez porównanie plików fundamentowych, poza pierwszym przebiegiem `/10x-roadmap`). Żadne z poniższych nie blokuje M-1.

1. **RQ-01 — AI-owy ranking profili wg podobieństwa do wcześniejszych rozmów.** Owner: user. Block: `roadmap-wide` (potwierdzony kandydat na przyszły kamień milowy, wymaga własnego FR w PRD zanim trafi na roadmapę). GitHub: #6.
2. **RQ-02 — Brak mechanizmu zgłaszania/blokowania użytkowników.** Owner: user (decyzja w toku). Block: `roadmap-wide` (nie blokuje S-03 w M-1, ale wymaga rozstrzygnięcia przed szerszym launchem). GitHub: #7.
3. **RQ-03 — Schemat F-01 będzie wymagał rozszerzenia** pod przyszłe sygnały (AI ranking, filtry, wiele zdjęć, soft-delete matchy, spacery grupowe). Owner: team. Block: nie, informacyjne dla przyszłego planowania F-01.

## Parked

- **System kojców (chwalenie się kojcami/wybiegami i akcesoriami)** — Why parked: PRD §Non-Goals — nie wpływa na core flow randkowy.
- **Historia randek/spotkań** — Why parked: PRD §Non-Goals — brak potrzeby śledzenia historii w MVP.
- **Aparat w aplikacji do robienia zdjęć** — Why parked: PRD §Non-Goals — tylko upload istniejącego zdjęcia, bez integracji z kamerą.
- **Filtry dopasowania (wiek/zainteresowania/lokalizacja)** — Why parked: PRD §Non-Goals — odłożone do v2; potwierdzone jako kandydat na M-2 (patrz `roadmap-questions.md`).
- **Usuwanie matchy** — Why parked: PRD §Non-Goals — odłożone do v2; potwierdzone jako kandydat na M-2 (patrz `roadmap-questions.md`).
- **Moduł spacerów grupowych (GPS + mapa Leaflet, FR-007)** — Why parked: PRD §Non-Goals oraz Socrates przy FR-007 — nice-to-have, poza rdzeniem MVP; potwierdzone jako kandydat na M-2 (patrz `roadmap-questions.md`).
- **Wiele zdjęć w profilu psa (zamiast jednego)** — Why parked: PRD Socrates przy FR-002 ("jedno zdjęcie wystarczy na start"); potwierdzone jako kandydat na M-2 (patrz `roadmap-questions.md`).
- **AI-owy ranking profili wg podobieństwa do wcześniejszych rozmów** — Why parked: nowy pomysł, brak FR w PRD (RQ-01); potwierdzone jako kandydat na M-2 (patrz `roadmap-questions.md`).

## Milestone History

_(brak — to pierwszy kamień milowy tej mapy drogowej.)_

## Done

- **F-01: (foundation) schemat danych profilu psa (tabela `dogs` + storage zdjęcia + RLS)** — Archived 2026-09-25 → `context/archive/2026-09-25-dog-profile-data-foundation/`. Lesson: —.
- **S-01: Właściciel tworzy i edytuje profil swojego psa** — Archived 2026-09-26 → `context/archive/2026-09-26-dog-profile-crud/`. Lesson: —.
- **S-03: Właściciel wysyła i odbiera wiadomości w czasie rzeczywistym z dopasowanym właścicielem** — Archived 2026-10-07 → `context/archive/2026-10-03-first-message/`. Lesson: —.
