---
title: "Praca nad interfejsem graficznym aplikacji (UI)"
course: "10xdevs-4"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-09-26"
format: "markdown"
---

![Okładka lekcji Praca nad UI](https://images.przeprogramowani.pl/cms/a86b21e0-4b87-493d-a0fa-49edc26d4c9d/943bad0ac35fc0b13dd0a5bbb18dd2f5c09fdba6c0045b8c21c2080a1e865476.png)

Otwierasz w przeglądarce widok wygenerowany przez model i od razu rozpoznajesz ten styl: ciemny fiolet przechodzący w granat, lekko rozmyte tła kart, identyczny promień zaokrąglenia na każdym elemencie i chłodny cień pod przyciskiem, który widziałeś już w kilkunastu innych projektach budowanych z pomocą AI. Kod wygląda czysto, testy jednostkowe przechodzą, a formularz poprawnie wysyła dane do bazy. Całość sprawia jednak wrażenie generycznej makiety.

Pierwszy odruch jest zazwyczaj taki sam: wracasz do terminala, otwierasz czat z agentem i piszesz: „popraw wygląd tego ekranu, żeby wyglądał profesjonalnie, mniej w stylu AI”.

Agent odpowiada natychmiast. Zmienia kilkanaście klas w szablonie, podbija nasycenie kolorów, a po odświeżeniu strony aplikacja wygląda inaczej, ale wcale nie lepiej. Fiolet ustąpił miejsca jaskrawemu błękitowi, kontrast etykiet spadł poniżej progu czytelności, a nieaktywny przycisk dostał kolejną arbitralną klasę wpisaną na sztywno w HTML.

Po trzech kolejnych próbach doprecyzowania promptu szablon puchnie od sprzecznych reguł, a ty spędzasz kolejne pół godziny na ręcznym sprzątaniu przypadkowych stylów.

Taki rezultat wynika wprost z mechanizmu generowania tokenów. Kiedy prosisz model o „ładny interfejs” bez twardych ograniczeń, system sięga po statystyczny środek swojego zbioru treningowego. Widział miliony stron z fioletowymi gradientami i bibliotekami komponentów na domyślnych ustawieniach, więc dokładnie taki wynik uznaje za najbardziej prawdopodobną odpowiedź.

![Style z 10xBench.ai](https://images.przeprogramowani.pl/cms/a86b21e0-4b87-493d-a0fa-49edc26d4c9d/8bccc4ee146e6812a13bb54929a026d592b80f906cf668d61649adefef3e444f.png)

Model nie ma zmysłu estetycznego, nie patrzy na ekran jak człowiek i nie ocenia harmonii przestrzennej.

Zamiast kolejnej rundy perswazji słownej potrzebujesz inżynierskiego rygoru. Agent przy stylowaniu interfejsu nie potrzebuje przymiotników ani nastrojowych opisów, tylko kontraktu technicznego.

Przy takich ograniczeniach pierwsza odpowiedź modelu przestaje być przypadkowym szkicem i staje się przewidywalnym kodem gotowym do weryfikacji.

Pojedynczą, kontrolowaną zmianę wizualną w interfejsie da się poprowadzić bez porzucania dyscypliny projektowej i bez tworzenia osobnego procesu. Wystarczy wpiąć pracę nad interfejsem w standardowy cykl 10xWorkflow Core Skills Chain: od otwarcia zadania z 10x-new, przez techniczny research z 10x-research, ułożenie planu z 10x-plan i implementację w izolacji z 10x-implement, aż po przegląd z 10x-impl-review.

### Kontrakt: tokeny (@theme) i shadcn

Zanim zlecisz agentowi zadanie związane ze zmianą wyglądu, musisz ustalić, czym dla modelu jest interfejs użytkownika. Dla człowieka przycisk na ekranie to prostokąt o określonej barwie, z czytelnym napisem, reagujący na kursor zmianą tła. Dla agenta ten sam przycisk to wyłącznie ciąg znaków w pliku źródłowym, zestaw importów oraz drzewo właściwości przekazywanych do renderera.

Jeżeli pozwolisz modelowi na swobodne dobieranie klas bezpośrednio w znacznikach widoku, w każdym pliku otrzymasz inną interpretację tej samej koncepcji wizualnej.

Traktuj design system jak ścisły kontrakt programistyczny, a nie bibliotekę inspiracji. Na taki kontrakt składają się trzy warstwy:
1. Semantyczne tokeny projektowe zdefiniowane w jednym centralnym miejscu w arkuszu stylów.
2. Reużywalne komponenty bazowe umieszczone bezpośrednio w strukturze katalogów twojego projektu.
3. Pełna macierz stanów interaktywnych, które każdy element musi obsłużyć przed uznaniem pracy za skończoną.

W [Tailwind CSS v4](https://tailwindcss.com/) konfiguracja motywu nie wymaga już pliku JavaScript. Wszystkie definicje motywu trafiają bezpośrednio do pliku CSS za pośrednictwem dyrektywy `@theme` lub `@theme inline`. Zamiast tłumaczyć modelowi zawiłości kaskadowego nadpisywania obiektów konfiguracyjnych w plikach `.js` czy `.ts`, wskazujesz mu jeden arkusz stylów, w którym wartości zmiennych CSS mapują się bezpośrednio na klasy generowane przez framework.

Dla modelu to gigantyczna różnica: zamiast czytać i scalać dwa różne formaty, analizuje jeden spójny plik tekstowy.

Mechanizm ten opiera się na prostym łańcuchu powiązań. W blokach `:root` i `.dark` definiujesz surowe wartości zmiennych dla trybu jasnego oraz ciemnego, a następnie publikujesz je w przestrzeni nazw motywu.

![Flow stylowania](https://images.przeprogramowani.pl/cms/a86b21e0-4b87-493d-a0fa-49edc26d4c9d/2baba4816408ef3cd089788ff6e62f9acad8d47894409767f3b756f344db10a4.png)

Samo wpisanie surowej zmiennej do bloku `:root` w arkuszu stylów nie sprawi, że Tailwind automatycznie wygeneruje odpowiadające jej klasy narzędziowe. Do tego niezbędna jest jawna publikacja w bloku `@theme` lub `@theme inline`. Zmienna `--primary` staje się klasą `bg-primary` lub `text-primary` dopiero wtedy, gdy zostanie przypisana do przestrzeni barw frameworka jako `--color-primary: var(--primary)`.

To częsta pułapka w nowych projektach: zmienna istnieje w arkuszu stylów, ale klasa nie działa, bo zabrakło mostka w `@theme`.

```css
@layer base {
  :root {
    --primary: oklch(0.45 0.24 275);
    --primary-foreground: oklch(0.98 0.01 275);
    --muted: oklch(0.96 0.01 275);
    --muted-foreground: oklch(0.55 0.04 275);
    --ring: oklch(0.45 0.24 275);
  }

  .dark {
    --primary: oklch(0.92 0.04 275);
    --primary-foreground: oklch(0.20 0.04 275);
    --muted: oklch(0.25 0.02 275);
    --muted-foreground: oklch(0.70 0.03 275);
    --ring: oklch(0.65 0.18 275);
  }
}

@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-ring: var(--ring);
}
```

Kolor tła nigdy nie występuje w próżni, dlatego para `--primary` i `--primary-foreground` zabezpiecza dostępność oraz czytelność tekstu. Zawsze definiujesz tło razem z odpowiadającym mu kolorem treści. Jeżeli agent otrzyma swobodę w dobieraniu barwy etykiety na przycisku o nowym akcencie, najczęściej zostawi domyślny biały lub czarny tekst, psując kontrast w jednym z trybów wyświetlania.

Drugim elementem kontraktu jest obecność komponentów ze stabilnego ekosystemu, takiego jak [shadcn/ui](https://ui.shadcn.com/docs). W przeciwieństwie do tradycyjnych bibliotek instalowanych jako nienaruszalne paczki w `node_modules`, shadcn opiera się na kopiowaniu kodu źródłowego komponentów bezpośrednio do twojego repozytorium, najczęściej do katalogu `src/components/ui`. Dla agenta oznacza to bezpośredni dostęp do implementacji.

Model może otworzyć plik `button.tsx`, sprawdzić zdefiniowane warianty (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`), przeanalizować obsługiwane właściwości i użyć istniejącego komponentu zamiast pisać od zera własny znacznik `<button>` z losową mieszanką klas.

### Dwa wejścia: repo z historią i świeży starter

W praktyce spotkasz dwie sytuacje początkowe:

Pierwszy wariant to praca w dojrzałym repozytorium z historią. Masz już działającą aplikację, kilka widoków i logikę biznesową, ale style były dodawane ad hoc. Klasy kolorystyczne są rozsiane po dziesiątkach plików, w widokach dominują twardo wpisane wartości w rodzaju `bg-purple-600` czy `text-blue-500`, a globalny plik stylów albo nie istnieje, albo zawiera szczątkowe reguły.

W takim środowisku zaczynasz od inwentaryzacji i audytu, a nie od dobierania ładniejszych kolorów: wyciągasz powtarzające się wzorce do wspólnych tokenów i zastępujesz chaotyczne klasy semantycznymi odpowiednikami.

Drugi wariant to świeży projekt, na przykład zbudowany na szablonie `10x-astro-starter`. Z pozoru sytuacja jest prosta: plik tokenów już istnieje pod ścieżką `src/styles/global.css`. Zwróć uwagę na nazwę tego pliku: w starterze kursowym jest to `global.css` w liczbie pojedynczej, a nie `globals.css`, znany z domyślnych generatorów innych frameworków.

Plik ten zawiera pełne bloki `:root`, `.dark` oraz publikację w `@theme inline`. Rzecz w tym, że domyślne wartości to fabryczna, monochromatyczna paleta shadcn `neutral` o zerowym nasyceniu barwnym, a katalog `src/components/ui/` zawiera wyłącznie dwa pliki: `button.tsx` oraz `LibBadge.astro`. Brakuje w nim podstawowych klocków konstrukcyjnych, takich jak `Input` czy `Card`.

Co więcej, ekrany dostarczone w starterze w większości ignorują ten plik stylów. Zamiast korzystać z `bg-primary` czy `text-muted-foreground`, komponenty posługują się twardo zakodowanymi klasami Tailwinda. Jeżeli w takiej sytuacji powiesz agentowi „zmień motyw na bardziej nowoczesny”, model zmieni definicje zmiennych w `src/styles/global.css`, ale na ekranie zmieni się niemal wyłącznie wygląd samego przycisku.

Pierwszym krokiem na świeżym starterze jest więc podpięcie istniejących widoków pod leżące odłogiem tokeny, a nie szukanie nowych inspiracji.

### Skąd wziąć wartości tokenów

![tweakcn - generowanie tokenów](https://images.przeprogramowani.pl/cms/a86b21e0-4b87-493d-a0fa-49edc26d4c9d/988641a714ac363aff95267be7ebab8b45ea0bffb6ba692324d5397b8460af18.png)

Skąd wziąć konkretne wartości liczbowe tokenów, jeżeli nie jesteś projektantem i nie chcesz polegać na domysłach modelu? Do wyboru masz dwa sprawdzone źródła:
1. Oficjalna [dokumentacja themingu w shadcn/ui](https://ui.shadcn.com/docs/theming), która dostarcza gotowe szkielety zmiennych dla podstawowych palet w przestrzeni barwnej OKLCH — takiej, w której jasność koloru zmienia się bez rozjeżdżania odcienia. Możesz zbudować własny motyw w [generatorze motywów shadcn/ui](https://ui.shadcn.com/create).
2. Narzędzia społecznościowe, w tym [edytor tweakcn](https://tweakcn.com). Jest to niezależny projekt open-source na licencji Apache-2.0, stworzony przez społeczność, a nie oficjalny produkt autorów shadcn. Pozwala wygenerować rejestr motywu w formacie JSON lub skopiować gotowy blok stylów. Z tego narzędzia pochodzi popularny w projektach wzorcowych preset „Ocean Breeze”.

Niezależnie od źródła wartości motywu obowiązuje **reguła deponowania stylów w repozytorium**. Żadna wartość konfiguracyjna, paleta barw ani zasada layoutu nie może żyć wyłącznie w oknie czatu z modelem. Wszelkie zewnętrzne definicje muszą zostać zapisane w plikach projektu razem z jawnym odnośnikiem do źródła.

[screen-claude-design]

Warto też jasno określić granicę możliwości [narzędzia Claude Design](https://claude.com/product/design). W materiałach promocyjnych pojawia się czasem teza, że narzędzia generatywne eliminują potrzebę konfigurowania stylów. W praktyce Claude Design (dostępny w wersji beta w płatnych planach Anthropic: Pro, Max, Team i Enterprise) ma ściśle określony kierunek przepływu danych: importuje istniejący design system z kodu przez komendę `/design-sync` w Claude Code i na tej podstawie generuje interaktywny prototyp.

Sam producent podkreśla w dokumentacji wsparcia, że jakość importu zależy wyłącznie od materiału źródłowego: niekompletny lub chaotyczny plik stylów w repozytorium da bezużyteczny prototyp. Narzędzie sprawdza się w fazie zaawansowanego prototypowania, ale nie zastąpi starannie skonfigurowanego kontraktu tokenów w kodzie aplikacji.

### Ta sama zmiana 10x: od zlecenia do review

Błędem przy pracy nad interfejsem jest traktowanie stylów jako zadania specjalnej troski, które wymaga porzucenia dyscypliny projektowej na rzecz luźnego dialogu w terminalu. Gdy zmieniasz schemat bazy danych lub dodajesz endpoint API, trzymasz się procesu: otwierasz zadanie, badasz kod, przygotowujesz specyfikację, implementujesz zmianę krok po kroku i weryfikujesz wynik testami. Gdy siadasz do ostylowania formularza, często otwierasz główny wątek czatu i rzucasz polecenie „popraw ten formularz, żeby był czytelniejszy”.

W 10xWorkflow zmiana wizualna jest taką samą jednostką pracy inżynierskiej jak zmiana w logice biznesowej. Podlega tym samym ograniczeniom, wymaga osobnego folderu kontekstowego i przechodzi przez identyczny zestaw etapów w pętli wytwórczej.

![Flow pracy nad UI z Core Skills Chain](https://images.przeprogramowani.pl/cms/a86b21e0-4b87-493d-a0fa-49edc26d4c9d/43178eb5d84449caa3abb08abcedd4a23d7e166fd3fa6220256d1e6e9d08ceb7.png)

Pracę zaczynasz od wywołania `/10x-new`. Zamiast modyfikować pliki bezpośrednio na gałęzi głównej lub dopisywać instrukcje stylowania do otwartej sesji CRUD, tworzysz wyizolowany kontekst dla pojedynczego ulepszenia wizualnego. Nadajesz zadaniu jednoznaczną nazwę, na przykład `ui-enhancement-support-panel` albo `ui-tokens-onboarding`.

Twój agent otrzymuje czysty punkt startowy i własny plik `change.md`, w którym definiujesz granice planowanej modyfikacji.

Faza `/10x-research` bada stan techniczny projektu w dwóch kierunkach: wewnętrznym i zewnętrznym. Zamiast ulotnych wniosków w oknie czatu wyniki trafiają bezpośrednio do pliku `research.md` w katalogu zmiany.

Mając twarde dane z audytu, przechodzisz do `/10x-plan`. Przykładowy plan zmiany UI dla nowego projektu może wyglądać następująco:
1. **Faza środowiska i bibliotek:** weryfikacja poprawności konfiguracji silnika stylów, obecności wymaganych paczek oraz instalacja brakujących prymitywów UI z oficjalnego rejestru.
2. **Faza tokenów bazowych:** uporządkowanie pliku stylów (`src/styles/global.css`), uzupełnienie brakujących zmiennych w `:root` i `.dark`, publikacja w `@theme inline` oraz usunięcie sprzecznych definicji kolorów.
3. **Faza pojedynczego widoku docelowego:** podłączenie przygotowanych tokenów i komponentów do dokładnie jednego wybranego ekranu lub komponentu aplikacji.
4. **Faza stanów interaktywnych:** weryfikacja i oprogramowanie pełnej macierzy zachowań elementu pod wpływem działań użytkownika oraz zdarzeń systemowych.

Z tak przygotowanym planem uruchamiasz `/10x-implement`. Realizacja przebiega w małych, weryfikowalnych krokach. Po wykonaniu każdego punktu agent aktualizuje sekcję `## Progress` w pliku planu, co daje pełną kontrolę nad zakresem modyfikacji.

Jeżeli model napotka problem z kaskadą stylów na poziomie widoku, nie pozwalamy mu modyfikować globalnych tokenów, żeby zamaskować lokalny błąd. Problem ma zostać rozwiązany na poziomie komponentu.

Cykl zamyka wywołanie `/10x-impl-review`. W przypadku pracy nad interfejsem przegląd obejmuje oprócz testów i typów także rygorystyczny triage wizualny. Sprawdzasz, czy w diffie nie pojawiły się przypadkowo wklejone klasy z twardej palety barw, czy żaden komponent nie nadpisuje globalnego promienia zaokrągleń arbitralną wartością w pikselach oraz czy wszystkie zadeklarowane stany mają swoją reprezentację w kodzie.

Przejście przez tę bramkę uprawnia do przygotowania commita i włączenia kodu do głównej gałęzi projektu.

### Research na UI: audyt i referencja motywu

Przy pracy nad interfejsem z agentem kluczowe jest prowadzenie researchu dwukierunkowego. Kiedy programista, który nie czuje się pewnie w CSS, próbuje opisać pożądany efekt własnymi słowami, szybko trafia na ograniczenia wieloznacznego języka naturalnego. Research w 10xWorkflow rozwiązuje ten problem przez rozdzielenie badania na dwa niezależne nurty: audyt wewnętrzny tego, co już istnieje w repozytorium, oraz analizę zewnętrznej referencji technicznej.

Pierwszy nurt to **audyt wewnętrzny kodu**. Zanim pozwolisz agentowi napisać choćby jedną linijkę CSS, w ramach `/10x-research` polecasz mu zbadać obecny stan repozytorium. W projekcie opartym na `10x-astro-starter` prompt audytowy pyta o twarde fakty strukturalne:

```text
Przeanalizuj konfigurację stylów i użycie klas w tym projekcie.
Wypisz w pliku research.md:
1. Dokładną ścieżkę do głównego pliku stylów oraz listę zdefiniowanych zmiennych w :root i .dark.
2. Zmienne, które są poprawnie publikowane w bloku @theme lub @theme inline.
3. Listę komponentów obecnych fizycznie w katalogu src/components/ui.
4. Zestawienie plików w src, które używają twardo zakodowanych klas kolorów (np. bg-purple-*, text-blue-*) zamiast klas semantycznych (bg-primary, text-muted-foreground).
5. Brakujące prymitywy UI, które będą niezbędne do wyświetlenia danych w docelowym widoku.
Nie wprowadzaj żadnych zmian w plikach.
```

Taki audyt ujawnia rzeczywisty stan rzeczy. Zamiast mglistego wrażenia, że „coś wygląda nie tak”, otrzymujesz precyzyjną listę długu technicznego: dowiesz się na przykład, że `src/styles/global.css` definiuje tokeny, ale żaden plik z widokami z nich nie korzysta, a jedynym dostępnym komponentem bazowym jest przycisk. Masz przed sobą konkretną mapę problemów do rozwiązania.

Drugi nurt to **referencja zewnętrzna**. Zamiast wymyślać styl od zera, wskazujesz agentowi nazwany punkt odniesienia. Może to być system projektowy (design system), taki jak shadcn, Material Design 3 czy IBM Carbon, z którego pożyczasz proporcje typograficzne i hierarchię przestrzenną.

Może to być również sprawdzony preset kolorystyczny ze społecznościowego rejestru tweakcn, taki jak „Ocean Breeze”.

Referencja zewnętrzna dostarcza modelowi ustrukturyzowanego słownictwa technicznego. Zamiast pisać „zrób tak, żeby te elementy były od siebie wyraźnie oddzielone”, operujesz terminologią systemu: „zastosuj relację `surface` do `surface-container-high` z zachowaniem skali odstępów opartej na kroku 4px”. Agent posługujący się sformalizowanym słownikiem generuje kod znacznie bardziej spójny niż model prowadzony potocznymi opisami.

### Pełny cykl zmiany na panelu supportu

Prześledźmy jedną wyizolowaną zmianę wizualną przeprowadzoną w module panelu supportu platformy 10xDevs: od audytu, przez uzupełnienie brakujących komponentów i modyfikację tokenów, aż po weryfikację stanów w przeglądarce i zamknięcie zadania commitem.

![](https://images.przeprogramowani.pl/cms/a86b21e0-4b87-493d-a0fa-49edc26d4c9d/687b47e7b4a075d1f642da954365b9213075a6fa227ee59d8c5419bfde0e5e7c.png)

Punkt wyjścia miał cztery konkretne wady:
- Lista zgłoszeń była surową tabelą HTML z twardo zakodowanymi tłami wierszy `bg-slate-900` i `bg-slate-800`.
- Statusy zgłoszeń („Nowe”, „W toku”, „Rozwiązane”) były zwykłymi elementami `<span>` o słabym kontraście w trybie ciemnym.
- Przycisk w oknie edycji symulował stan `disabled` klasą `opacity-50` dopisaną w szablonie, przez co nadal reagował na kursor.
- Arkusz stylów nie definiował semantycznych kolorów błędu i ostrzeżenia, więc formularz walidacji sięgał po przypadkowe `text-red-500` i `text-rose-600`.

Aby sobie z tym poradzić, stworzyliśmy zadanie `ui-support-table-refactor` za pomocą `/10x-new` i przeprowadziliśmy audyt. Okazało się, że projekt ma już bazowy komponent `Button`, ale brakuje w nim komponentu `Badge` do wyświetlania statusów oraz komponentu `Dialog` do obsługi modala. Zamiast pozwalać agentowi pisać własne implementacje tych elementów, dodaliśmy do projektu oficjalne komponenty z rejestru shadcn.

Następnie przyszła kolej na centralny plik stylów, w którym brakowało definicji semantycznych dla kolorów funkcyjnych:

```css
@layer base {
  :root {
    --destructive: oklch(0.57 0.22 27);
    --destructive-foreground: oklch(0.98 0.01 27);
    --warning: oklch(0.75 0.18 75);
    --warning-foreground: oklch(0.20 0.05 75);
    --success: oklch(0.62 0.17 145);
    --success-foreground: oklch(0.98 0.01 145);
  }
}

@theme inline {
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}
```

Potem każdy surowy znacznik statusu został zastąpiony komponentem `Badge` korzystającym z odpowiedniego wariantu semantycznego. Twardo zakodowane tła wierszy ustąpiły miejsca klasom `hover:bg-muted/50` oraz `border-b border-border`.

![](https://images.przeprogramowani.pl/cms/a86b21e0-4b87-493d-a0fa-49edc26d4c9d/ae54e9f26420fb61be5b3676b4ed8ee7f43a69bfafc45cff923bf2970197e0e4.png)

Ta sama lista na szerokości telefonu. Kolumny, które wcześniej wypychały tabelę poza ekran, po przebudowie mieszczą się w widoku:

![](https://images.przeprogramowani.pl/cms/a86b21e0-4b87-493d-a0fa-49edc26d4c9d/645f70aace0b96c1c311dfc4d1fbd9663d9cc901116b4b4310bcd738553ee7bc.png)

Kluczowym momentem demonstracji jest zastosowanie **kitchen sink jako wizualnej bramki kontrolnej**. Wynik nie był oceniany wyłącznie na pojedynczym, poprawnie wypełnionym rekordzie w bazie danych. W osobnym widoku testowym wyrenderowano tabelę zawierającą przypadki brzegowe:
- Zgłoszenie ze skrajnie długim tytułem bez spacji (sprawdzenie zawijania wierszy i łamania tekstu).
- Zgłoszenie z pustym opisem i brakującymi danymi autora (weryfikacja stanu pustego).
- Przycisk w stanie `loading` ze spinnerem zastępującym tekst.
- Formularz z aktywnym komunikatem błędu pod każdym polem wejściowym.

Widok testowy agregujący skrajne stany oszczędza godziny ręcznego przeklikiwania formularzy w poszukiwaniu rozbitych stylów.

### Który model: routing fazowy zamiast rankingów

Ten sam widok da się doprowadzić do tego stanu różnymi modelami.

W mediach społecznościowych bez trudu znajdziesz rankingi, które ogłaszają jeden z modeli najlepszym rozwiązaniem do frontendu. Takie zestawienia dezaktualizują się błyskawicznie, a ich autorzy rzadko ujawniają metodologię pomiaru.

W 10xWorkflow stosujemy **routing fazowy**, czyli dobór klasy narzędzia do specyfiki zadania w danym momencie pętli wytwórczej. Zasada jest prosta: faza oceny, planowania i review wymaga modelu o najwyższych zdolnościach rozumowania wizualnego, podczas gdy samą implementację zmian w kodzie warto powierzyć warstwie tańszej i szybszej. Oto przykład dla modeli Claude od Anthropic:

| Faza zadania UI | Sugerowany model | Rola w procesie | Dlaczego ten wybór |
|---|---|---|---|
| Audyt, planowanie, specyfikacja | Claude Fable 5.1 / Opus 5 | Architekt / Recenzent | Precyzyjna analiza zależności, trzymanie się ograniczeń w change.md, brak samowolnego upraszczania kontraktu. |
| Implementacja pod ścisły kontrakt | Sonnet 4.5 / tańsza warstwa | Wykonawca | Szybkie przekładanie planu na kod, sprawna obsługa składni narzędziowej, niski koszt powtarzalnych edycji plików. |
| Pętla poprawkowa ze zrzutem ekranu | Fable 5.1 / Opus 5 | Korektor wizualny | Zaawansowana analiza multimodalna, zdolność do zestawienia zrzutu ekranu z kodem i precyzyjnego wskazania rozbieżności. |
| Ostateczny review przed merge | Opus 5 | Bramkarz jakości | Skrupulatna ocena diffa, wykrywanie regresji dostępności oraz naruszeń kontraktu tokenów. |

Nazwy w tej tabeli to przykład z września 2026. Osią jest faza zadania, nie dostawca: jeżeli pracujesz na innym zestawie modeli, podstaw pod te role najmocniejszy model, jaki masz, tańszą warstwę wykonawczą i dowolny model, który dobrze analizuje obraz.

Claude Fable 5.1 jest zoptymalizowany pod kątem domykania pętli ze sprzężeniem zwrotnym opartym na zrzutach ekranu. Jeżeli po wdrożeniu zmian załączysz zrzut widoku z przeglądarki z pytaniem „co poprawić”, Fable 5.1 wykaże się znacznie wyższą czułością na mikroskopijne przesunięcia w pionie, błędne wyrównania linii tekstu czy nieprawidłowe promienie zaokrągleń niż modele optymalizowane wyłącznie pod tekst.

Aby ograniczyć koszty, warto zastosować zasadę: **tańsza warstwa wykonuje zadanie, a model najwyższej klasy wkracza wtedy, gdy ten sam zarzut wizualny lub techniczny przetrwa dwie kolejne rundy poprawek**.

Jeżeli tańszy model wykonawczy po raz drugi z rzędu nie potrafi poprawnie ostylować stanu fokusu przycisku i generuje niepoprawną klasę, nie ponawiasz tego samego promptu po raz trzeci. Przełączasz się na model najwyższej klasy, wskazujesz mu dwa nieudane podejścia i każesz zdiagnozować źródło problemu w arkuszu stylów. Taki podział ról pozwala zachować kontrolę nad jakością techniczną oraz kosztami sesji.

### Jeśli masz makietę: oczekiwania wobec Figma MCP i Code Connect

Częstym błędem jest oczekiwanie pełnej automatyzacji przy wdrażaniu makiet: „podłączę serwer MCP do Figmy, wskażę link i dostanę gotowy kod za jednym razem”. Przy obecnym stanie technologii takie podejście szybko prowadzi do długu technicznego. Należy wyraźnie rozróżnić dwie sytuacje: korzystanie ze zwykłego serwera Figma MCP oraz pracę ze skonfigurowanym mechanizmem Code Connect.

Serwer Figma MCP (uruchamiany na przykład poleceniem `claude mcp add --transport http figma https://mcp.figma.com/mcp`) czyta surowe węzły drzewa dokumentu graficznego. Narzędzie `get_design_context` zwraca zrzut struktury wektorowej: nazwy warstw, współrzędne w pikselach, kolory hex i parametry transformacji. Model nie wie, które warstwy odpowiadają komponentom istniejącym w twoim repozytorium.

W rezultacie wygenerowany kod z wierzchu przypomina projekt, ale pod spodem jest obcy architektonicznie:
- Zamiast zaimportować istniejący w projekcie komponent `Button`, agent tworzy surowy znacznik `<button>` oblepiony dwudziestoma arbitralnymi klasami Tailwinda.
- Wartości kolorów zostają wpisane na sztywno jako jednorazowe kody hex lub arbitralne odcienie, z pominięciem pliku tokenów semantycznych.
- Elementy interaktywne, takie jak zakładki czy menu rozwijane, otrzymują wygląd stanu aktywnego wpisany na stałe w stylach, bez logiki obsługi zdarzeń i stanu.

Sytuacja zmienia się, gdy zespół wdroży **Figma Code Connect**. Technologia ta wiąże komponent w pliku Figmy z odpowiadającym mu plikiem źródłowym w repozytorium. Kiedy agent odpytuje makietę wspieraną przez Code Connect, zamiast surowej geometrii wektorowej otrzymuje instrukcję integracji: dowiaduje się, że dana ramka to komponent `Card` z pliku `@/components/ui/card`, a widoczne właściwości odpowiadają parametrom `variant="outlined"` oraz `padding="compact"`.

Nawet z mechanizmem Code Connect wdrożenie makiety nie daje automatycznego „100% pixel-perfect”. W niezależnych badaniach inżynierskich brak wiarygodnych danych potwierdzających pełną automatyczną zgodność kodu z makietą bez udziału człowieka. Code Connect podnosi jakość techniczną kodu, eliminuje zgadywanie nazw komponentów i ogranicza zużycie tokenów kontekstu, ale wynik pozostaje technicznym szkicem wymagającym weryfikacji.

Zasada pracy z makietą w 10xWorkflow pozostaje prosta: **makieta graficzna jest wyłącznie referencją wizualną, a nie specyfikacją techniczną kodu**. Źródłem prawdy jest repozytorium, plik tokenów i działające komponenty. Gdy agent wygeneruje kod na podstawie makiety, pierwszym krokiem w review jest oczyszczenie diffa z surowych wartości liczbowych i zastąpienie ich tokenami z kontraktu.

### Checklista merge: stany komponentu jako definition of done

Ostatnim etapem pracy nad zmianą wizualną jest sprawdzenie, czy kod jest gotowy do włączenia do głównej gałęzi repozytorium. Programiści często uznają zadanie za skończone, gdy „komponent wyświetla się poprawnie na ekranie”. Taki stan trwa do pierwszego kliknięcia przez użytkownika testowego, który wywoła błąd walidacji, trafi na wolne łącze lub spróbuje obsłużyć interfejs klawiaturą.

W 10xWorkflow definicja ukończenia prac (Definition of Done) opiera się na **pełnej macierzy stanów interaktywnych**. Komponent lub widok kwalifikuje się do merge dopiero wtedy, gdy w kodzie istnieje przetestowana obsługa każdego z poniższych stanów:

```text
[ ] 1. Stan domyślny (Default)
       Element wyświetla się poprawnie z poprawnymi danymi wejściowymi.
       Hierarchia wizualna odpowiada założeniom z change.md i notatki projektowej.

[ ] 2. Stan najechania (Hover)
       Widoczna, subtelna zmiana tła lub obramowania informująca o interaktywności.
       Zastosowanie klas semantycznych (np. hover:bg-muted), zakaz surowych kolorów.

[ ] 3. Stan skupienia (Focus / Focus-Visible)
       Wyraźny wskaźnik skupienia dostępny dla użytkowników nawigujących klawiaturą.
       Sprawdzenie, czy zmienna --ring poprawnie kontrastuje z tłem komponentu.

[ ] 4. Stan zablokowany (Disabled)
       Element posiada atrybut disabled, poprawną klasę kursorową (cursor-not-allowed)
       oraz obniżone nasycenie. Blokada faktycznego wywoływania zdarzeń (pointer-events-none).

[ ] 5. Stan błędu i walidacji (Error)
       Komunikat o błędzie powiązany semantycznie z polem za pomocą aria-describedby.
       Kolorystyka oparta na tokenie --destructive, nigdy o losowe klasy text-red-*.

[ ] 6. Stan pusty (Empty State)
       Widok posiada zaprojektowane zachowanie w przypadku braku danych (np. brak zgłoszeń).
       Dedykowany komunikat z czytelnym wezwaniem do działania zamiast pustej przestrzeni.

[ ] 7. Stan ładowania danych (Loading / Skeleton)
       Wskaźnik ładowania zachowujący geometrię docelowego widoku (szkielet blokowy).
       Brak efektu przeskakiwania układu (layout shift) po załadowaniu właściwych danych.
```

Błędem, który w review bezwzględnie dyskwalifikuje zmianę, jest „namalowany stan”. Zdarza się to, gdy model generuje złożony komponent (np. zestaw zakładek filtrujących czy przełącznik) wyłącznie ze statycznych klas.

Na ekranie widzisz ostylowaną pierwszą zakładkę z ciemnym tłem i aktywnym podkreśleniem, ale w kodzie okazuje się, że stan wpisano na stałe jako `class="bg-primary text-primary-foreground"`. Komponent nie ma stanu w kodzie React ani Astro, kliknięcie w drugą zakładkę niczego nie zmienia, a próba dynamicznego przekazania danych rozsypuje style. Taki kod jest makietą, a nie działającym oprogramowaniem.

## 🧑🏻‍💻 Zadania praktyczne

Poniższe ćwiczenia nie są instrukcją pracy nad UI w jednej konkretnej aplikacji. Cykl pracy z 10xWorkflow Core Skills Chain jest stały, ale sytuacja startowa w twoim projekcie może się różnić.

W tej lekcji dochodzi `/10x-ui` — skill do **audytu i poprawy widoku, który już istnieje**. Nie buduje ekranu od zera: zakłada, że masz coś, co się renderuje i da się uchwycić na zrzucie ekranu, a potem prowadzi ten sam łańcuch pod kątem zmiany wizualnej, stosując praktyki z tej lekcji. Pilnuje przy tym, żeby audyt skończył się listą zarzutów, a nie ogólnym wrażeniem, a kontrakt został naprawiony przed samymi pikselami.

Zanim usiądziesz do pierwszego zadania, pobierz paczkę artefaktów dla tej lekcji:

```bash
npx @przeprogramowani/10x-cli@latest get m2l5
```

Paczka dostarcza skill `/10x-ui`, który zawiera też checklistę weryfikującą jakość UI.

### Zadanie 1: Zamień „brzydko” na listę zarzutów

To jedyne zadanie, które wygląda tak samo w każdym repozytorium, bo nie zakłada niczego o twoim stacku.

Otwórz zmianę z `/10x-ui` i zacznij od nazwania **jednego** widoku, którym się zajmiesz. W fazie `/10x-research` agent przeprowadzi dwukierunkowy audyt: gdzie w tym repozytorium leży źródło wartości (plik tokenów, obiekt motywu, zmienne — jakkolwiek twój stack to nazywa), gdzie leżą komponenty współdzielone i które widoki faktycznie z nich korzystają.

Wynikiem ma być **od trzech do pięciu zarzutów**, każdy z plikiem, linią i jednym zdaniem o tym, co z tego ma użytkownik. Zarzuty rozkładają się na trzy kategorie: brakujące tokeny, brakujący komponent współdzielony i architektura z przypadku, czyli ekran odbijający kolejność dopisywania funkcji zamiast potrzeb użytkownika.

Ta trzecia kategoria najłatwiej umyka, bo nie widać jej na zrzucie. Zapytaj wprost, co zobaczy ktoś, kto wejdzie na ten widok wylogowany, bez danych albo prosto z linka.

Zadanie jest zrobione, kiedy lista zarzutów leży w katalogu zmiany.

### Zadanie 2: Napraw kontrakt w wariancie pasującym do twojego repo

Wybierz jedną ścieżkę:

- **Repo ma już design system.** Najpierw sprawdź: źródło wartości tokenów, komponenty współdzielone, notatki projektowe, jeżeli są.
- **Świeży starter z martwym plikiem tokenów.** Plik istnieje, ekrany go nie czytają. Pierwszą fazą nie jest wybór motywu, tylko podpięcie istniejących widoków pod tokeny, które już leżą w repozytorium.
- **Repo bez żadnego design systemu.** Tutaj kontrakt *jest* zmianą. Zaproponuj go przez dodanie zależności i wskazanie dokumentacji rozwiązania.
- **Wartości z nazwanego motywu albo gotowego presetu.** Zmapuj je na istniejące nazwy zmiennych i trzymaj krótką listę ról zamiast pełnej palety.

Plan buduj w stałej kolejności: środowisko i biblioteka, potem wartości w źródle, potem jeden widok, na końcu stany.

### Zadanie 3: Jeden widok, nazwane stany, bramka wizualna

Doprowadź wybrany widok do „Definition of Done” i zamknij go bramką, która nie jest opinią.

Wyrenderuj komponent albo widok we wszystkich stanach z checklisty z lekcji, łącznie ze stanem nieaktywnym, pustym, błędu i ładowania, a potem zrób zrzuty ekranu na desktopie oraz przy jednej szerokości mobilnej. Jeżeli twoje repozytorium ma już testy zrzutowe, wepnij widok tam zamiast budować osobne miejsce. Jeżeli nie ma, zrzut z przeglądarki wystarczy — byle nie aktualizować wzorców w ciemno.

Pętlę poprawkową domykasz dowolnym modelem czytającym obrazy: załączasz zrzut, a model wskazuje rozbieżności wobec założeń z `change.md`.

Na koniec `/10x-impl-review`. Sprawdzasz, czy zmiana została w granicach opisanych w `change.md`, czy w diffie nie ma surowych wartości kolorów i czy każdy zadeklarowany stan ma swoją reprezentację w kodzie.

### Warianty tego samego cyklu

Jeżeli szukasz kolejnych pomysłów na zmianę poprawiającą UI, każdy z poniższych przypadków zaczyna się od widoku, który już działa, i da się go przejść z `/10x-ui` oraz Core Skills Chain:

- **Odziedziczony bałagan po agencie**, czyli moduł budowany funkcja po funkcji, każda przyjęta dlatego, że działała. Napraw tokeny oraz komponenty współdzielone, zanim zaczniesz przebudowywać cały layout.
- **Tryb ciemny.** Warstwa tokenów, oba motywy w widoku testowym, kontrast sprawdzany w bramce.
- **Przegląd fokusu i obsługi klawiatury.** Kluczowa jest tu faza stanów: widoczny fokus, nazwy kontrolek i kolejność tabulacji na tym jednym widoku.

Po tych ćwiczeniach potrafisz domknąć pracę nad zmianą UI: od audytu długu, przez tokeny i komponenty, po zielony przegląd diffa. W kolejnej lekcji o pracy równoległej nauczysz się, jak pracować nad kilkoma zmianami naraz.

## Odbierz swoją odznakę

Po ukończeniu tej lekcji odbierz odznakę w sekcji [10xDevs Mission Log](https://platforma.przeprogramowani.pl/mission-log), a następnie pochwal się swoim osiągnięciem!

## 🔎 Deep Dive

Ta sekcja zawiera dodatkowe pogłębienie wiedzy na temat wybranych zagadnień związanych z lekcją. W tym Deep Dive znajdziesz:

- **Code Connect i anatomia mapowania komponentów** — mechanizm łączący warstwy Figmy z kodem w repozytorium oraz analiza wyników badań nad jego efektywnością.
- **Impeccable i praca z krytyką układu** — wykorzystanie wyspecjalizowanych narzędzi wspierających eliminowanie błędów kompozycyjnych w generowanym kodzie.
- **Jak czytać porównania narzędzi i benchmarki frontendowe** — krytyczna analiza publicznych rankingów, testów syntetycznych i zestawień modeli pod kątem ich realnej przydatności.
- **Notatka projektowa i format `DESIGN.md`** — utrwalanie uzasadnień decyzji wizualnych w repozytorium oraz eksperymentalny format Google Labs, który próbuje to ustandaryzować.

Ta sekcja lekcji nie jest obowiązkowa, ale warto się z nią zapoznać, jeżeli chcesz zostać ekspertem.

### Code Connect i anatomia mapowania komponentów

Zwykłe połączenie z Figmą przez serwer MCP daje słabe rezultaty architektoniczne ze względu na sposób reprezentacji interfejsu w narzędziu graficznym. W pliku Figmy projektant operuje na ramkach (frames), wektorach, grupach i stylach warstw. Kiedy agent odczytuje ramkę za pomocą standardowego narzędzia `get_design_context`, widzi wyłącznie surową geometrię.

Próbuje więc odgadnąć semantykę na podstawie nazw warstw, często przypadkowych, w stylu `Frame 412` lub `Group 12`, i przekłada każdy prostokąt na znacznik `<div>`.

Figma Code Connect odwraca tę relację. Zamiast zmuszać model do zgadywania intencji, tworzysz w repozytorium plik mapowania (np. `button.figma.tsx`), który dodaje komponent do rejestru Figmy:

```tsx
import figma from '@figma/code-connect'
import { Button } from './button'

figma.connect(Button, 'https://figma.com/design/:fileKey/:fileName?node-id=:nodeId', {
  props: {
    variant: figma.enum('Variant', {
      Primary: 'default',
      Destructive: 'destructive',
      Outline: 'outline',
      Secondary: 'secondary',
    }),
    disabled: figma.boolean('Disabled'),
    label: figma.string('Label Text'),
  },
  example: (props) => <Button variant={props.variant} disabled={props.disabled}>{props.label}</Button>,
})
```

Gdy taki kod zostanie opublikowany w rejestrze Figmy, serwer MCP przestaje zwracać surowe drzewo węzłów. W odpowiedzi na zapytanie agent otrzymuje gotowy fragment kodu z poprawnym importem, skonfigurowanymi właściwościami i bezpośrednim odwołaniem do istniejącego pliku w projekcie.

W ewaluacji przeprowadzonej przez inżynierów Figmy w sierpniu 2026 roku zestawiono wyniki pracy agentów programistycznych (testowanych na modelach Sonnet 4.5 oraz Opus 4.7) na zestawie 27 zróżnicowanych zadań integracyjnych. Badanie wykazało wyraźne różnice po wdrożeniu mapowań Code Connect:
- Jakość generowanego kodu mierzona w 4-stopniowej skali Likerta wzrosła o punkt (mediana przesunęła się z poziomu 2 do poziomu 3).
- Zużycie tokenów kontekstu spadło medianowo o 29,5%, co przełożyło się na niższy koszt sesji i mniejsze ryzyko wyczerpania okna kontekstowego.
- Czas wykonania zadania przez agenta skrócił się medianowo o 19,6%.

Głównym czynnikiem sukcesu okazał się wskaźnik pokrycia (coverage). Jeżeli makieta zawierała dziesięć komponentów, ale tylko dwa miały mapowania Code Connect, agent radził sobie poprawnie z tymi dwoma, po czym wracał do generowania niespójnego kodu dla pozostałych ośmiu elementów.

Nawet przy 100% pokryciu generowany kod w wielu przypadkach wymagał korekt człowieka w obsłudze zdarzeń i logice biznesowej. Technologia ta usprawnia pracę, ale nie eliminuje potrzeby nadzoru inżynierskiego.

Przy samodzielnej pracy nad prostym MVP konfigurowanie pełnego środowiska Code Connect jest często nieuzasadnionym narzutem. Warto jednak znać ten mechanizm, ponieważ stanowi standard w zespołach produktowych.

### Impeccable i praca z krytyką układu

[Projekt Impeccable](https://impeccable.style/), rozwijany przez Paula Bakausa na podstawie doświadczeń ze skillem `frontend-design` firmy Anthropic, powstał jako odpowiedź na typowe błędy kompozycyjne modeli: przypadkowe odstępy, brak hierarchii typograficznej i powtarzalne gradienty.

Istotą pracy z Impeccable jest wzorzec **oddzielenia krytyki od edycji**. Błąd polega na zleceniu: „zobacz ten komponent i od razu go popraw”. Model próbuje wtedy jednocześnie analizować kompozycję i generować kod, co kończy się chaotycznymi modyfikacjami stylów.

Prawidłowy wzorzec rozbija pracę na trzy fazy:
1. **Faza krytyki (`critique`):** model otrzymuje zrzut widoku, plik tokenów, informację o dostępnych komponentach oraz cel użytkownika, z zakazem edycji kodu źródłowego. Jego zadaniem jest sformułowanie listy uchybień kompozycyjnych w odniesieniu do zasad designu.
2. **Faza audytu technicznego (`audit`):** weryfikacja zgodności z kontraktem technicznym (dostępność, kontrast, obsługa stanów, czystość semantyczna).
3. **Faza kontrolowanego dopracowania (`polish`):** wprowadzenie wybranych, zaakceptowanych przez człowieka poprawek z zachowaniem ograniczeń architektonicznych.

Przykładowa instrukcja w fazie krytyki:

```text
Przeanalizuj załączony zrzut ekranu widoku listy zgłoszeń supportu.
Kontekst: aplikacja webowa dla operatorów technicznych, praca pod presją czasu.
Tokeny i zasady: src/styles/global.css oraz DESIGN.md.
Oceń wyłącznie:
1. Hierarchię wizualną — czy wzrok natychmiast trafia na elementy krytyczne?
2. Rytm przestrzenny i spójność marginesów wewnętrznych.
3. Czytelność danych pomocniczych przy zachowaniu odpowiedniego kontrastu.
Wypisz swoje uwagi w punktach. Nie wprowadzaj żadnych zmian w plikach i nie generuj kodu CSS.
```

Otrzymany wynik stanowi konkretny materiał analityczny. Model może zauważyć na przykład, że odstęp pomiędzy tytułem zgłoszenia a jego statusem jest większy niż margines dzielący dwa niezależne wiersze tabeli, co zaburza percepcję relacji przestrzennych (naruszenie zasady bliskości). Jako inżynier przeglądasz tę listę, odrzucasz uwagi chybione, a wartościowe przekształcasz w zadania w pliku planu.

Zachowaj sceptycyzm wobec doniesień marketingowych przypisujących narzędziom tego typu skoki jakości mierzone w dziesiątkach procent. Dostępne opisy Impeccable opierają się na subiektywnych demonstracjach, a nie na badaniach randomizowanych. Narzędzie wspiera formułowanie słownictwa projektowego, ale to programista decyduje, które zalecenia wdrożyć do kodu.

### Jak czytać porównania narzędzi i benchmarki frontendowe

Wybierając narzędzia do pracy nad interfejsem, regularnie trafiasz na publikacje zestawiające ze sobą modele językowe. Aby uniknąć ciągłego zmieniania stosu technologicznego pod wpływem chwilowych mód, warto wyrobić sobie nawyk krytycznego sprawdzania metodologii każdego badania.

Dobrym przykładem jest zestawienie Startrise AI Labs z lipca 2026 roku („Best LLM for Frontend 2026”), obejmujące 144 generacje interfejsów oceniane w 12 kategoriach. Model Opus 5 uzyskał łączny wynik 82,3 punktu, wygrywając 8 z 12 kategorii (w tym dostępność i zgodność z WCAG), podczas gdy model Fable 5 osiągnął 73,8 punktu, wygrywając 3 testy w otwartych zadaniach kreatywnych.

Sekcja metodologiczna raportu ujawnia jednak istotne ograniczenia:
- Test polegał na jednorazowym wygenerowaniu pojedynczego pliku HTML/CSS (single-shot prompt), bez pętli sprzężenia zwrotnego, bez istniejącego repozytorium i bez weryfikacji w ekosystemie komponentów.
- Sędzią oceniającym jakość kodu w zautomatyzowanej rubryce punktowej był ten sam model Opus, co stwarza ryzyko, że sędzia faworyzuje odpowiedzi w stylu, który sam generuje.
- W badaniu nie brała udziału nowsza wersja Fable 5.1, która wprowadziła optymalizacje w obszarze analizy wizualnej.

Innym formatem są publikacje dziennikarskie, takie jak artykuł w serwisie XDA z września 2026 roku, opisujący próbę odtworzenia tej samej strony internetowej w trzech środowiskach agentowych (Claude Code, Codex oraz Antigravity). Teksty te dostarczają obserwacji jakościowych: pokazują, jak poszczególne narzędzia radzą sobie z czytelnością układu na ekranach mobilnych czy mikroskopijnymi różnicami w interlinii. Mają jednak wartość anegdotyczną (próba N=1), ponieważ nie oddzielają sprawności modelu od wpływu promptu, konfiguracji środowiska czy szablonu.

Trzecią kategorią są publikowane cyklicznie rankingi zbiorcze, takie jak wrześniowe zestawienie „AI dev tool power rankings” w serwisie LogRocket. Zestawienia te łączą wyniki syntetycznych aren internetowych z subiektywnymi ocenami ergonomii IDE oraz kosztami subskrypcji. Sami autorzy rankingu przyznają przy tym, że ich czołowy wybór jest na arenie WebDev dopiero drugi, za modelem konkurencji.

Ostrożności wymagają też oficjalne benchmarki publikowane przez producentów oprogramowania we własnych materiałach. Nawet rzetelnie udokumentowane testy powstają w środowisku i według kryteriów ustalonych przez podmiot zainteresowany komercyjnym sukcesem rozwiązania.

Zasada pozostaje stała: **żaden publiczny ranking, syntetyczny benchmark ani artykuł prasowy nie zwalnia cię z przetestowania narzędzia na własnym kodzie produkcyjnym**. Liczby z benchmarków traktuj jako wskazówkę do podziału ról, a nie jako twarde reguły. Kryterium prawdy to czysty diff w gicie, zielony stan testów jednostkowych oraz przejście przez checklistę stanów interaktywnych we własnej aplikacji.

## 📚 Materiały dodatkowe

Poniższe materiały poszerzają wiedzę na temat wzorców projektowych, narzędzi integracyjnych oraz technicznych aspektów budowania interfejsów użytkownika z modelami AI:
- [Theme Variables](https://tailwindcss.com/docs/theme) — oficjalna dokumentacja Tailwind CSS v4 opisująca definiowanie tokenów za pomocą dyrektyw `@theme` i `@theme inline`.
- [Theming](https://ui.shadcn.com/docs/theming) — oficjalny przewodnik shadcn/ui po architekturze motywów, zmiennych przestrzeni barwnej OKLCH oraz konfiguracji trybu ciemnego.
- [MCP Server](https://ui.shadcn.com/docs/mcp) — dokumentacja shadcn/ui opisująca integrację rejestru komponentów z klientami AI za pośrednictwem protokołu Model Context Protocol.
- [tweakcn](https://tweakcn.com) — otwartoźródłowy, społecznościowy edytor motywów dla shadcn/ui pozwalający generować spójne rejestry zmiennych (projekt na licencji Apache-2.0).
- [Claude Fable 5.1 Architecture](https://www.anthropic.com/claude-fable-and-mythos-5-1) — techniczne omówienie Anthropic dotyczące możliwości modelu Fable 5.1 w zakresie analizy wizualnej i wierności odwzorowania struktur kodu.
- [Claude Design Overview](https://claude.com/product/design) — oficjalny opis produktu Anthropic do prototypowania interfejsów na podstawie istniejącego design systemu (dostępnego w wersji beta w płatnych planach).
- [Remote MCP Server Installation](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) — oficjalna instrukcja Figmy opisująca konfigurację zdalnego serwera Figma MCP i uwierzytelniania w środowiskach deweloperskich.
- [Code Connect Integration in MCP](https://developers.figma.com/docs/figma-mcp-server/code-connect-integration/) — przewodnik Figmy po mapowaniu komponentów projektowych na kod źródłowy w repozytorium za pomocą technologii Code Connect.
- [Better Code, Fewer Tokens](https://www.figma.com/blog/the-benefits-of-code-connect-in-mcp/) — techniczny raport Figmy z ewaluacji efektywności integracji Code Connect w zadaniach programistycznych z udziałem agentów AI.
- [DESIGN.md Specification](https://github.com/google-labs-code/design.md) — oficjalne repozytorium Google Labs z eksperymentalnym formatem formalnego zapisu uzasadnień decyzji projektowych w repozytorium.
- [Impeccable](https://github.com/pbakaus/impeccable) — otwartoźródłowe narzędzie wspierające inżynierów w prowadzeniu formalnej krytyki i audytu jakości interfejsów użytkownika.
- [Best LLM for Frontend 2026](https://www.startrise.io/blog/best-llm-for-frontend/) — analiza porównawcza modeli językowych w serwisie Startrise w zadaniach generowania interfejsów (144 buildy testowe, lipiec 2026).
- [AI Dev Tool Power Rankings September 2026](https://blog.logrocket.com/ai-dev-tool-power-rankings/) — przeglądowe zestawienie narzędzi i modeli deweloperskich w serwisie LogRocket na podstawie publicznych aren i wskaźników produktywności.
- [Comparing AI Code Tools in Practice](https://www.xda-developers.com/claude-code-codex-google-antigravity-rebuild-same-website-one-different/) — studium przypadku z serwisu XDA: odtworzenie tego samego projektu strony internetowej w trzech różnych środowiskach agentowych.
