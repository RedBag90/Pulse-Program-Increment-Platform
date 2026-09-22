# Ein gelebter Prozess — eine Idee wird ein Vorhaben

Der Weg vom Einfall bis zum Epic mit benanntem Owner, dreimal erzählt: aus Sicht
des **Einreichers**, der eine Idee hat, des **Portfolio Managers**, der sie
sichtet, und des **Epic Owners**, der sie tragfähig macht. Mit den Namen, die
Pulse tatsächlich verwendet: Funnel, Erstsichtung, Erwartete Einordnung,
Benefit-Hypothese.

Dieses Dokument endet dort, wo [Epic](epic-lifecycle-walkthrough.md) beginnt:
bei einem Epic mit Owner, das auf L1 zuläuft. Es wiederholt den Reifegrad-Lauf
nicht, sondern führt zu ihm hin.

Elf Dokumente beschreiben die Abläufe von Pulse und verweisen aufeinander:
[Mandant](tenant-onboarding-walkthrough.md) — wer hereinkommt und was er darf ·
[Aufbau](portfolio-setup-walkthrough.md) — woraus alles besteht ·
[Intake](epic-intake-walkthrough.md) — wie eine Idee hereinkommt ·
[Halbjahr](portfolio-cycle-walkthrough.md) — wie der Takt schlägt ·
[Epic](epic-lifecycle-walkthrough.md) — was gebaut wird ·
[Budget](budgeting-walkthrough.md) — womit ·
[ART-Budget](art-epic-budget-walkthrough.md) — womit, wenn es klein ist ·
[PI](pi-walkthrough.md) — wann geliefert wird ·
[Lieferung](delivery-walkthrough.md) — was liefert und was blockiert ·
[Wirkung](benefit-walkthrough.md) — ob es etwas gebracht hat ·
[Risiko](risk-walkthrough.md) — was dazwischenkommt. Den Rahmen, in dem sie
stattfinden, führt [Struktur](structure-walkthrough.md) vor.

## Die gemeinsame Mechanik

### Zwei Spalten, ein Reifegrad

Das Portfolio-Kanban hat sechs Spalten. Die ersten beiden sind der Gegenstand
dieses Dokuments — und sie sind eine Besonderheit:

| Spalte            | Reifegrad | Was dort passiert                                    |
| ----------------- | --------- | ---------------------------------------------------- |
| **Funnel**        | L0        | die Idee ist erfasst und wartet auf Sichtung         |
| **Hypothese**     | **L0**    | ein Owner ist benannt und arbeitet die Hypothese aus |
| **Business Case** | L2        |                                                      |
| **Investition**   | L3        |                                                      |
| **Umsetzung**     | L4        |                                                      |
| **Impact**        | L5        |                                                      |

**Funnel und Hypothese tragen denselben Reifegrad.** Der Wechsel zwischen ihnen
ist kein Tor: er passiert, sobald zum ersten Mal ein Epic Owner benannt wird.
Der Stempel dafür heißt `selectedForDetailingAt`, und `processColumn()` liest
ihn — ein Epic auf L0 **mit** Stempel erscheint in der Spalte Hypothese, obwohl
sein Reifegrad L0 bleibt.

Das ist die wichtigste Aussage über diese Phase: **die Erstsichtung ist eine
Entscheidung ohne Freigabelauf.** Es gibt keinen Antrag, keine Abnehmer, keinen
Stempel L0,5 — es gibt eine Benennung, und mit ihr bewegt sich die Karte.

### Die Klasse steht hier noch nicht fest

Der Anlege-Dialog fragt nach der **Erwarteten Einordnung** — Portfolio-Epic oder
ART-Epic. Sein Hilfstext sagt in zwei Sätzen, was das ist und was nicht:

> „Eine Erwartung, keine Entscheidung. Die Klasse entsteht aus den Kosten des
> freigegebenen Business Case — weicht sie ab, fragt die Fläche vor dem Antrag
> nach."

