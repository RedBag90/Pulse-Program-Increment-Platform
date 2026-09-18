# ADR-0022: Eine Solution ist Struktur, nicht Arbeit

- Status: accepted
- Date: 2026-09-17

## Context

Solutions waren an das Modul **Work** gebunden. Das stand an drei Stellen:

- Zwei Ausnahmen in `PATH_OVERRIDES` (`modules.ts`) bogen `/structure/solution`
  und `/structure/solutions` von `core` auf `work` um.
- `solution.` stand in `MODULES.work.actions`.
- Der gesamte Code lag unter `src/modules/work/`.

Die Begründung stand als Kommentar daneben:

> „`solution.` war bis zum Struktur-Umbau **keinem** Modul zugeordnet — die
> Vollständigkeits-Invariante war deswegen dauerhaft rot. Solutions sind Work:
> sie tragen den Grow-Anteil aus den Primär-Epics."

Der erste Satz erklärt, warum überhaupt eine Zuordnung nötig war. Der zweite
erklärt die Wahl — und er trifft nur die **Hälfte** der Sache.

Eine Solution ist zweierlei:

1. ein **Strukturknoten** — Name, Wertstrom, ART, Horizont, Verantwortliche,
   Lebenszyklus. Er hängt am Wertstrom wie ein ART und ist ohne jedes Epic
   vollständig;
2. eine **Investitionssicht** — Grow aus den Primär-Epics, Run aus den
   Run-the-Business-Positionen.

Nur (2) ist Arbeit. Und für den Run-Anteil war die Trennung längst gezogen: er
steht bewusst nicht im Work-View, das Budgeting liefert ihn, und die Route setzt
beides zusammen (`solutions-list.ts`: _„Run steht hier bewusst nicht drin … Die
Route komponiert beides."_).

Die Bindung an Work hatte eine sichtbare Folge und eine unsichtbare.

**Sichtbar:** der Solutions-Reiter auf der Wertstrom- und der ART-Detailseite
hing allein an `inScope`, einer Berechtigungsprüfung. Ein Mandant ohne Work sah
dort Solution-Namen, Horizonte und Grow-Summen; erst der Klick lief in den
Route-Guard. Drei Zeilen darüber prüfte dieselbe Datei sehr wohl auf
`budgetingEnabled`.

**Unsichtbar:** ein Mandant, der nur seine Organisation abbilden will —
Wertströme, ARTs, Produkte —, musste ein Modul buchen, das Epics, Features und
das Portfolio-Kanban mitbringt. Die Struktur ist die Free-Basis; ein Produkt
gehört dazu.

## Decision

**Die Solution ist ein Core-Konzept.** Sie folgt ihrem Segment: `/structure`
ist `core`, und die beiden Pfad-Ausnahmen entfallen. `solution.` steht in
`MODULES.core.actions`.

**Die Investitionssicht bleibt oben.** Grow und der Epics-Reiter kommen aus
Work (`work/server/views/solution-grow.ts`), Run aus dem Budgeting. Ohne das
jeweilige Modul entfällt die Spalte, die Kachel oder der Reiter — **nicht** auf
0 € gesetzt: eine Null heisst „nichts investiert", nicht „nicht gebucht".

**Der Investitionshorizont sinkt mit.** `Horizon` samt Beschriftungen und
Erklärtexten steht jetzt in `core/org/domain/horizon.ts`, weil die Solution ihn
trägt; ein Typ gehört auf die unterste Schicht, die ihn braucht (ADR-0013).
`portfolio-guardrails.ts` reicht ihn weiter, damit die rund zwanzig
Work-Stellen unberührt bleiben. Stationen und Guardrail-Ziele bleiben Work — sie
sind Portfolio-Steuerung.

**Die Verknüpfung Epic ↔ Solution bleibt Work.** Sie autorisiert ein _Epic_
(`epic.update`), nicht die Solution. Das war schon vorher die Naht: es ist die
einzige Funktion des alten Service, die `loadAuthorizedEpic` brauchte.

## Consequences

- Mandanten mit `enabled_modules = ["core"]` — im Bestand die persönlichen
  „Mein Bereich"-Mandanten — sehen den Solutions-Bereich und können Solutions
  anlegen. Das ist gewollt und die sichtbarste Folge dieses Beschlusses.
- Die ESLint-Schranke für `src/modules/core/**` erzwingt die Trennung: bleibt in
  Core ein Import aus `@/modules/work/**` stehen, scheitert `pnpm lint`. Ein
  halber Umzug kann nicht durchrutschen.
- Die Solutions-Fläche hat jetzt drei Ausbaustufen statt zwei. Das ist mehr
  Verzweigung in den Routen — aber es ist dieselbe Verzweigung, die Run schon
  hatte, und sie steht dort, wo sie hingehört: in der Kompositions-Wurzel.
- ADR-0013 bleibt unangetastet. Dieser Beschluss ordnet einen Begriff neu ein,
  er ändert die Schichtung nicht.

---

## Nachtrag 2026-09-18 — die Verknüpfung reicht bis zum Feature

ADR-0023 lässt ein Feature seine Solution **selbst** tragen (die eigene, sonst
die des Epics). Das ändert an dieser Entscheidung nichts, präzisiert aber einen
Satz: _„Sie autorisiert ein Epic (`epic.update`), nicht die Solution"_ galt für
die Epic-Verknüpfung. Die Feature-Zuordnung autorisiert entsprechend ein
**Feature** (`feature.update`), ebenfalls nicht die Solution — die Richtung
bleibt also dieselbe.

Die Solution bleibt Core, die Verknüpfung bleibt Work. Neu ist nur, dass Work
sie an zwei Ebenen führt: `EpicSolution` (n:m, mit Primär) am Epic,
`primarySolutionId` allein am Feature — ein Feature wird in genau **eine**
Solution geliefert, es braucht keine Verknüpfungstabelle.

---

## Nachtrag 2026-09-19 — das ART wird Pflicht, der Wertstrom bleibt die Heimat

Diese Entscheidung hängt die Solution an den **Wertstrom**: dort gehört sie hin,
und `valueStreamId` ist deshalb Pflicht, `artId` war es nicht.

Mit `art-budget-consolidation.md` wird auch `artId` Pflicht. **Das stellt die
Zuordnung nicht um.** Der Wertstrom bleibt die Heimat der Solution; das ART ist
die Angabe, _welcher Zug sie baut_. Beide ARTs eines Stroms liegen in
demselben Strom — die Pflicht verschiebt also keine Ebene, sie schließt eine
Lücke.

Zwei Dinge, die dabei nicht verwechselt werden dürfen:

- **Die Solution wandert nicht unter das ART.** Sie bleibt ein Kind des
  Wertstroms in Baum, Navigation und Rechten. `Solution.artId` ist ein Verweis,
  keine Elternschaft — genau wie `productManagerId` ein Verweis ist und keine
  Zugehörigkeit.
- **Der Fremdschlüssel wird strenger.** `ON DELETE SET NULL` wäre ab jetzt ein
  Widerspruch in sich: ein hart gelöschtes ART setzte `art_id` auf NULL und
  verletzte die Pflicht im selben Atemzug. Er wird `RESTRICT`. Das übliche
  Löschen im Haus ist ohnehin weich (`deleted_at`), also trifft das niemanden,
  der den normalen Weg geht.
