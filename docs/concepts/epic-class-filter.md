# Epic-Klasse als Facette der Portfolio-Übersicht

> Status: **Umgesetzt** · Erstellt 2026-09-03
>
> Wireframes: <https://claude.ai/code/artifact/211f5a7b-0aa1-4a4f-99ac-8dd51b870793>
>
> Baut auf [art-epics.md](art-epics.md) auf: dort entsteht die Unterscheidung,
> hier wird sie lesbar.

Seit Guardrail 3 stehen zwei Sorten Epics im selben Board: **Portfolio-Epics**,
über die das Portfolio entscheidet, und **ART-Epics**, die ein ART aus seinem
eigenen Rahmen bezahlt. Auf `/portfolio` sind sie vermischt — und je nachdem,
wer schaut, ist die eine Hälfte Arbeit und die andere Rauschen. Auf _Large Test
Corp_ trägt ein einzelner ART bis zu 23 ART-Epics; sie füllen das Board, ohne
dass das Portfolio über eines davon entscheidet.

Die Facette blendet die andere Klasse aber **nicht weg**. Sie fasst sie je
Solution zusammen und weist sie aus: ein Portfolio-Manager will die vierzig
kleinen ART-Epics nicht einzeln lesen, aber sehr wohl wissen, was die ARTs
beitragen.

---

## 1 · Begriffe

| Begriff              | Bedeutung                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Klasse**           | `portfolio` \| `art` \| `null`, aus `classifyEpic(epic, limit)`. `null` = kein freigegebener Business Case, also noch nicht entschieden. |
| **Sichtbare Klasse** | Die in der Facette gewählte. Sie steht einzeln in den Listen.                                                                            |
| **Verborgene Menge** | Die andere Klasse. Sie wird nicht entfernt, sondern zusammengefasst.                                                                     |
| **Sammelzeile**      | Eine Zeile je Solution über der verborgenen Menge. Kein Link auf ein Epic, kein Datum, keine Person.                                     |

## 2 · Anforderungen

**REQ-1 · Die Facette.** Die Filterleiste auf `/portfolio` hat eine fünfte
Facette **„Epic-Klasse"** mit den zwei Werten aus `EPIC_CLASS_LABELS`,
Mehrfachauswahl wie die vier bestehenden, URL-Parameter `cls`. `?cls=art` ist
teilbar; leere Auswahl = keine Einschränkung.

**REQ-2 · Ohne Business Case gilt Portfolio.** Ein Epic ohne freigegebenen
Business Case zählt zur Portfolio-Seite. Vor L3.1 ist nicht entschieden, wie
groß das Vorhaben ist; der Funnel bleibt beim Portfolio, abgezweigt wird später.
Deshalb hat die Facette **zwei** Werte, nicht drei.

**REQ-3 · Practice-Gate.** Ist `artEpics` im Mandanten aus, wird die Facette
nicht gerendert und `cls` aus der URL ignoriert. Ohne die Practice gibt es keine
ART-Epics; eine leere Unterscheidung anzubieten wäre irreführend.

**REQ-4 · Die Facette teilt, sie filtert nicht.** Die Abfrage bleibt
unverändert; die Klasse wird auf der geladenen Menge angewandt.

- **REQ-4a** Die **WIP-Zähler** über den Kanban-Spalten zählen unverändert alle
  Epics der Spalte. Ein Limit, das Entwarnung meldet, weil jemand gefiltert hat,
  ist schlimmer als keines.
- **REQ-4b** Die verborgene Menge steht der Zusammenfassung zur Verfügung.

**REQ-5 · Zusammenfassung je Solution.** Gruppiert wird nach der
**Primär-Solution**, absteigend nach Anzahl, bei Gleichstand alphabetisch. Epics
ohne Primär-Solution bilden die eigene Gruppe **„Ohne Solution"** — sie werden
nicht still verrechnet. Ein ART-Epic ist ein Stück Veränderung an einer
Solution; der Wertstrom wäre zu grob, der ART benennt die Zuständigkeit, nicht
den Gegenstand.

**REQ-6 · Beide Richtungen.** Auch bei `cls=art` wird die Portfolio-Seite
zusammengefasst ausgewiesen. Ein Codepfad, keine Sonderbehandlung.

**REQ-7 · Reichweite: alle Inhalte der Seite.**

