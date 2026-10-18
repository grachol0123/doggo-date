# Zestaw narzędzi AI GitHub Packages — Wymagania

> **Domyślna ścieżka dla Zadania 3.** Ta specyfikacja opisuje Model 1 z lekcji:
> wewnętrzny zestaw narzędzi zespołu dystrybuowany jako prywatny pakiet npm przez GitHub
> Packages. Użyj tego jako punktu odniesienia, chyba że Twój zespół konkretnie potrzebuje AWS
> CodeArtifact lub kompletnego produktu dostarczanego jako API+CLI.

## Cel

Spakuj artefakty AI zespołu w dystrybuowalny pakiet npm, który repozytoria
konsumenckie mogą instalować z GitHub Packages.

## Metadane pakietu

- Nazwa pakietu: `@twoj-zespol/ai-toolkit`
- Krótka nazwa: `ai-toolkit`
- Wersja: `0.1.0`
- Rejestr: `https://npm.pkg.github.com`
- Wersja Node: `>=22` (`engines.node`)

## Wymagane pliki

Wygeneruj tę strukturę startową:

```text
ai-toolkit/
├── package.json
├── README.md
├── install.js
├── uninstall.js
├── skills/
│   └── code-review/
│       └── SKILL.md
└── rules/
    └── AGENTS.md
```

## Wymagania dotyczące package.json

Pakiet musi:

- publikować do GitHub Packages przez `publishConfig.registry`;
- zawierać w opublikowanym pakiecie tylko `skills/`, `rules/`, `install.js`, `uninstall.js` i `README.md`;
- uruchamiać `node install.js` jako `postinstall`;
- udostępniać `ai-toolkit` i `ai-toolkit-uninstall` jako polecenia bin do ręcznej
  instalacji/deinstalacji;
- deklarować `"engines": { "node": ">=22" }`.

Przykład:

```json
{
  "name": "@twoj-zespol/ai-toolkit",
  "version": "0.1.0",
  "description": "Team AI artifacts distributed through GitHub Packages",
  "license": "UNLICENSED",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "files": ["skills/", "rules/", "install.js", "uninstall.js", "README.md"],
  "scripts": {
    "postinstall": "node install.js"
  },
  "bin": {
    "ai-toolkit": "./install.js",
    "ai-toolkit-uninstall": "./uninstall.js"
  },
  "engines": {
    "node": ">=22"
  }
}
```

## Konfiguracja repozytorium konsumenckiego

Wygeneruj instrukcje dla repozytoriów konsumenckich:

```text
@twoj-zespol:registry=https://npm.pkg.github.com
```

Zatwierdzony plik `.npmrc` musi zawierać tylko mapowanie rejestru. Nie może
zawierać tokenu.

## Zachowanie instalatora

Instalator powinien:

- zlokalizować katalog główny projektu konsumenckiego;
- instalować umiejętności w katalogu konfiguracji narzędzia AI `skills/<skill-name>/`;
- dopisywać reguły do pliku konfiguracji AI projektu (AGENTS.md) między znacznikami wartowniczymi;
- zapisywać w katalogu konfiguracji narzędzia AI plik `.ai-toolkit-manifest.json` z wersją pakietu (odczytaną z
  `package.json`, nigdy zakodowaną na stałe) oraz zainstalowanymi plikami;
- być idempotentny: dwukrotne uruchomienie instalacji aktualizuje zarządzane bloki zamiast je duplikować;
- zatrzymać się z jasnym komunikatem zamiast dopisywać drugi blok, gdy występuje tylko jeden
  znacznik wartowniczy (ktoś ręcznie zmodyfikował zarządzany blok);
- unikać niepowodzenia całego `npm install`, gdy czyszczenie po `postinstall` lub linkowanie się nie powiedzie.

Użyj tych znaczników wartowniczych:

```text
<!-- BEGIN @twoj-zespol/ai-toolkit -->
<!-- END @twoj-zespol/ai-toolkit -->
```

## Zachowanie uwierzytelniania

Instalator może dodać ten pomocnik `preinstall` do konsumenckiego `package.json`, gdy
projekt konsumencki nie ma istniejącego procesu uwierzytelniania GitHub Packages:

```bash
[ -n "$GH_PKG_TOKEN" ] && echo '//npm.pkg.github.com/:_authToken=${GH_PKG_TOKEN}' >> .npmrc || true
```

Ten pomocnik jest przeznaczony dla CI. Lokalni deweloperzy powinni używać `npm login` lub własnego
`.npmrc` na poziomie użytkownika. Nigdy nie zatwierdzaj `_authToken` w repozytorium.
