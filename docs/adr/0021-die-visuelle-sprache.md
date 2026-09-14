# ADR-0021: Die visuelle Sprache steht in Tokens, nicht in Klassenketten

- Status: accepted
- Date: 2026-09-14

## Context

Die Anwendung hat ein durchdachtes Fundament: eine OKLCH-Palette mit begründeter
Hue-Wahl, ein Drei-Ebenen-Flächenmodell (`--surface-frame` < `--background` <
`--card`), eine Radius-Skala als Faktoren auf einen einzigen Drehpunkt, und
Elevation, die Tailwinds `shadow-*` themengerecht überschreibt.

Und sie hat vier Lücken, die dieses Fundament unterlaufen. Eine Inventur über
`src/` (Stand 2026-09-14) hat sie beziffert:

| Lücke                                               | Folge im Bestand                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `--warning`, `--success`, `--info` existieren nicht | **858** rohe Tailwind-Palettenwerte, davon **388 ohne `dark:`-Partner**                               |
| Keine Typo-Skala unter `text-xs`                    | **elf** frei gewählte Pixelwerte (8–11,5 px) in **292** Vorkommen                                     |
| Kein Elevation-Token für die Karte                  | zwei Kartensprachen: `ring-1 ring-foreground/10` in 10 Dateien, `rounded-lg border bg-card` in **73** |
| Kein Dokument, kein ADR                             | jede Regel zerfällt beim nächsten Feature                                                             |

Der Zusammenhang ist ursächlich, nicht zufällig. Wer eine Warnung einfärben
will, findet kein Token und schreibt `bg-amber-50 text-amber-700` — und weil das
Paar nirgends steht, vergisst die Hälfte der Aufrufer die `dark:`-Variante.
290 Amber- und 201 Emerald-Vorkommen sind keine Nachlässigkeit, sondern die
vorhersehbare Folge einer fehlenden Zeile in `globals.css`.

Dasselbe gilt für die Mikro-Beschriftung. `src/components/ui/section-label.tsx`
beansprucht in seinem Docstring ausdrücklich, _„one source of truth for the
print-inspired label style"_ zu sein. Drei Stellen halten das ein; fünf weitere
Bauteile derselben Bibliothek schreiben eigene Fassungen — mit vier Größen,
drei Gewichten und vier Laufweiten. `PageSection` ist dabei 40 % größer als
`SectionLabel`, obwohl beide „Überschrift über einem Abschnitt" sind und auf
denselben Seiten untereinander stehen.

Die visuelle Schicht ist heute ausschließlich durch Inline-Kommentare in
`globals.css` begründet — teils sehr gut, aber nirgends als Regel greifbar.
Umgekehrt ist die Layout-Schicht extern dokumentiert (`docs/design-tokens.md`)
und im Code zu 70 % nicht umgesetzt: sieben der zehn dort als verbindlich
beschriebenen Tokens werden von keiner Zeile gelesen.

## Decision

Fünf Sätze. Jeder ist prüfbar, und jeder schließt eine der Lücken.

### 1. Farbe steht nie allein

Jede semantische Farbe ist ein **Paar aus Fläche und Schrift** und existiert in
**beiden** Themen. Sie wohnt in `globals.css`:

```
--success / --success-surface     --warning / --warning-surface
--info    / --info-surface        --destructive / --destructive-surface
```

Rohe Tailwind-Palette ist erlaubt, **wo eine dokumentierte Achse sie trägt** —
`src/modules/risks/features/lib/issue-badges.tsx` ist das Vorbild: eine Tabelle
je Achse (Exposure, ROAM, Review), vollständige `dark:`-Paare, Kopfkommentar,
der die Existenz begründet. Nicht erlaubt ist die Palette als Einzelfall in
einer Klassenkette.

**Feste Hex-Werte** bleiben dort zulässig, wo SVG oder Canvas konkrete Werte
braucht (`components/charts/`, die Graph-Ansichten). Sie gehören dann in eine
benannte Tabelle, nicht in den Aufrufer.

**Zwei Grenzen der Regel**, beide im Umbau gefunden:

- **Papier hat kein Thema.** Eine Fläche mit `print:`-Klassen
  (`ballot-sheets.tsx` — ein Verteilbogen zum Ausfüllen) ist weiß mit
  schwarzer Schrift, in beiden Themen. Die Regel verlangt Paare, _damit der
  Dunkelmodus stimmt_; wo keiner existiert, gibt es nichts zu paaren.
- **Ein Schleier ist keine Fläche.** `bg-white/10` über einem farbigen Grund
  (`auth-hero.tsx`) lässt durchscheinen, was darunter liegt, und braucht kein
  dunkles Gegenstück.

### 2. Eine Karte

Eine Karte ist `rounded-lg` plus `--elevation-card`. **Kein `border` als
Kartenumriss** — die Haarlinie liegt im Schatten.

Das ist keine Geschmacksfrage: ein Rahmen zeichnet eine harte Kante auf jeder
Fläche gleich, ein Elevation-Ring folgt der Ebene, auf der die Karte liegt. Das
Drei-Ebenen-Modell wird damit sichtbar, statt nur definiert zu sein.

`src/components/ui/card.tsx` ist die einzige Fassung. Wer eine Fläche braucht,
nimmt sie.

**Was keine Karte ist.** Drei Rahmen sagen etwas über den _Inhalt_ und dürfen
deshalb neben `bg-card` stehen, ohne die Regel zu brechen — die Elevation kann
ihre Bedeutung nicht ausdrücken:

- `border-dashed` — „noch nicht da" (der Platzhalter-Knoten im Netzbild), „leer".
- `border-l-*` und die übrigen Seitenrahmen — eine Akzentschiene
  (`concept-callout.tsx`), eine Trennlinie. Nie der Umriss.

Und `bg-card` ist keine Auszeichnung für **Bedienelemente**. Ein Auslöser, ein
Auswahlfeld, eine Listenzeile steht auf `bg-background`; `bg-card` sagt „hier
beginnt eine Fläche".

### 3. Sieben Schriftgrößen

`text-label` (10 px) · `text-meta` (11 px) · `text-xs` · `text-sm` ·
`text-base` · `text-lg` · `text-2xl`.

**Und drei für das Lesen.** Ein Wiki-Artikel ist ein anderes Medium als eine
Arbeitsfläche: er wird gelesen, nicht bedient, und steht in
`--reading-max-w`. Zwischen `text-sm` (14) und `text-base` (16) fehlt genau
die Stufe, die ein Absatz braucht. `--text-prose` (15 px) ·
`--text-prose-lede` (17 px) · `--text-code` (0.85em, relativ — Inline-Code
wächst mit seinem Absatz). Sie ersetzen acht verstreute Pixelwerte im Wiki.

**Keine beliebigen Pixelwerte.** Die beiden Stufen unter `text-xs` sind Tokens
(`--text-label`, `--text-meta`), keine Arbitrary Values — damit sie
verhandelbar bleiben und an einer Stelle stehen.

Die Mikro-Beschriftung hat **ein** Rezept, und `SectionLabel` trägt es:
`text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground`.

### 4. Drei Radien

**Fläche** `rounded-lg` · **Bedienelement** `rounded-md` · **Pille**
`rounded-full`.

`rounded` (Tailwind-Default 4 px) und `rounded-4xl` sind nicht Teil der Skala:
sie hängen nicht an `--radius` und bewegen sich beim nächsten Dreh nicht mit.

### 5. Ein Fokus-Ring

`focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` —
immer `focus-visible`, nie `focus`. Ein Ring, der beim Mausklick erscheint, ist
kein Fokus-Ring, sondern ein Aufblitzen.

**Breite und Deckung gehören dazu.** Der zweite Dialekt schreibt
`focus-visible:ring-2 focus-visible:ring-ring` — richtige Bedingung, falsche
Breite, volldeckende Farbe. Er zählt genauso als Verstoß. Ausgenommen ist der
Ring eines ungültigen Feldes (`ring-destructive/20`): andere Rolle, eigene
Farbe.

## Consequences

