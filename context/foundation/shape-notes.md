---
project: "HamstaDate"
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-11-04
  after_hours_only: true
created: 2026-09-16
updated: 2026-09-16
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "MVP scope"
      decision: "Zawężone do: rejestracja, profil (jedno zdjęcie), przeglądanie/swipe bez filtrów, match, lista matchy z prostymi wiadomościami tekstowymi. Filtry, import z galerii, usuwanie matchy odłożone poza pierwszą wersję (3 tygodnie)."
    - topic: "auth model"
      decision: "Login przez email + hasło; płaski model uprawnień, brak ról."
    - topic: "insight"
      decision: "Istniejące platformy randkowe/hodowlane są skierowane do ludzi; nisza chomikowa nie jest obsłużona dedykowanym narzędziem z filtrami i dopasowaniem."
    - topic: "primary persona scope"
      decision: "Właściciel chomika, który zakłada i prowadzi profil w imieniu zwierzaka. Produkt żartobliwie przedstawia chomika jako użytkownika/aktora w interfejsie."
  frs_drafted: 6
  quality_check_status: accepted
---

## Vision & Problem Statement

Właściciele chomików nie mają dedykowanego miejsca, w którym mogliby znaleźć partnera dla swojego zwierzaka — w momencie, gdy szukają towarzysza (dla towarzystwa, hodowli lub po prostu dla zabawy w społeczności miłośników chomików), korzystają z ogólnych grup na Facebooku i forów hodowców, które nie oferują dopasowania ani filtrów specyficznych dla chomików (wiek, zainteresowania, lokalizacja).

Istniejące platformy randkowe są skierowane do ludzi, więc nisza chomikowa pozostaje nieobsłużona przez dedykowane narzędzie. HamstaDate to żartobliwy, ale funkcjonalny produkt: przedstawia chomika jako "użytkownika" aplikacji, podczas gdy w praktyce profilem zarządza jego właściciel.

## User & Persona

**Właściciel chomika** — zakłada konto i tworzy profil swojego zwierzaka (imię, wiek, zdjęcie, opis), przegląda profile innych chomików, dopasowuje je na podstawie filtrów i komunikuje się z innymi właścicielami w imieniu swoich chomików. Sięga po aplikację, gdy chce znaleźć chomikowi partnera lub po prostu chce być częścią społeczności miłośników chomików.

## Access Control

Logowanie przez email + hasło. Każdy właściciel chomika rejestruje konto i zarządza profilem swojego chomika. Płaski model uprawnień — brak ról (admin/moderator) w MVP; wszyscy zarejestrowani właściciele mają te same uprawnienia. Widzi swój profil chomika, przegląda profile innych chomików, dopasowuje je i wysyła wiadomości w imieniu swojego zwierzaka.

## Success Criteria

### Primary
- 1000 zarejestrowanych chomików i 500 aktywnych użytkowników w ciągu pierwszych 3 miesięcy.

### Secondary
- Wzrost liczby dopasowań i wiadomości wysyłanych między chomikami w czasie; pozytywne opinie użytkowników na temat funkcjonalności i użyteczności platformy.

### Guardrails
- Wskaźnik retencji ≥ 50% użytkowników powracających po pierwszym miesiącu.
- Dane profilowe (zdjęcia, opisy) nie są udostępniane bez zgody użytkownika.

## Timeline acknowledgment

Zawężono zakres MVP do 3-tygodniowego przepływu (patrz `timeline_budget.mvp_weeks` we frontmatter). Pierwotny szacunek (25 tygodni, pełny zestaw funkcji z notatek) został świadomie odrzucony na rzecz mniejszego pierwszego przepływu.

## Functional Requirements

- FR-001: Właściciel może zarejestrować się i zalogować (email + hasło). Priority: must-have
  > Socrates: Kontrargument rozważony: "OAuth byłby szybszy i bezpieczniejszy niż własna obsługa haseł." Rozstrzygnięcie: bez zmian — email+hasło wystarczy na MVP.
