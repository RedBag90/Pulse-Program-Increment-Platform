# ADR-0024: Zwei Sprachen, eine Oberfläche — Text gehört in den Katalog

- Status: accepted
- Date: 2026-09-23

## Context

Das technische Konzept verspricht Zweisprachigkeit an drei Stellen:

> `pulse-technical-concept.md:50` — **i18n from day one** — German and English
>
> `:68` — **G7** — i18n-ready out of the box — German and English at launch
>
> `:1195` — **All user-facing strings in messages files — no inline literals**

Die Akzeptanzkriterien der Story PULSE-05 nennen zusätzlich eine ESLint-Regel,
die das durchsetzen soll (`pulse-implementation-concept.md:499`).

Eine Inventur (Stand 2026-09-23) zeigt, dass davon nur der Rahmen gebaut wurde:

|                                                       |                               |
| ----------------------------------------------------- | ----------------------------- |
| `page.tsx` gesamt                                     | 73 — alle unter `[locale]`    |
| davon mit Übersetzungsaufruf                          | **5**                         |
| `.tsx` unter `src/modules/`, die `next-intl` berühren | **0 von 284**                 |
| Katalogschlüssel je Sprache                           | 126 — davon 60 Navigation     |
| `.tsx` mit deutschen Literalen                        | **326 von 449**               |
| `locale === "…"`-Verzweigungen im Repo                | **1** (die Einladungs-E-Mail) |
| ESLint-Regel gegen rohe Strings                       | **existiert nicht**           |

Die Mechanik ist dabei nicht Kulisse: `next-intl` ist verdrahtet, Middleware
und `[locale]`-Segment stehen, beide Kataloge sind lückenlos, der Umschalter in
der Topbar funktioniert. Er schaltet nur nichts um, weil der Inhalt nicht in
den Katalogen steht.

Drei Folgen, die das über die blosse Lücke hinaustragen:

1. **Die Vorgabe war `en`.** Wer ohne Cookie kam, landete auf `/en/` und bekam
   deutsche Inhalte mit englischer Navigation — die schlechteste der drei
   möglichen Fassungen.