Vor L2 hat ein Epic **gar keine Klasse**: `epicClass` ist `null`, das Abzeichen
sagt „Noch nicht eingeordnet". Erst der freigegebene Business Case liefert
Kosten, und `classifyEpic` vergleicht sie mit dem Portfolio-Limit des Wertstroms
— **darüber** Portfolio-Epic, **darunter oder gleich** ART-Epic.

### Wer die drei sind

| Wer                       | Was er tut                                                | Recht                              |
| ------------------------- | --------------------------------------------------------- | ---------------------------------- |
| **Der Einreicher**        | legt das Epic an, füllt Titel, Ort, Erwartung und Ziel    | `epic.create`                      |
| **Der Portfolio Manager** | sichtet, korrigiert die Zuordnung, benennt den Epic Owner | `epic.update`, `epic.owner.assign` |
| **Der Epic Owner**        | arbeitet die Benefit-Hypothese aus, bittet um Hilfe       | Eigentümerschaft am Epic           |

> **„Ein Mitarbeiter mit einer Idee" ist im Rechtemodell nicht vorgesehen.**
> `epic.create` tragen nur `portfolio_manager`, `epic_owner` und — auf seinen
> eigenen Wertstrom beschränkt — `value_stream_owner`. Ein Feature Owner, ein
> RTE oder ein Viewer kann **kein** Epic anlegen. Wer Ideen wirklich aus der
> Breite der Organisation einsammeln will, braucht dafür heute einen Weg
> außerhalb von Pulse — oder gibt den Einreichern die Rolle `epic_owner`.

---

# 1 · Der Einreicher

Meine Frage lautet: **wie bringe ich meine Idee ins Portfolio?**

## Das Epic anlegen

Ich habe eine Idee, wie sich zu einem der Ziele beitragen lässt. Über das
globale **„+"** wähle ich in der Gruppe _Initiative_ den Eintrag **Epic**; auf
der Epic-Liste heißt derselbe Weg **„Neues Epic"**. Es öffnet sich der Dialog
**„Epic anlegen"**.

| Feld                     | Pflicht | Anmerkung                                                      |
| ------------------------ | ------- | -------------------------------------------------------------- |
| **Titel**                | ja      |                                                                |
| **Wertstrom**            | ja      | „Wertstrom wählen…"                                            |
| **ART**                  | ja      | kaskadiert — „Zuerst Wertstrom wählen…", dann „ART wählen…"    |
| **Primär-Solution**      | nein    | „— später zuordnen —"                                          |
| **Erwartete Einordnung** | ja      | „Portfolio-Epic — über 100.000 €" / „ART-Epic — bis 100.000 €" |
| **Unterstütztes Ziel**   | nein    | der Ziel-Baum; hier hängt die Idee an der Strategie            |
| **Beschreibung**         | nein    | ein Textfeld — es heißt nicht „Kurzbeschreibung"               |

Zwei Dinge, die man beim ersten Mal falsch erwartet:

- **Es gibt kein Feld für eine geschätzte Größe.** Was danach aussieht, ist die
  _Erwartete Einordnung_ — und die fragt nicht nach einer Zahl, sondern nach
  einer Seite der Grenze. Der Grenzwert im Optionstext ist das Portfolio-Limit
  **des gewählten Wertstroms**; er ändert sich, wenn ich den Wertstrom wechsle.
- **Der ART ist Pflicht, die Solution nicht.** Wer noch nicht weiß, zu welchem
  Produkt die Idee gehört, lässt das Feld auf „— später zuordnen —" stehen.

Mit **„Anlegen"** ist die Idee eingereicht. Sie steht jetzt im **Funnel**, auf
Reifegrad **L0**, ohne Owner — und wartet.

> Ein Epic ohne Primär-Solution hat zunächst **keinen Horizont**: der wird aus
> der Solution abgeleitet, solange am Epic selbst keiner gesetzt ist. Im
> Trichter landet es in der Bahn „Ohne" und zählt in keiner Horizont-Quote mit.
> Das ist kein Fehler, sondern die Auskunft — aber es lohnt, sie zu kennen.

