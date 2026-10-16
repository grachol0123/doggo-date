---
project: "Doggo Date"
version: 2
status: draft
created: 2026-09-17
updated: 2026-10-16
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
---

## Vision & Problem Statement

Właściciele psów nie mają dedykowanego miejsca, w którym mogliby znaleźć partnera dla swojego pupila — w momencie, gdy szukają towarzysza (do wspólnych spacerów, hodowli lub po prostu dla zabawy w społeczności miłośników psów), korzystają z ogólnych grup na Facebooku i forów hodowców, które nie oferują dopasowania ani filtrów specyficznych dla psów (wiek, zainteresowania, lokalizacja).

Istniejące platformy randkowe są skierowane do ludzi, więc nisza psich właścicieli pozostaje nieobsłużona przez dedykowane narzędzie. Doggo Date to żartobliwy, ale funkcjonalny produkt: przedstawia psa jako "użytkownika" aplikacji, podczas gdy w praktyce profilem zarządza jego właściciel.

Dopasowanie działa na dwóch poziomach: mogą łączyć się w pary psy (np. do hodowli, wspólnych spacerów czy zabawy) oraz — przy tej samej okazji — sami właściciele, którzy poznają się nawzajem dzięki profilom swoich pupili i mogą nawiązać własną relację.

## User & Persona

**Właściciel psa** — zakłada konto i tworzy profil swojego psa (imię, wiek, zdjęcie, opis), przegląda profile innych psów, dopasowuje je na podstawie filtrów i komunikuje się z innymi właścicielami w imieniu swoich psów. Sięga po aplikację, gdy chce znaleźć psu partnera, dołączyć do wspólnego spaceru lub po prostu chce być częścią społeczności miłośników psów. Dopasowanie psów jest jednocześnie okazją do dopasowania samych właścicieli — para może polubić się zarówno "w imieniu" swoich psów, jak i osobiście.

## Success Criteria

### Primary

- 1000 zarejestrowanych psów i 500 aktywnych użytkowników w ciągu pierwszych 3 miesięcy.

### Secondary

- Wzrost liczby dopasowań i wiadomości wysyłanych między właścicielami psów w czasie; pozytywne opinie użytkowników na temat funkcjonalności i użyteczności platformy.

### Guardrails

- Wskaźnik retencji ≥ 50% użytkowników powracających po pierwszym miesiącu.
- Dane profilowe (zdjęcia, opisy) nie są udostępniane bez zgody użytkownika.

## User Stories

### US-01: Właściciel znajduje partnera dla psa i wysyła pierwszą wiadomość

- **Given** zalogowany właściciel z utworzonym profilem psa
- **When** przegląda profile innych psów i poleci profil, który również polubi jego psa
- **Then** powstaje match widoczny na liście matchy, a właściciel może wysłać wiadomość tekstową do drugiego właściciela

#### Acceptance Criteria

- Match powstaje wyłącznie przy obustronnym polubieniu (nie przy jednostronnym).
- Lista matchy jest widoczna natychmiast po powstaniu matcha.
- Wiadomość tekstowa dociera do drugiego właściciela natychmiast, bez potrzeby odświeżania widoku, za pośrednictwem połączenia WebSocket.

## Functional Requirements

- FR-001: Właściciel może zarejestrować się i zalogować (email + hasło). Priority: must-have
  > Socrates: Kontrargument rozważony: "OAuth byłby szybszy i bezpieczniejszy niż własna obsługa haseł." Rozstrzygnięcie: bez zmian — email+hasło wystarczy na MVP.
- FR-002: Właściciel może utworzyć i edytować profil psa (imię, wiek, jedno zdjęcie, opis). Priority: must-have
  > Socrates: Kontrargument rozważony: "jedno zdjęcie może być zbyt ubogie do oceny dopasowania." Rozstrzygnięcie: bez zmian — jedno zdjęcie wystarczy na start.
- FR-003: Właściciel może przeglądać profile innych psów (swipe, bez filtrów). Priority: must-have
  > Socrates: Kontrargument rozważony: "bez filtra lokalizacji dopasowania mogą być bezużyteczne." Rozstrzygnięcie: filtrowanie po cechach psa i lokalizacji odłożone poza MVP; jeśli wróci, lokalizacja będzie prostym polem tekstowym, nie geolokalizacją.
- FR-004: System tworzy match przy obustronnym polubieniu. Priority: must-have
  > Socrates: Kontrargument rozważony: brak — to fundamentalny mechanizm produktu. Rozstrzygnięcie: bez zmian.
