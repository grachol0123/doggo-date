---
change_id: landing-page-redesign
title: Redesign the landing page and remove 10x Astro Starter boilerplate copy
status: new
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Notes

Zidentyfikowano główną stronę (Welcome.astro) — obecnie nadal pokazuje zaszłości template
"10x Astro Starter" (tytuł, opis "cosmic developer experience", karty Authentication
Ready/Modern Stack/Developer Experience) zamiast treści o doggo-date.

Zakres tej zmiany:

- Usunąć wszystkie teksty/sekcje odnoszące się do "10x Astro Starter" i template
  (nagłówek, podtytuł, 3 karty z funkcjami startera).
- Zaprojektować nową treść główną: komunikat o znalezieniu partnera na spacery z psami
  (dog walking matchmaking), z wezwaniem do utworzenia konta / zalogowania (Sign Up / Sign In).
- Zachować istniejące przyciski Sign In / Sign Up (routing do /auth/signin, /auth/signup)
  i pasek "Not signed in" w Topbar — zmiana dotyczy treści/sekcji poniżej, nie całego layoutu
  auth.
- Nie dodawać teraz zdjęcia w tle — użytkownik dostarczy je w osobnym zadaniu. Zostawić
  miejsce/strukturę, która pozwoli łatwo podpiąć obraz tła później (np. kontener z
  odpowiednią klasą/warstwą), ale nie blokować na brak assetu.
- Zachować już wdrożony motyw brown/pink (tokeny z `ui-dashboard-tokens`) — to osobna,
  zakończona zmiana; tu tylko kopia/treść strony głównej.

Plik główny: `src/components/Welcome.astro` (renderowany przez `src/pages/index.astro`).
