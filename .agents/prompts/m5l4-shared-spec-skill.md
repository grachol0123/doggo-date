# Współdzielona umiejętność przeglądu kodu — wymagania

## Cel

Utwórz umiejętność agenta do automatycznego przeglądu kodu na podstawie konwencji inżynierskich zespołu.

## Dane wejściowe

Użyj dołączonego materiału `m5l4-shared-conventions.md` jako dokumentu źródłowego.
Wygenerowana umiejętność powinna przeglądać kod względem tych konwencji, a nie tworzyć nowy standard przeglądu.

## Konfiguracja

- Nazwa umiejętności: `code-review`
- Kategoria: jakość
- Plik docelowy: `skills/code-review/SKILL.md`
- Frazy wyzwalające: „review code”, „check this PR”, „review my changes”, „code review”

## Frontmatter

Plik `SKILL.md` musi zawierać YAML frontmatter z:

---

name: code-review
description: Review code changes against team engineering conventions, testing standards and security expectations.
---

## Kategorie przeglądu

Użyj kategorii wynikających z materiału dotyczącego konwencji:

- Nazewnictwo
- Obsługa błędów
- TypeScript
- Projektowanie funkcji
- Bezpieczeństwo
- Testowanie

## Format wyjścia

Ustalenia uporządkowane według ważności: Krytyczne → Ostrzeżenie → Sugestia.
Każde ustalenie zawiera odwołanie `file:line`, gdy jest to możliwe.
Zakończ jedną rekomendacją: `APPROVE`, `REQUEST CHANGES` lub `NEEDS DISCUSSION`.