**Was leichter wird.** Eine Warnung einzufärben ist eine Token-Wahl, keine
Recherche. Der Dunkelmodus stimmt by construction, statt 388-mal einzeln
nachgezogen zu werden. Und die Regel ist prüfbar: ein Test kann über eine Datei
laufen und sagen, ob sie sie einhält — siehe die Wächter-Vorlage in
`src/test/helpers/`.

**Was es kostet.** 73 Dateien schreiben heute die Karte von Hand, rund 500
Stellen tragen rohe Farbe. Das ist mechanisch, aber breit. Deshalb wird die
Regel **an einer Seite erprobt** (`/portfolio/epics`), bevor irgendetwas
ausgerollt wird — und deshalb ist dieser ADR additiv formuliert: kein
bestehendes Token ändert seinen Wert.

**Was ausdrücklich nicht folgt.** Keine neue Palette — der Hue-262-Blau bleibt.
Keine Verläufe. Und kein Austausch der OKLCH-Grundlage: gleichmäßige Helligkeit
über alle Farbtöne ist genau das, was die semantischen Paare aus Satz 1 erst
sauber macht.

**Was offen war und entschieden ist.** `--font-heading` war wertgleich mit
`--font-sans` — 57 Verwendungen von `font-heading` bewirkten nichts. Es trägt
jetzt **Inter Tight** (`src/app/[locale]/layout.tsx`), und `PageHeader` bekam
das `font-heading`, das ihm als einziger H1 des Systems fehlte.

## Rollout

Der Wächter ist ein **Durchgang über `src/`**, keine Liste. Er begann als
Liste von fünf Dateien — ein projektweiter Test wäre damals rot gewesen — und
wuchs über Routen und Verzeichnisse dorthin, wo nichts mehr auszunehmen ist.

Zwei Dinge hat der Weg gelehrt, beide teuer:

**Eine Dateiliste sagt nie, wann eine Seite fertig ist.** Nach Dateien gezählt
galt `/portfolio/epics/[id]` als umgebaut, während im Graph noch 115 Verstöße
in 25 Dateien standen: Dialoge und Formulare, die erst auf Klick erscheinen,
Reiter aus einem anderen Modul, vier Bibliotheksbauteile.

**Eine Routenmessung ab `page.tsx` sieht die Navigation nicht** — die lebt im
`layout.tsx`. Das Chrome, das auf _jeder_ Seite steht, war nie gemessen, bis
der Verzeichnis-Durchgang es fand. Ebenso sechs Dateien, die an **keinem**
Importgraph hängen.

Deshalb der Durchgang: wer eine neue Fläche baut, wird gemessen, ohne sich
eintragen zu müssen.

| Zug | Fläche                                                                     | Dateien |
| --- | -------------------------------------------------------------------------- | ------: |
| 3   | `/portfolio/epics` — der Pilot                                             |       5 |
| 5   | `/portfolio/epics/[id]` — eigene Bauteile                                  |      11 |
| 5   | die geteilten Bauteile der Reiter _Deliverables_, _Dependencies_, _Issues_ |       5 |
| A   | die Bibliothek — acht Bauteile, die 28 Routen tragen                       |       8 |
| B   | `work/portfolio`                                                           |      37 |
| C   | die Feature-Familie — `work/feature` + `drumbeat`                          |      35 |
| D   | `risks`                                                                    |       5 |
| E   | `budgeting`                                                                |      17 |
| F   | `core` — goals und org                                                     |      25 |
| G   | `wiki`, `features/*`, `my-tasks`, das Chrome, die Seitendateien            |     ~60 |

**Abgeschlossen.** Alle 62 Seiten halten die Regel über ihren gesamten
Importgraph; `src/` ist vollständig sauber. Der Wächter ist deshalb kein
Verzeichnis mehr, sondern ein Durchgang über den Quellbaum —
`src/components/__tests__/visual-language.test.tsx`.

Die fünf geteilten Bauteile tragen zugleich `/implementation/features`, das
Feature-Cockpit und `/issues` — dieselbe Umstellung an einem Ort, drei Flächen
erben sie.

Der Wächter liest **Quelltext ohne Blockkommentare**. Eine Datei darf
beschreiben, was sie früher geschrieben hat; gemessen wird, was gerendert
wird.
