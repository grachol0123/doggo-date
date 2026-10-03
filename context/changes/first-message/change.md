---
change_id: first-message
title: Owner sends and receives real-time messages with a matched owner
status: implemented
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Notes

**Roadmap ID:** S-03 (North star)
**PRD refs:** US-01, FR-006
**Prerequisites:** S-02 (browse-and-match) — done.

Outcome: właściciel wysyła i odbiera proste wiadomości tekstowe do/od dopasowanego właściciela,
dostarczane natychmiast bez odświeżania strony (Supabase Realtime, nie polling).

Risk: błędna konfiguracja Realtime/RLS na tabeli wiadomości może po cichu zdegradować UX do
pollingu albo złamać prywatność wiadomości między niezmatchowanymi użytkownikami.

Linear: DOG-8 — https://linear.app/doggo-date/issue/DOG-8
GitHub: grachol0123/doggo-date#4