- FR-005: Właściciel widzi listę swoich matchy. Priority: must-have
  > Socrates: Kontrargument rozważony: brak — niezbędne do korzystania z matchy. Rozstrzygnięcie: bez zmian.
- FR-006: Właściciel może wysyłać i odbierać proste wiadomości tekstowe do matcha w czasie rzeczywistym (dostarczane od razu, bez odświeżania strony, dzięki połączeniu WebSocket). Priority: must-have
  > Socrates: Kontrargument rozważony: "brak wsparcia dla zdjęć/emoji może być zbyt ubogi." Rozstrzygnięcie: bez zmian — czysty tekst wystarczy na MVP, ale dostarczanie musi być natychmiastowe (WebSockets), nie tylko po odświeżeniu widoku.
- FR-007: Właściciel może utworzyć lub dołączyć do wydarzenia spaceru grupowego z innymi właścicielami psów, korzystając z lokalizacji GPS i mapy (Leaflet). Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "moduł mapowy zwiększa złożoność i ryzyko dla 3-tygodniowego MVP." Rozstrzygnięcie: oznaczony jako nice-to-have i odłożony poza rdzeń MVP (patrz Non-Goals); może zostać zaimplementowany, jeśli czas pozwoli, bez blokowania must-have.

## Non-Functional Requirements

- Wiadomości między dopasowanymi właścicielami są wysyłane i odbierane w czasie rzeczywistym za pomocą WebSocketów (np. Supabase Realtime) — nowa wiadomość pojawia się u odbiorcy natychmiast, bez konieczności odświeżania strony lub odpytywania serwera (polling).
- Aplikacja jest użytkowalna zarówno w przeglądarce desktopowej, jak i mobilnej.
- Kolejny profil do przejrzenia ładuje się w czasie poniżej 1 sekundy od akcji polubienia/odrzucenia.
- Każda akcja użytkownika (polubienie/odrzucenie) daje widoczną informację zwrotną o przejściu do kolejnego profilu.
- Użytkownikowi zawsze proponowany jest inny, jeszcze nieoceniony profil — nie pokazuje ponownie profili już zmatchowanych lub odrzuconych, dopóki dostępne są nowe.

## Business Logic

Aplikacja porządkuje przeglądane profile psów najpierw według najnowszych profili, a dopiero w dalszej kolejności bierze pod uwagę dopasowanie.

Regułę zasilają: data utworzenia/aktualizacji profilu psa oraz sygnały dopasowania (np. wspólne cechy, wcześniejsze interakcje). Wynikiem jest kolejność, w jakiej właściciel widzi profile podczas przeglądania — najpierw najnowsze, potem pozostałe uszeregowane wg trafności dopasowania. Właściciel doświadcza tej reguły podczas przeglądania/swipe'owania — nie widzi jej mechanizmu, tylko efekt: świeże profile na górze listy.

## Access Control

Logowanie przez email + hasło. Każdy właściciel psa rejestruje konto i zarządza profilem swojego psa. Płaski model uprawnień — brak ról (admin/moderator) w MVP; wszyscy zarejestrowani właściciele mają te same uprawnienia. Widzi swój profil psa, przegląda profile innych psów, dopasowuje je i wysyła wiadomości w imieniu swojego psa.

## Non-Goals

- System kojców (chwalenie się kojcami/wybiegami i akcesoriami) — poza zakresem, nie wpływa na core flow randkowy.
- Historia randek/spotkań — poza zakresem, brak potrzeby śledzenia historii w MVP.
- Aparat w aplikacji do robienia zdjęć — tylko upload istniejącego zdjęcia, bez integracji z kamerą.
- Filtry dopasowania (wiek/zainteresowania/lokalizacja) — odłożone do v2 (patrz Socrates przy FR-003).
- Usuwanie matchy — odłożone do v2.
- Zgłaszanie lub blokowanie użytkowników/profili — poza zakresem ograniczonego MVP, aby utrzymać jego zakres wokół głównego przepływu dopasowania i wiadomości. To nie oznacza, że ryzyko nadużyć jest rozwiązane: przed szerszym publicznym uruchomieniem należy ponownie ocenić tę decyzję i określić sposób reagowania na nadużycia.
- Moduł spacerów grupowych (GPS + mapa Leaflet) — nice-to-have, poza rdzeniem MVP (patrz FR-007); może zostać dodany, jeśli czas na to pozwoli.

## Open Questions

_(brak — kontrola jakości w shape-notes.md zakończona bez luk)_