---

# 2 · Der Portfolio Manager

Meine Frage lautet: **ist das eine Sache, und wer treibt sie?**

## Die Erstsichtung

Meine Aufgabe ist es sicherzustellen, dass die Epics, die auf dem Board landen,
nachvollziehbar sind und eine angemessene Qualität haben. Ich gehe die
eingereichten Epics durch und frage in dieser Reihenfolge:

1. **Ergibt die Idee Sinn?**
2. **Stimmen Wertstrom, ART und Solution?** Sie zu korrigieren ist billig,
   solange nichts daran hängt — später hängt daran das Geld: der Wertstrom
   bestimmt das Portfolio-Limit und damit die Klasse, und er bestimmt, wer die
   Reifegrad-Tore zeichnet.
3. **Wer arbeitet die Hypothese aus?**

Die dritte Frage ist der eigentliche Akt. Der Meilenstein heißt
**„Erstsichtung"**, und die Fläche beschreibt ihn in einem Satz: _Der VMO sichtet
das Epic und benennt den Epic Owner._

Die Steuerung sitzt im Reiter **„Overview"**, im Panel **„Zuordnung"** ganz oben
unter **„Owner"**. Ein Klick auf den Namen öffnet die Personenauswahl; die
Auswahl speichert sofort, ein Haken bestätigt es, **„— Niemand —"** entfernt die
Benennung wieder. Ist niemand benannt, steht dort „Benennen".

Das ist dieselbe Bedienung wie in der [Rollenverteilung](../../src/modules/core/org/features/structure/components/role-slot.tsx)
unter `/structure/rollen` — ein Platz, ein Klick, sofort gespeichert. Vorher
standen hier Picker und ein Knopf dauerhaft untereinander, und der Knopf war
meistens ausgegraut, weil die Auswahl schon stimmte.

> **Sie sass bis September 2026 an zwei Stellen.** Die ältere war der Reiter
> „Reifegrad-Timeline", aufklappbar am Meilenstein Erstsichtung. Das
> Tor-Kriterium „Epic Owner ist benannt" verlinkte aber immer schon ins Overview
> und rät dort: _„Benenne ihn im Overview über das Owner-Feld."_ Inzwischen
> stimmt das — die Timeline hat die Zuweisung abgegeben und zeigt den
> Meilenstein nur noch an.

**Mit der ersten Benennung wandert die Karte** von _Funnel_ nach _Hypothese_.
Der Reifegrad bleibt L0; was sich ändert, ist der Stempel
`selectedForDetailingAt`. Ab hier läuft der normale Prozess, und der steht in
[Epic](epic-lifecycle-walkthrough.md).

## Was die Benennung sonst noch tut

Der Epic Owner ist Kriterium in **zwei** Toren: für L1 und für L2 steht „Epic
Owner ist benannt" in der Liste — beide Male **nicht blockierend**. Ein Epic
kommt also auch ohne Owner durch, wenn die Abnehmer es so wollen. Die Fläche
sagt es an, statt es zu erzwingen.

Blockierend ist an dieser Stelle etwas anderes: **„Benefit-Hypothese ist
ausgearbeitet"**. Und deren Freigabe ist kein eigener Lauf — sie geschieht mit
der Abnahme des Schritts auf L1.

---

# 3 · Der Epic Owner

Meine Frage lautet: **wie komme ich von der Idee zu etwas Tragfähigem?**

## Wenn ich nicht weiterkomme

Manchmal brauche ich Unterstützung bei der Vorbereitung meines Epics. Dafür gibt
es einen Haken auf der Reifegrad-Karte — mit einem Rettungsring-Symbol und dem
Text **„I need help"**. Der einzige englische Text auf dieser Fläche.