- FR-002: Właściciel może utworzyć i edytować profil chomika (imię, wiek, jedno zdjęcie, opis). Priority: must-have
  > Socrates: Kontrargument rozważony: "jedno zdjęcie może być zbyt ubogie do oceny dopasowania." Rozstrzygnięcie: bez zmian — jedno zdjęcie wystarczy na start.
- FR-003: Właściciel może przeglądać profile innych chomików (swipe, bez filtrów). Priority: must-have
  > Socrates: Kontrargument rozważony: "bez filtra lokalizacji dopasowania mogą być bezużyteczne." Rozstrzygnięcie: filtrowanie po cechach chomika i lokalizacji odłożone poza MVP; jeśli wróci, lokalizacja będzie prostym polem tekstowym, nie geolokalizacją.
- FR-004: System tworzy match przy obustronnym polubieniu. Priority: must-have
  > Socrates: Kontrargument rozważony: brak — to fundamentalny mechanizm produktu. Rozstrzygnięcie: bez zmian.
- FR-005: Właściciel widzi listę swoich matchy. Priority: must-have
  > Socrates: Kontrargument rozważony: brak — niezbędne do korzystania z matchy. Rozstrzygnięcie: bez zmian.
- FR-006: Właściciel może wysyłać i odbierać proste wiadomości tekstowe do matcha. Priority: must-have
  > Socrates: Kontrargument rozważony: "brak wsparcia dla zdjęć/emoji może być zbyt ubogi." Rozstrzygnięcie: bez zmian — czysty tekst wystarczy na MVP.

## User Stories

### US-01: Właściciel znajduje partnera dla chomika i wysyła pierwszą wiadomość

- **Given** zalogowany właściciel z utworzonym profilem chomika
- **When** przegląda profile innych chomików i poleci profil, który również polubi jego chomika
- **Then** powstaje match widoczny na liście matchy, a właściciel może wysłać wiadomość tekstową do drugiego właściciela

#### Acceptance Criteria
- Match powstaje wyłącznie przy obustronnym polubieniu (nie przy jednostronnym).
- Lista matchy jest widoczna natychmiast po powstaniu matcha.
- Wiadomość tekstowa dociera do drugiego właściciela bez opóźnienia większego niż odświeżenie widoku.

## Non-Functional Requirements

- Aplikacja jest użytkowalna zarówno w przeglądarce desktopowej, jak i mobilnej.
- Kolejny profil do przejrzenia ładuje się w czasie poniżej 1 sekundy od akcji polubienia/odrzucenia.
- Każda akcja użytkownika (polubienie/odrzucenie) daje widoczną informację zwrotną o przejściu do kolejnego profilu.
- Użytkownikowi zawsze proponowany jest inny, jeszcze nieoceniony profil — nie pokazuje ponownie profili już zmatchowanych lub odrzuconych, dopóki dostępne są nowe.

## Business Logic

Aplikacja porządkuje przeglądane profile chomików najpierw według najnowszych profili, a dopiero w dalszej kolejności bierze pod uwagę dopasowanie.

Regułę zasilają: data utworzenia/aktualizacji profilu chomika oraz sygnały dopasowania (np. wspólne cechy, wcześniejsze interakcje). Wynikiem jest kolejność, w jakiej właściciel widzi profile podczas przeglądania — najpierw najnowsze, potem pozostałe uszeregowane wg trafności dopasowania. Właściciel doświadcza tej reguły podczas przeglądania/swipe'owania — nie widzi jej mechanizmu, tylko efekt: świeże profile na górze listy.

## Non-Goals

- System klatki (chwalenie się klatkami/akcesoriami) — poza zakresem, nie wpływa na core flow randkowy.
- Historia randek/spotkań — poza zakresem, brak potrzeby śledzenia historii w MVP.
- Aparat w aplikacji do robienia zdjęć — tylko upload istniejącego zdjęcia, bez integracji z kamerą.
- Filtry dopasowania (wiek/zainteresowania/lokalizacja) — odłożone do v2 (patrz Socrates przy FR-003).
- Usuwanie matchy — odłożone do v2.

## Open Questions

_(brak — kontrola jakości zakończona bez luk)_
