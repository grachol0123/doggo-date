# Wspólne konwencje inżynierskie zespołu

Użyj tego dokumentu jako danych wejściowych źródłowych dla umiejętności `code-review`. Traktuj go jako
punkt wyjścia, a nie uniwersalną prawdę: przed wygenerowaniem umiejętności dostosuj nazwy, reguły frameworka, politykę testowania i
oczekiwania dotyczące bezpieczeństwa do swojego zespołu.

## Nazewnictwo

- Zmienne i funkcje: opisowy camelCase (bez skrótów z wyjątkiem `url`, `id`, `api`, `config`)
- Wartości logiczne: prefiks `is`, `has`, `should`, `can`
- Funkcje: najpierw czasownik (`getUserById`, nie `user`)
- Pliki: zgodne z głównym eksportem (`UserService.ts` eksportuje `UserService`)
- Stałe: UPPER_SNAKE_CASE

## Obsługa błędów

- Wszystkie operacje asynchroniczne: try/catch lub `.catch()`
- Komunikaty błędów zawierają informację, która operacja się nie powiodła, oraz odpowiednie dane wejściowe
- Bez pustych bloków catch; co najmniej zaloguj lub ponownie zgłoś błąd
- Błędy HTTP zawierają kod statusu i komunikat wskazujący możliwe działanie
- Czyszczenie zasobów powinno znajdować się w blokach `finally`, gdy zasoby są otwierane

## TypeScript

- Zero `any` bez komentarza z wyraźnym uzasadnieniem
- Dla kształtów obiektów preferuj `interface` zamiast `type`
- Dla danych zewnętrznych używaj `unknown`, zawężaj za pomocą type guards
- Modeluj stany za pomocą discriminated unions, a nie pól opcjonalnych
- Parametry generyczne: opisowe nazwy (`TUser`, nie `T`)

## Funkcje

- Pojedyncza odpowiedzialność; jeśli do jej opisania potrzebujesz „i”, podziel ją
- Maksymalnie 3 parametry; powyżej tej liczby użyj obiektu opcji
- Wczesne zwracanie wartości zamiast zagnieżdżonych warunków
- Funkcje zapytań (`get*`, `find*`, `is*`) muszą być czyste

## Bezpieczeństwo

- Żadnych sekretów w kodzie; wyłącznie zmienne środowiskowe
- Waliduj dane wejściowe użytkownika na granicach systemu
- SQL: wyłącznie instrukcje parametryzowane
- Odpowiedzi API nigdy nie ujawniają stack traces ani ścieżek wewnętrznych

## Testowanie

- Nazwy testów opisują zachowanie: „zwraca pustą tablicę, gdy nie znaleziono wyników”
- Każdy test zarządza własnym przygotowaniem i sprzątaniem
- Konkretne asercje: `toEqual(expected)` zamiast `toBeTruthy()`
- Uwzględniaj przypadki brzegowe: puste wartości, null, wartości graniczne i ścieżki błędów