Kreuze ich ihn an, bestätigt die Fläche in einem Satz, was passiert: _„VMO und
Portfolio-Management sehen dieses Epic jetzt in ‚Meine Tasks'."_ Der Stempel
heißt `helpRequestedAt`.

**Ankreuzen darf nur ich selbst.** Die Steuerung erscheint ausschließlich, wenn
ich als Owner eingetragen und zugleich der angemeldete Nutzer bin — ein Dritter
kann für mich nicht um Hilfe bitten.

Auf der anderen Seite, unter `/my-tasks` (**„Meine Tasks"**), steht dann der
Abschnitt **„Unterstützung angefragt"** mit der Zeile
_🆘 {Titel} braucht Unterstützung — Owner: {Name}_ und der Schaltfläche
**„Zum Epic →"**. Wer ihn sieht, ist genau geregelt:

- wer die Rolle `portfolio_manager` trägt, sieht **alle** offenen Bitten des
  Mandanten;
- alle anderen sehen nur die Epics der Wertströme, deren Portfolio Manager sie
  sind (`ValueStream.vmoId`).

Womit sich zeigt, warum die Besetzung aus dem [Aufbau](portfolio-setup-walkthrough.md)
zählt: **ein Wertstrom ohne benannten Portfolio Manager hat für diese Bitten
keinen Empfänger** außer den Portfolio Managern des ganzen Mandanten.

## Wenn der Business Case zu groß für die Idee ist

Der schwierigste Fall in dieser Phase ist nicht ein fehlender Owner, sondern
eine Idee, deren **Umfang noch niemand kennt**. Ich weiß nicht, wie groß sie
ist, nicht, was hineingehört, und einen belastbaren Lean Business Case zu
schreiben hieße, Zahlen zu erfinden.

Die Antwort darauf ist **kein kleinerer Business Case, sondern ein kleineres
Vorhaben**: ein **R&D-Epic** im Horizont H3.

| Horizont           | Was das Epic will                            | Was danach vorliegt                          |
| ------------------ | -------------------------------------------- | -------------------------------------------- |
| **H3 · R&D**       | Informationen sammeln — eine Discovery-Phase | genug, um einen Piloten zu begründen         |
| **H2 · Emerging**  | Pilot oder MVP bauen                         | genug, um die Weiterentwicklung zu begründen |
| **H1 · Investing** | die eigentliche Entwicklung                  | das Produkt                                  |

**Für ein R&D-Epic darf der Lean Business Case rudimentär bleiben** — mit
ausreichender Zustimmung der Abnehmer. Das ist keine Nachlässigkeit, sondern die
Konsequenz aus seinem Ziel: **es soll nicht das Produkt liefern, sondern das
Wissen, das den nächsten Business Case erst möglich macht.**

Nach jedem Schritt entsteht ein **neues Epic**, kein umetikettiertes altes. Das
hat einen fachlichen und einen mechanischen Grund:

- **Fachlich** ist jede Stufe eine eigene Investitionsentscheidung mit eigenem
  Business Case, eigenem Budget und eigenen Abnehmern. Ein Pilot ist nicht die
  Fortsetzung der Discovery, sondern ihre Folge.
- **Mechanisch** friert der Horizont eines Epics mit der Business-Case-Freigabe
  ein. `epicHorizon` liefert `frozen: true`, sobald ein eigener Wert am Epic
  steht **und** L2 gestempelt ist; danach sagt `horizonEditDeniedReason`:
  _„Der Horizont ist mit der Business-Case-Freigabe eingefroren. Ihn nachträglich
  zu ändern ist dem Portfolio-Management vorbehalten (Capability
  `epic.portfolio_override`)."_

Der zweite Grund ist zugleich der Schutz, der die Kaskade überhaupt sinnvoll
macht: **wanderte ein Epic mit, würde die Geschichte rückwirkend
umgeschrieben.** Die gemessene Portfolio-Balance vergangener Halbjahre hinge dann
davon ab, wo ein Vorhaben heute steht. Drei Epics in drei Horizonten sind drei
Belege; ein Epic, das dreimal die Bahn wechselt, ist keiner.

> **Der Horizont eines Epics ist vor L2 frei.** Wer ihn am Epic selbst setzt,
> übersteuert damit den der Primär-Solution — explizit schlägt abgeleitet. Genau
> das braucht ein R&D-Epic, das an einer bereits laufenden Solution hängt: die
> Solution steht in H1, das Vorhaben ist Discovery.

## Vormerken ist nicht beantragen — aber notwendig

Zwei Häkchen am Epic sehen gleich aus und wiegen sehr verschieden.

**„Im nächsten Steering-Meeting behandeln"** ist ein reiner Merker: er wird
angezeigt und lässt sich filtern, sonst nichts. Kein Dienst liest ihn.

**„Fürs nächste Budget-Meeting vormerken" ist eine Voraussetzung.** Der Loader
der PB-Liste verlangt **beides** — `stagedForBudgeting: true` **und** einen
freigegebenen Business Case. Ohne den Haken taucht mein Epic in der
Kandidatenliste einer Budget-Runde gar nicht erst auf, egal wie reif es ist.

Was er **nicht** tut: das Epic auf die PB-Liste einer laufenden Kachel setzen.
Das bleibt ein Akt des Portfolio Managers — er nimmt es im Setup der Kachel über
**„+ auf die PB-Liste"** auf. Zwei Schritte, zwei Personen: **ich melde mein
Vorhaben an, das Portfolio nimmt es zur Wahl.** Wie es dort weitergeht, steht in
[Halbjahr](portfolio-cycle-walkthrough.md) und [Budget](budgeting-walkthrough.md).

---

## Die Nähte

**Zum Aufbau.** Wertstrom und ART sind im Anlege-Dialog Pflicht — beide müssen
also existieren, bevor die erste Idee erfasst werden kann. Das Portfolio-Limit
des Wertstroms steht schon im Optionstext der Erwarteten Einordnung.

**Zum Epic.** Dieses Dokument endet an der Benennung des Owners. Was danach
kommt — Hypothese, Analyse, Business Case, Investitionsentscheidung —, ist der
Gegenstand von [Epic](epic-lifecycle-walkthrough.md).

**Zum Ziel.** Das Feld „Unterstütztes Ziel" ist die einzige Stelle im
Anlege-Dialog, an der die Idee an die Strategie andockt. Wird es leer gelassen,
trägt das Epic später nichts zu einem Kopfziel bei, bis jemand die Verknüpfung
nachzieht.

## Sätze, die naheliegen und nicht stimmen

| Satz                                             | Warum er nicht stimmt                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| „Jeder Mitarbeiter kann ein Epic einreichen."    | `epic.create` tragen nur Portfolio Manager, Epic Owner und der Wertstrom-Owner seines Stroms.                           |
| „Im Dialog schätze ich die Größe."               | Es gibt keine Zahl — nur die **Seite** der Grenze: Portfolio-Epic oder ART-Epic.                                        |
| „Die Erwartete Einordnung legt die Klasse fest." | Sie ist eine Erwartung. Die Klasse entsteht aus den Kosten des freigegebenen Business Case.                             |
| „Die Erstsichtung ist ein Reifegrad-Schritt."    | Sie ist eine Benennung. Der Reifegrad bleibt L0, nur die Kanban-Spalte wechselt.                                        |
| „Ohne Owner geht es nicht weiter."               | „Epic Owner ist benannt" ist in L1 und L2 **nicht** blockierend.                                                        |
| „Die Karten zieht man im Kanban."                | Das Kanban ist **lesend**. Bewegt wird über die Reifegrad-Karte des Epics.                                              |
| „Ich hake ‚I need help' für meinen Kollegen an." | Der Haken erscheint nur beim Owner selbst.                                                                              |
| „Die zwei Merker sind beide bloße Filter."       | Der Steering-Merker ja. Der Budget-Merker ist **Voraussetzung**: ohne ihn erscheint das Epic in keiner Kandidatenliste. |
| „Aus dem R&D-Epic wird später das Pilot-Epic."   | Es entstehen **neue** Epics. Der Horizont friert mit der Business-Case-Freigabe ein.                                    |

## Wer welchen Schritt macht

| Schritt                                | Wer                                                                  | Recht                          |
| -------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| Epic anlegen                           | Portfolio Manager, Epic Owner; Wertstrom-Owner in seinem Strom       | `epic.create`                  |
| Wertstrom / ART / Solution korrigieren | dieselben                                                            | `epic.update`                  |
| Epic Owner benennen                    | Portfolio Manager; Wertstrom-Owner in seinem Strom                   | `epic.owner.assign`            |
| Horizont am Epic setzen (vor L2)       | wer das Epic bearbeiten darf                                         | `epic.update`                  |
| Horizont nach der BC-Freigabe ändern   | Portfolio-Management                                                 | `epic.portfolio_override`      |
| „I need help" setzen                   | **nur der Owner selbst**                                             | Eigentümerschaft               |
| Die Bitten in „Meine Tasks" sehen      | Portfolio Manager (alle); sonst der Portfolio Manager des Wertstroms | Rolle bzw. `ValueStream.vmoId` |
| Epic löschen                           | Portfolio Manager / Admin                                            | `epic.delete`                  |

## Nachschlagepunkte im Code

| Aussage                                          | Quelle                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Der Anlege-Dialog und seine Felder               | `src/modules/work/features/portfolio/components/create-epic-dialog.tsx`         |
| Die Optionstexte der Erwarteten Einordnung       | `src/modules/work/features/portfolio/components/intended-class-options.ts`      |
| Die Einordnung selbst (Kosten gegen Limit)       | `src/modules/work/domain/pb-submission.ts` (`classifyEpic`)                     |
| Abweichung Erwartung ↔ Ableitung                 | `src/modules/work/domain/pb-submission.ts` (`classificationDrift`)              |
| Funnel → Hypothese ohne Reifegrad-Wechsel        | `src/modules/work/features/portfolio/lib/epic-lifecycle.ts` (`processColumn`)   |
| Die acht Prozessabschnitte samt Meilensteinen    | `src/modules/work/features/portfolio/lib/epic-lifecycle.ts` (`LIFECYCLE_STEPS`) |
| Spaltennamen des Kanbans                         | `src/components/detail/initiative-labels.ts` (`STAGE_SHORT`)                    |
| Kriterien je Tor, blockierend oder nicht         | `src/modules/work/domain/gate-readiness.ts` (`GATE_CRITERIA`)                   |
| Owner benennen                                   | `src/modules/work/features/portfolio/components/epic-owner-assign.tsx`          |
| „I need help" — Steuerung und Sichtbarkeit       | `src/modules/work/features/portfolio/components/gate/epic-gate-card.tsx`        |
| Wer die Steuerung überhaupt sieht                | `src/modules/work/server/views/epic-detail.ts` (`canRequestHelp`)               |
| Empfänger der Bitten                             | `src/modules/work/server/services/my-help-requests.ts`                          |
| Der Abschnitt in „Meine Tasks"                   | `src/modules/work/features/my-tasks/components/help-requests-section.tsx`       |
| Horizont eines Epics, Einfrieren, Übersteuern    | `src/modules/work/domain/epic-horizon.ts`                                       |
| Die zwei Merker und ihre Beschriftung            | `src/modules/work/features/portfolio/components/epic-governance-flags.tsx`      |
| Der Merker als Voraussetzung der Kandidatenliste | `src/modules/budgeting/server/services/pb-list.ts`                              |
| Aufnahme auf die PB-Liste (erst ab L2)           | `src/modules/work/domain/pb-submission.ts` (`isPbEligible`)                     |
| Was welche Rolle darf                            | `src/server/auth/policies/index.ts`                                             |