2. **Deutsch war nicht einmal in sich geschlossen.** 32 Dateien mit 60 Stellen
   englischer, übersetzbarer Oberfläche: Ziel-Status („On track", „No recent
   updates"), das vollständig englische Audit-Log inmitten der deutschen
   Administration, `Try again`, und 33 von 119 Fehlermeldungen der
   Server-Actions.
3. **Die Formate waren fest deutsch.** `"de-DE"` an 63 Stellen, eine eigene
   Monatstabelle — auf `/en/` stand weiterhin `05.06.2026` und `12.345 €`.

Ein späteres Dokument hat die Aufgabe beiläufig bestätigt
(`budgeting-ui-refactor.md:218`: „Mehrsprachigkeit (Dashboard ist einsprachig
Deutsch, Inline-Copy)"), ohne dass die drei Versprechen je zurückgenommen
wurden. **Genau das ist der Grund für diese ADR:** die Entscheidung war
gefallen, aber nirgends getroffen — und was nirgends steht, kann auch niemand
einhalten.

## Decision

**Pulse ist zweisprachig, Deutsch und Englisch, und Text gehört in den
Katalog.** Die drei Versprechen gelten; sie werden nicht zurückgenommen,
sondern eingelöst.

Daraus folgen fünf Regeln:

1. **Kein sichtbarer Text im Code.** Was ein Nutzer liest, steht in
   `messages/de.json` und `messages/en.json` — auch Fachbegriffe, die in beiden
   Sprachen gleich lauten. Sonst entscheidet die Fundstelle darüber, ob ein
   Begriff übersetzbar ist.

2. **Die Domäne liefert Schlüssel, keine Wörter.** Reine Funktionen und
   Konstanten-Tabellen können `useTranslations` nicht aufrufen; sie geben
   Katalog-Schlüssel zurück, und die Oberfläche übersetzt. Das betrifft heute
   51 Label-Tabellen unter `domain/`.

3. **Formatierung folgt der Sprache.** Zahlen, Geld und Daten laufen über
   `src/lib/formatting.ts`; jede Funktion nimmt einen Locale.
   `useFormat()` bindet ihn im Client, `requestLocale()` löst ihn auf dem
   Server auf.

4. **Die Vorgabe ist Deutsch**, solange die Übersetzung läuft. Sie beschreibt,
   was die Oberfläche tatsächlich spricht. Ist die Umstellung vollständig, kann
   sie neu entschieden werden.

5. **Route-Segmente bleiben deutsch.** `/en/ziele` ist unschön, aber harmlos;
   eine `pathnames`-Übersetzung bräche jedes Lesezeichen und jeden Deep-Link
   aus versendeten E-Mails. Später nachziehbar.

## Consequences

**Der Wächter ist projektweit, seit Zug 3 abgeschlossen ist.** Er begann als
Liste von zwölf Dateien, wuchs auf 455 und ist seit dem Abschluss von Zug 3
ein Verzeichnis-Durchgang über `src/` — der Endzustand, den diese ADR
angekündigt hat. Zwei Ausnahmen stehen benannt in der Testdatei:
`global-error.tsx` (ersetzt das Dokument, hat keinen Provider) und die
Einladungs-E-Mail (zwei Funktionen statt Platzhaltern — das Muster, das diese
ADR selbst als richtig benennt).

**Was der Wächter nicht sieht.** Er prüft JSX-Text und die Eigenschaften, die
auf dem Bildschirm landen. Eine Konstanten-Tabelle in `domain/` sieht er
nicht: die `help`-Prosa der Gate-Kriterien, `ROLE_PLAYBOOKS` und die
Fehlermeldungen der Services stehen in gewöhnlichen Objekten. Ein grüner Lauf
heisst deshalb **nicht**, dass die Anwendung fertig übersetzt ist — er heisst,
dass keine Fläche zurückfallen kann.

**Der Wächter ist ein Test, keine ESLint-Regel.** `eslint-plugin-react` ist im
Projekt nicht installiert, und das Repo hat für Quelltext-Regeln bereits ein
Muster: den ADR-0021-Wächter (`src/test/helpers/visual-language.ts`). Der
i18n-Wächter (`translated-surfaces.ts`) übernimmt dessen Bauweise samt
Begründung — **datei-, nicht projektweit**: ein Wächter über alles wäre am Tag
seiner Entstehung rot. Die Liste der geprüften Flächen wächst mit der
Umstellung; am Ende steht dort ein Verzeichnis-Durchgang statt einer Liste.

**Die Tests sind die halbe Arbeit.** 193 von 279 Testdateien prüfen heute
deutsche Wörter (`expect(…).toBe("Gefährdet")`). Jede umgestellte
Domänen-Tabelle bricht sie; sie prüfen künftig Schlüssel.

**Der Katalog wächst von 126 auf einige tausend Schlüssel.** Die flache
Namensraum-Ebene trägt das nicht mehr; die Konvention steht in `CONTEXT.md`.

**Die Naht für alles ohne Bildschirm ist ein Parameter.** `Translate`
(`src/i18n/translate.ts`) ist das kleinste Stück von `next-intl`s `t`, das
trägt: ein Schlüssel, ein Wort. Der PDF-Bericht war der erste Fall, die
E-Mail-Vorlagen und die Fehlermeldungen der Services sind die nächsten.

**Die Tests kosteten ein Fünftel dessen, was diese ADR befürchtet hat.** Am
Ziele-Modul gemessen: von 27 Testdateien trugen 14 deutsche Zusicherungen, und
**5** mussten tatsächlich geändert werden. Der Grund ist eine einzige
Entscheidung — `next-intl` wird in `src/test/setup.ts` durch den echten Katalog
ersetzt, statt jede Testdatei in einen Provider zu wickeln. Hochgerechnet auf
die 193 gefährdeten Dateien sind das rund 70, nicht 193.

**Das Englisch braucht fachliches Gegenlesen.** „Reifegrad", „Wertstrom",
„Verteilbogen", „Anliegen" sind Begriffe, bei denen eine wörtliche Übersetzung
in die Irre führt.

## Alternatives considered

**Einsprachig Deutsch, die Versprechen streichen.** Ehrlich und billig — die
`[locale]`-Mechanik wäre dann toter Ballast und könnte entfallen. Verworfen,
weil die Zweisprachigkeit ein Produktziel ist (G7) und der Umschalter bereits
sichtbar in der Oberfläche steht: ihn zu entfernen wäre ein Rückschritt für
jeden, der ihn schon gefunden hat.

**Nur die englischen Reste eindeutschen.** Hätte Folge 2 behoben und die
Oberfläche in sich geschlossen — aber den Umschalter weiterhin wirkungslos
gelassen.