| Block                           | Verborgene Menge                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kanban**                      | Je Zelle unter den Karten eine Sammelkarte je Solution mit der Anzahl, verlinkt auf `/portfolio/solutions/[id]`; „Ohne Solution" ohne Link. |
| **Epic-Beitrag zu Kopf-Zielen** | Je Solution eine Tabellenzeile mit je Einheit summierten Werten; der Plan/Ist-Umschalter wirkt auf sie wie auf die übrigen.                 |
| **L4-Abschluss fällig**         | Je Solution eine Zeile „N überfällig · M demnächst". Kein Datum, keine Dauer.                                                               |
| **Features fällig**             | dito; ein Feature erbt Klasse und Solution seines Epics.                                                                                    |
| **Zur Steuerung markiert**      | Eine **Fußzeile** mit Sammel-Chips — keine Sammelzeile in der Tabelle.                                                                      |

**REQ-8 · Die Summe ist dieselbe Größe wie die Einzelzeile.** Beim Beitrag: je
Einheit addieren, verschiedene Einheiten getrennt lassen — dieselbe Regel wie
`aggregateEpicContribution`. Bei der Fälligkeit: nur die Anzahl. Eine gemittelte
Überfälligkeit über sechs Epics wäre eine Zahl, die für kein einziges gilt.

**REQ-9 · Eine Sammelzeile darf nicht wie eine Zeile aussehen.** Gestrichelter
Rahmen, eingefärbter Grund in der Farbe der verborgenen Klasse (blau Portfolio,
smaragd ART — dieselben wie in `EpicClassBadge`), kein Datum, keine Person. Über
jedem betroffenen Block eine Zeile im Klartext, solange gefiltert ist.

**REQ-10 · Gespeicherte Filter.** `SavedFilterCriteria` trägt `cls: string[]`;
`parseSavedFilterCriteria` liest fehlende Schlüssel als `[]`, vor der Facette
gespeicherte Filter bleiben gültig. Der Auto-Standard-Redirect trägt `cls` mit.

## 3 · Ausdrücklich nicht Teil

- Keine Berechtigung: jeder sieht beide Klassen. Wer eine feste Sicht will,
  speichert sie als Standard-Filter.
- Keine rollenabhängige Vorbelegung.
- Die Epic-Liste `/portfolio/epics` (eigene, clientseitige Facettenzeile) bleibt
  unberührt.

## 4 · Umsetzung

Die Klasse ist kein Prädikat, das eine Datenbank kennt: sie entsteht aus dem
Business-Case-JSON gegen ein **wertstromabhängiges** Limit. Aus REQ-4 folgt, dass
eine Query-Verengung auch gar nicht gewollt ist. Also trägt **jede
epic-abgeleitete Zeile des Modells ihre Klasse und ihre Solution**, und zwei
reine Helfer erledigen den Rest in den Blöcken.

| Baustein                                                              | Ort                                                                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `classifyEpics(db, tenantId, epicIds?)`                               | `modules/work/server/services/epic-class.ts` — eine Welle, drei Queries; liefert Klasse **und** Primär-Solution. Auch `period-detail.ts` nutzt ihn (vorher dort inline). |
| `isClassShown`, `rollUpBySolution`, `hiddenClass`, `hiddenClassLabel` | `modules/work/domain/epic-class-filter.ts` — rein und getestet                                                                                                           |
| `PortfolioFilter.epicClasses`, `ClassFilterState`, `ContributionRow`  | `modules/work/server/views/portfolio-overview.ts`                                                                                                                        |
| Farbe und Klartext-Zeile der Sammelzeilen                             | `features/portfolio/overview/blocks/class-rollup.tsx`                                                                                                                    |

Der Business-Case-JSON wird **nur** nachgeladen, wenn die Facette gesetzt ist —
`listEpicsForOverview` lässt ihn bewusst weg, und dabei bleibt es für den
ungefilterten Normalfall. Die Menge umfasst dann Karten, Beitragszeilen und die
Eltern der Features.

`loadEpicGoalContributions` (Modul `core/goals`) lädt ungefiltert und kennt
keine Solution; die Zuordnung entsteht deshalb im Work-Modell, nicht im
Beitrags-Loader — `core/goals` bleibt unberührt (ADR-0013).
