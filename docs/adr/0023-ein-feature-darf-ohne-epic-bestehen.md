# ADR-0023: Ein Feature darf ohne Epic bestehen

- Status: accepted
- Date: 2026-09-18

## Context

Im klassischen SAFe hält das ART-Backlog **Features**, und die müssen kein
Portfolio-Epic über sich haben: das ART-Backlog ist nicht der Unterbau des
Portfolio-Backlogs. In Pulse ging das nicht. Drei Schichten verboten es —
`parentId: z.string().uuid()` an beiden Schreibkanten, `parentId: EpicId` im
Service-Eingang, und `validateParentLevel`, das ohne Elternteil `not_found`
zurückgab.

Dagegen steht ein Dokument. `docs/concepts/pulse-technical-concept.md` §6.4
führt eine Tabelle unter der Überschrift _„The following invariants MUST hold at
all times"_, und Zeile **I2** lautet:

> `Epic ⟺ parentId === null` — ✓ TypeScript · ✓ Zod · ✓ Prisma · ✓ PostgreSQL

Das ist eine **Bikonditionale**: Epic _genau dann_, wenn kein Elternteil. Sie
verbietet das eigenständige Feature ausdrücklich.

**Drei der vier behaupteten Durchsetzungen gibt es nicht.** An `initiatives`
hängt kein einziges CHECK (nur Fremdschlüssel und Primärschlüssel);
`prisma/sql/invariants.sql` enthält zwar `i2_epic_no_parent`, ist aber nie
angewandt worden — die Datei nennt längst gelöschte Spalten wie `sprint_id`.
Zwei weitere Zeilen derselben Tabelle sind ebenfalls überholt: **I4** („PI
required for Feature") — 83 der 425 Features haben keins, der Backlog ist ein
gewollter Zustand; **I5** („Sprint required for Story") — die Spalte existiert
nicht mehr.

Bemerkenswert: die **Lesefläche** war längst vorbereitet.
`work/domain/feature-breakdown.ts` kommentiert `parentId: string | null` mit
„`null` = Orphan-Feature", der Fahrplan hat eine Sammelgruppe „Ohne Epic", und
`features-overview.ts` leitet den Wertstrom bereits aus dem ART ab. Es fehlte
der Schreibpfad, nicht die Vorstellung.

## Decision

**Ein Feature darf ohne Eltern-Epic bestehen.** Es heisst _eigenständiges
Feature_. I2 gilt fortan nur noch in einer Richtung: ein **Epic** hat kein
Elternteil; ein Feature _kann_ eins haben.

Vier Festlegungen tragen das:

1. **Der Wertstrom kommt vom ART.** `resolveInitiativeValueStreamId`
   (Core-Kernel) liefert `parent ?? own ?? art`. `Art.valueStreamId` ist NOT
   NULL — die Ableitung ist damit total, sobald ein ART an der Zeile steht. Das
   schliesst zugleich eine Lücke: ein leeres Scope-Feld gilt in `authorize.ts`
   als „alles in Reichweite", ein Feature ohne Wertstrom erfüllte also _jede_
   Wertstrom-Eingrenzung.
2. **Elternlos ist erlaubt, wo der Aufrufer es sagt.** `validateParentLevel`
   bekommt `allowOrphan`; ohne die Option bleibt es streng. Sie greift nur bei
   **leerer** `parentId` — eine angegebene, aber unauffindbare Id bleibt ein
   Fehler, sonst würde ein Tippfehler stillschweigend zu einem eigenständigen
   Feature.
3. **Kein Portfolio-Tor ohne Vorhaben.** Ein Feature braucht ein PI, um zu
   starten; die zusätzliche L3-Bedingung gilt nur mit Epic. Das Tor prüft eine
   Finanzierungsentscheidung, die es hier nicht gibt. Die Regel steht rein in
   `feature-start.ts` — vorher lag sie in einer `if (parentId)`-Klammer und war
   für den elternlosen Fall nie erreichbar.
4. **Die Zuordnung ist umkehrbar.** `setFeatureParent` ordnet zu und löst;
   vorher gab es für Features gar keinen Umhäng-Pfad.

**Es tritt neben den ART-Epic, nicht an seine Stelle.** Den kennt das Haus
bereits (`epic-class.ts`: Klasse aus den Kosten des freigegebenen Business Case
gegen ein wertstromabhängiges Limit). Die beiden beantworten verschiedene
Fragen: der ART-Epic sagt, **wer über das Geld entscheidet**; das eigenständige
Feature sagt, dass es **gar kein Vorhaben darüber gibt**.

**Ein Feature trägt seine Solution selbst** — die eigene, sonst die des Epics
(`resolveFeatureSolution`). Ohne diese Regel hätte ein eigenständiges Feature
gar keine, und genau die Zuordnung ist im SAFe-Sinn der Bezug: ein Feature wird
in eine Solution geliefert. Die Spalte `primary_solution_id` gab es bereits;
es brauchte **kein DDL**. ADR-0022 bleibt gültig — die Solution ist Core, die
Verknüpfung zwischen Arbeit und Solution bleibt Work.

## Consequences

- **Kein Schemaeingriff.** `parent_id` war nullable, `primary_solution_id`
  existierte. Geändert wurden zwei Prisma-Relationsnamen
  (`EpicPrimarySolution` → `InitiativePrimarySolution`) — ein `@relation`-Name
  erzeugt kein SQL.
- **`i2_epic_no_parent` ist aus `prisma/sql/invariants.sql` entfernt.** Die
  Datei ist ohnehin veraltet, aber diese Klausel hätte das eigenständige Feature
  ausgesperrt, wenn sie jemand in einem Jahr mit `psql -f` einspielt.
- **§6.4 der Konzeptnotiz ist korrigiert**, nicht nur ergänzt: sie behauptete
  Durchsetzungen, die es nicht gibt.
- **Geld:** ein eigenständiges Feature bekommt **keine** Zuteilung — der
  Budget-Schnappschuss verteilt genau das. Es geht aber in den **€-Satz je
  Job-Size-Punkt** des ARTs ein, weil das ART-Budget alles finanziert, was das
  ART tut. Der Satz bleibt ohne Vorbehalt; der eigenständige Anteil steht als
  **Herkunft** daneben.
- **Sichtbarkeit:** oberhalb des ARTs unsichtbar, mit einer Ausnahme —
  „Features fällig". Dort zählt es in der Klassen-Facette als `"art"`, weil eine
  fehlende Klasse dort als `"portfolio"` gilt: für ein Epic vor L3.1 richtig,
  für ART-eigene Arbeit genau verkehrt herum.
- **Zählungen je Epic** (Tor-Reife, Feature-Zahl am Epic) schliessen
  eigenständige Features aus — richtig, sie gehören zu keinem. Wer ein Feature
  aus einem Epic löst, senkt dessen Tor-Reife; die Abnahme ist namentlich
  (ADR-0018), es entscheidet also ein Mensch mit Blick auf die Liste.
- **Der ART-Scope gilt jetzt auch im Code.** `feature.create`/`feature.update`
  tragen `scope: "art"` für RTE und Feature Owner — so, wie
  `role-function-matrix.md` es seit Monaten beschreibt. Der Portfolio Manager
  bleibt unbeschränkt.
- **Offen geblieben:** `PATCH /api/v1/features/[id]` prüft weiterhin keinen
  ART-Scope (`resource` trägt nur den Mandanten) und `updateFeature` hat keinen
  `loadAndAuthorize`-Seam. Genau deshalb sind Solution- und Epic-Zuordnung
  eigene Services mit eigener Prüfung. Eigener Zug.
