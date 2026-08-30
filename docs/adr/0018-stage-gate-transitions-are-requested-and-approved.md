# ADR-0018: Reifegrad-Wechsel sind beantragte, namentlich abgenommene Transitionen

- Status: accepted
- Date: 2026-08-16

## Context

Das Durchreichen eines Epics durch die Reifegrade L0–L5 lief über **drei
unvereinbare Mechaniken auf derselben Spalte**:

1. **Inhaltliche Trigger.** Fünf Services (`epic.ts`, `epic-approval.ts`,
   `feature.ts`, `budgeting.ts`) riefen `signalGateTrigger` und schrieben damit
   einen _Vorschlag_ in `Initiative.proposedStageGate`. Zwei davon waren
   Cross-Modul-Schreibkopplungen (Drumbeat → Work, Budgeting → Work).
2. **Ein Auto-Advance.** `hypothesis_approved` schob L0→L1 sofort, ohne
   Bestätigung — die eine dokumentierte Ausnahme.
3. **Ein manueller Pfad.** `advanceGateManually`, bei dem aber ausgerechnet die
   beiden wichtigsten Übergänge (L2→L3 Investitionsentscheidung, L4→L5 Impact)
   **verboten** waren: sie standen in `BLOCKED_MANUAL_TRANSITIONS` und waren nur
   per Trigger erreichbar.

Daraus folgten konkrete Defekte:

- **Keine namentliche Abnahme.** Alle Wechsel hingen an der einen, ungescopten
  Capability `epic.approve` = `portfolio_manager`.
- **Doku und Code widersprachen sich.** CONTEXT.md sagte „der Epic-Owner
  bestätigt"; der Confirm war auf `epic.approve` gegated — der Epic-Owner konnte
  seinen eigenen Vorschlag _nicht_ bestätigen.
- **Vorschläge waren unsichtbar.** `suggest` wurde bewusst nicht auditiert, es
  gab genau _einen_ Slot pro Epic und **keine Möglichkeit, einen Vorschlag zu
  verwerfen**.
- **Rückwärts-Wechsel räumten nichts auf.** `approvedAt` / `impactRecognizedAt`
  sind set-once und wurden beim Zurückstufen nie geleert — ein erneutes
  Vorrücken stempelte danach nie wieder.
- **Drei parallele Ableitungen** von „wo steht dieses Epic": `stageGate`,
  `epicBucket()` (wich in zwei Fällen bewusst ab) und `epicLifecycleSteps()`.
- **Vier bespoke UI-Affordanzen** für einen Vorgang, eine davon mit einer
  client-seitigen Kopie der Übergangsregeln.

Die fachliche Anforderung lautet: **die Wechsel in den Reifegraden sind durch
spezifische Personen abzunehmen; damit ist der Push ein manueller Akt.**

## Decision

`proposedStageGate` — ein Slot, in den fremde Module schreiben und den eine
Rolle bestätigt — wird ersetzt durch ein **erstklassiges, auditiertes
Antragsobjekt**: `StageGateTransition` (Kopf) + `StageGateApproval` (eine Zeile
je benannter Person), plus `StageGateApproverRule` (wer nimmt welches Gate ab).

Vier Festlegungen:

1. **Kein Auto-Advance, nirgends.** Ein Gate bewegt sich ausschliesslich, wenn
   jemand einen Antrag stellt und die benannten Personen ihn abnehmen. Die
   L0→L1-Ausnahme, die zwei gesperrten Übergänge und der eigene
   L4→L5-Impact-Dialog fallen alle in denselben Pfad.
2. **Readiness wird beim Lesen abgeleitet, nie geschrieben.** Was früher ein
   Trigger war, ist jetzt ein benanntes Kriterium in `GATE_CRITERIA`, ausgewertet
   gegen persistierten Zustand. Kein Slot ⇒ nichts kann veralten; die Backstops,
   die Stale-Prüfung beim Bestätigen und beide Cross-Modul-Schreibkopplungen
   entfallen ersatzlos.
3. **Abnehmer sind Personen, eingefroren beim Antrag.** Konfiguriert je Gate
   (Wertstrom-Zeile → Tenant-Default → Code-Default), aufgelöst über
   Rollen-Platzhalter, die die vorhandenen Governance-Spalten
   `ValueStream.financeApproverId` / `vmoId` ehren — dasselbe Prefill, das der
   Business Case schon nutzt. Eine spätere Konfig-Änderung deutet laufende
   Anträge nicht um.
4. **Eigene Tabellen, nicht `EpicApproval` mit `kind: "gate"`.**

### Nachtrag (2026-08-30): L4.2 ist ein eigener Schritt

Ursprünglich kannte der Apparat nur die sechs Haupt-Gates L0–L5, während die
Sub-Stage **L4.2 „Umsetzung fertig"** automatisch aus dem Feature-Zähler
abgeleitet wurde (alle Child-Features `completed` ⇒ L4.2). Das war der letzte
verbliebene Auto-Advance und widersprach Festlegung 1: „fertig gebaut" ist eine
Aussage, die jemand trifft — nicht eine, die aus einer Zählung entsteht.

Deshalb beantragt und abgenommen man L4.2 jetzt wie ein Gate. Die Leiter der
beantragbaren **Schritte** (`GATE_STEPS`) lautet `L0 · L1 · L2 · L3.1 · L3.2 · L4 ·
L4.2 · L5`; das Gate-Subsystem ist auf den Typ `GateStep` getypt. Drei Konsequenzen:

- **`Initiative.stageGate` bleibt bei „L4".** L4.2 materialisiert sich im
  Stempel `implementationCompletedAt` — der Audit-Log der Haupt-Gates bleibt
  unberührt, `currentGateStep()` setzt Spalte und Stempel zum Schritt zusammen.
- **Die Kriterien wandern eine Stufe nach unten.** „Alle Child-Features
  abgeschlossen" hängt jetzt an **L4.2** — seit 2026-08-30 allerdings als
  _beratendes_ Kriterium, nicht als Tor (s. Nachtrag unten); der L5-Antrag
  verlangt stattdessen die abgenommene Bestätigung (`implementation_confirmed`).
  L4.2 ist ausdrücklich **nicht** L5: zwischen fertiger Umsetzung und
  nachgewiesenem Impact darf beliebig viel Zeit liegen.
- **Das Ist-Datum gehört der Abnahme.** `timeline.actuals.implementation` wird
  ausschließlich beim abgenommenen Schritt L4→L4.2 geschrieben (und beim Revert
  geräumt); der Timeline-Reiter zeigt es nur an, `saveTimeline` verwirft
  eingehende Werte. Das ist die bewusste Ausnahme von „`saveTimeline` ist der
  einzige Timeline-Schreiber".

## Warum eigene Tabellen

Der Grund ist nicht Ästhetik, sondern ein verifizierter Korrektheits-Hazard:
`applyDecisionOutcome` (`services/epic-approval.ts`) liest
`epicApproval.findMany({ initiativeId, tenantId, revision })` **ohne
`kind`-Filter** und gibt das Ergebnis an `isFullyApproved`. Eine Gate-Zeile mit
derselben `revision` hätte die Business-Case-Finalisierung still blockiert.

Dazu: ein Gate-Antrag hat keine BC-Revision, sondern `fromGate`/`toGate` und
einen Kopf-Status (`pending | approved | rejected | withdrawn`) — eine Kopfzeile
bräuchte man ohnehin. Und getrennte Tabellen halten die beiden Achsen orthogonal
([ADR-0003](./0003-initiative-state-axes-stay-orthogonal.md)): der
Dokumenten-Freigabeprozess (`approvalPhase`) speist nur die _Readiness_ eines
Gates, er schiebt es nicht.

Geteilt wird nur das **Vokabular**, nicht der Zustand: `approval-primitives.ts`
(`assertAssignedApprover`, `rollup`, `quorumReached`) wird von beiden Achsen
importiert.

## Consequences

- **Zwei Cross-Modul-Schreibkopplungen verschwinden** — nicht über Events
  umgeleitet, sondern **gelöscht**. Siehe die Konsequenznotiz in
  [ADR-0015](./0015-cross-module-write-through-via-events.md).
- **Vorschläge sind sichtbar.** Antrag, jede einzelne Abnahme, Ablehnung,
  Rückzug und Rückstufung sind je eine Audit-Zeile, alle auf
  `resourceType: "initiative"` + Epic-ID, damit die Activity-Sidebar sie ohne
  Zusatzarbeit aufnimmt.
- **Eine Mutation ⇒ genau eine Audit-Zeile.** Der frühere
  `emitAudit: false`-Kunstgriff, mit dem sich zwei Schreiber eine Audit-Zeile
  teilten, entfällt, weil es keinen Fire-and-Forget-Schreiber mehr gibt.
- **Rückstufungen räumen auf.** `unwindStampsFor` leert je Paar genau die
  Stempel des verlassenen Gates; ein erneutes Vorrücken stempelt wieder.
- **Bessere Zuordnung.** `approvedBy` / `impactRecognizedBy` tragen den
  _entscheidenden Abnehmer_ statt „wer den Trigger ausgelöst hat".
- **Das Board zeigt die Wahrheit.** `epicBucket()` und seine zwei
  Abweichungsregeln sind entfallen; stattdessen trägt eine Karte den Chip
  „⇧ L3 · 1/2", wenn ein Wechsel auf Abnahme wartet.
- **Weniger UI-Oberfläche.** Vorschlags-Banner, Impact-Dialog, zwei fest
  verdrahtete Timeline-Buttons und die Stage-↑/↓-Arme der Bulk-Leiste kollabieren
  zu einer Gate-Karte. Bulk-Wechsel entfallen bewusst: sie träfen je Epic andere
  Abnehmer, andere Kriterien und andere offene Anträge.
- **Zurückgezogene Capabilities:** `epic.approve` und `epic.impact.confirm`;
  neu sind `epic.gate.request | decide | withdraw | revert | approvers.configure`.
  Weil `resolveCapabilities` nur bei _null_ `role_capabilities`-Zeilen auf
  `POLICIES` zurückfällt, ist der Backfill
  (`prisma/scripts/2026-08-16-gate-transition-backfill.ts`) **zwingend**, nicht
  optional.
- **Trade-off: mehr Reibung im Alltag.** Was früher beim Speichern eines
  Business Case oder beim Start eines Features von selbst passierte, verlangt
  jetzt einen Antrag und mindestens eine Abnahme. Das ist der Preis der
  Anforderung und ausdrücklich gewollt — für leichtgewichtige Gates kann eine
  Regel `required: false` tragen (der Antrag rückt dann sofort vor, bleibt aber
  ein manueller, auditierter Akt).
- **Trade-off: eine Konfigurationsebene mehr.** Ohne hinterlegte Abnehmer ist
  ein abnahmepflichtiges Gate nicht beantragbar. Der Service scheitert dafür
  **laut** mit einem Verweis auf die Wertstrom-Konfiguration, statt einen Antrag
  anzulegen, auf den niemand antworten kann; der Backfill seedet Tenant-Defaults.

## Alternatives considered

- **`EpicApproval` um `kind: "gate"` erweitern** — verworfen wegen des
  `applyDecisionOutcome`-Hazards und weil der Revisions-Schlüssel nicht passt.
- **Die BC-Freigabe zur L2→L3-Abnahme machen (ein Prozess statt zwei)** —
  verworfen: ADR-0003 müsste ersetzt werden, und die Rückrichtung (BC-Freigabe
  legt automatisch den Antrag an) führte genau den impliziten Akt wieder ein, den
  die Anforderung ausschliesst. Die Verschmelzungsnaht bleibt bewusst eine Zeile:
  `GATE_CRITERIA["L3"]` enthält bereits `businessCaseApprovedAt != null`.
- **Trigger beibehalten, nur den Confirm auf Personen umstellen** — verworfen:
  der Slot (und damit Veraltung, Backstops, Cross-Modul-Schreiben, die fehlende
  Verwerfen-Möglichkeit) wäre geblieben.

### Nachtrag (2026-08-30): L3.2 ist ein eigener Schritt

Der Reifegrad L3 hiess „Budget alloziert" und wurde erreicht, sobald Business
Case **und** Budget standen. Damit fielen zwei Aussagen in einen Übergang: „wir
haben einen tragfähigen Business Case" und „wir geben Geld dafür aus".

Die Leiter ist deshalb neu geschnitten. Was frueher die Sub-Stages L2.1/L2.2
waren, ist jetzt:

| frueher               | jetzt               | Bedeutung                 |
| --------------------- | ------------------- | ------------------------- |
| L2 mit Sub-Stage L2.1 | **L2** (ohne Split) | Business Case in Arbeit   |
| L2.2                  | **L3.1**            | Business Case freigegeben |
| L3                    | **L3.2**            | Budget alloziert          |

**L3.2 wird beantragt und abgenommen** — genau wie L4.2 und aus demselben Grund
(Festlegung 1: kein Auto-Advance). Waere die Investitionsentscheidung eine
abgeleitete Folge der Budgetzuteilung, entstuende sie wieder aus einer Zahl statt
aus einer Unterschrift. Drei Konsequenzen:

- **`Initiative.stageGate` bleibt bei „L3".** L3.2 materialisiert sich im Stempel
  `approvedAt`; `subStageFor` liest ihn zurueck, `currentGateStep` setzt Spalte
  und Stempel zum Schritt zusammen.
- **Die Kriterien teilen sich.** Der Eintritt L3.1 verlangt nur noch die
  BC-Freigabe; `budget_allocated` haengt an L3.2.
- **`isApprovalTransition` ist schrittbasiert.** Sie feuert bei L3.1 → L3.2 und
  traegt dort `approvedBy`/`approvedAt`/`approvalComment`; `unwindStampsFor`
  raeumt sie beim Zurueckstufen L3.2 → L3.1 ab. Der Eintritt L3.1 traegt keinen
  eigenen Stempel.

Bestandsdaten wandern per `prisma/scripts/2026-08-30-stage-gate-l2-to-l3-recut.ts`:
Epics auf L2 mit `businessCaseApprovedAt` stehen danach auf L3 (= L3.1).

### Nachtrag (2026-08-30): das L4.2-Kriterium ist beratend

„Alle Child-Features sind abgeschlossen" blockierte den L4.2-Antrag. Das stellte
den Feature-Zähler faktisch wieder vor die Abnahme: wer die Umsetzung für fertig
hielt, kam nicht durch, solange irgendein Feature offen stand — und sei es eines,
das bewusst offen bleibt. Damit entschied doch wieder eine Zählung, was
Festlegung 1 gerade der abnehmenden Person zugewiesen hatte.

Das Kriterium bleibt sichtbar, wird aber **beratend** (`blocking: false`), wie
`feature_started` bei L4. Der Antrag ist der bewusste Akt; der Zähler ist der
Anhaltspunkt, auf den die Abnahme schaut.

**Hart bleibt `implementation_confirmed` bei L5.** Man kann die Umsetzung also
früher für fertig erklären, aber den Impact weiterhin nicht ohne bestätigtes
L4.2 melden — die Trennung „fertig gebaut" ≠ „Nutzen nachgewiesen" ist davon
unberührt.

### Nachtrag (2026-08-30): L0 → L1 trägt die Hypothesen-Freigabe

Vor L1 standen zwei Freigaben hintereinander, die dasselbe aussagten: der
Hypothesen-Lauf (`submitHypothesis` / `decideHypothesis` auf der
Mehrparteien-Achse, entschieden vom Portfolio Manager) und danach der
Reifegrad-Antrag L0 → L1, abgenommen vom VMO. Zwei Anträge, zwei Abnahmen, eine
Aussage — und die zweite konnte die erste nur bestätigen.

**Der Reifegrad-Schritt trägt sie jetzt selbst.** Die Abnahme von L0 → L1
stempelt `hypothesisApprovedAt` (set-once, wie `approvedAt` bei L3.2), setzt
`needsSteeringAttention` und schiebt die Phase auf `business_case`. Der Revert
L1 → L0 räumt beides wieder ab. Der eigene Freigabelauf entfällt samt seinen
Capabilities, Actions und dem Posteingang-Arm.

Zwei Folgen sind bewusst in Kauf genommen:

- **Das L1-Kriterium wechselt die Aussage.** Es kann nicht mehr den Stempel
  verlangen, den es selbst setzt — das wäre zirkulär. Aus `HYPOTHESIS_READY`
  werden zwei benannte Regeln: **→ L1** verlangt Inhalt
  (`HYPOTHESIS_DRAFTED`, blockierend), **→ L2** weiterhin den Stempel
  (`HYPOTHESIS_APPROVED`).
- **Die Rückfrage fällt weg.** Der Hypothesen-Lauf kannte ein drittes Votum
  („Rückfrage"); die Gate-Achse kennt zustimmen und ablehnen, beides mit
  Kommentar. Wer nachfragen will, lehnt begründet ab — das Epic bleibt auf L0,
  der Text wird wieder editierbar, der Antrag kann neu gestellt werden.

**Die Textsperre folgt jetzt dem Antrag,** nicht mehr der Phase: die Hypothese
ist editierbar, solange das Epic auf L0 steht und kein Antrag offen ist. Ab dem
gestellten Antrag ist sie gesperrt — die Abnehmer sollen nicht auf etwas
schauen, das sich unter ihnen ändert — und ab L1 ebenfalls.

### Nachtrag (2026-08-30): L2 → L3.1 trägt die Business-Case-Freigabe

Dieselbe Bewegung wie bei L1, eine Stufe größer. Vor L3.1 standen der
Business-Case-Lauf über fünf Parteien und danach der Reifegrad-Antrag,
abgenommen vom VMO — zwei Vorgänge, eine Aussage.

**Der Reifegrad-Schritt trägt sie jetzt selbst, und die fünf Parteien sind seine
Abnehmer.** `DEFAULT_GATE_POLICIES["L3.1"]` besetzt MGMT, Business Owner,
Finance, IRT-Owner und LACE/VMO, Quorum weiterhin einstimmig; die Abnahme
stempelt `businessCaseApprovedAt` und setzt `needsSteeringAttention`, der Revert
L3.1 → L2 räumt beides ab. Das Kriterium an → L3.1 fragt seither den _Inhalt_
(`business_case_drafted`), nicht den Stempel.

Drei Details, die den Umbau tragen:

- **Die Rolle wandert mit.** `GATE_APPROVER_ROLES` kennt fünf neue Platzhalter
  (`epic.party.mgmt`, `…business_owner`, `…finance`, `…irt_owner`,
  `…lace_vmo`), und sie landen auf `StageGateApproval.role`. Ohne das stünde auf
  der Abnahme-Zeile hinterher zwar eine Person, aber nicht mehr, für welche
  Partei sie gezeichnet hat — und Guardrail 4 (Business-Owner-Engagement)
  verlöre seine Datenbasis.
- **Zwei Parteien lösen aus dem Wertstrom auf, drei nicht.** Finance und
  LACE/VMO ziehen die vorhandenen Governance-Spalten (`financeApproverId`,
  `vmoId`). Für MGMT, Business Owner und IRT-Owner gibt es keine solche Spalte —
  und das ist richtig so: wer dafür steht, ist eine Eigenschaft des _Epics_.
  Deshalb erlaubt `allowsAdHocApprovers` genau an L3.1 eine Besetzung am Antrag.
  Der frühere Approver-Dialog des Business Case lebt dort als Picker weiter.
- **Der Posteingang hat nur noch einen Arm.** `/my-approvals` führte einmal
  Feature-QS, Hypothese, Parteien und Reifegrad; übrig ist die Reifegrad-Abnahme.
  Die Partei, für die man zeichnet, steht als Kontext an der Zeile.

Guardrail 4 zieht mit: Scope sind seither Epics mit einem L2 → L3.1-Antrag,
Zeilen die `epic.party.business_owner`-Abnahmen seines **jüngsten** Antrags. Der
frühere Revisions-Schnitt hatte dieselbe Aufgabe — ein neuer Lauf ist jetzt ein
neuer Antrag.

## Offene Punkte

- **Benachrichtigung.** Ein benannter Abnehmer erfährt heute über den
  Pull-Posteingang `/my-approvals` von seiner Aufgabe. Ein Push per E-Mail wäre
  ein `DomainEvent` + `OUTBOX_ROUTES`-Eintrag auf der vorhandenen Outbox-Schiene
  — bewusst nicht in diesem Umbau.
- **Integrationstests laufen in keiner Umgebung.** Weder lokal
  (`DATABASE_URL_TEST` unbesetzt) noch in CI (`ci.yml` fährt nur
  `pnpm test:coverage`). `stage-gate-transition.integration.test.ts` und die
  Negativ-Kontrakte sind geschrieben, aber **unverifiziert**, bis jemand
  `supabase start && pnpm test:integration` fährt. Das ist ein Bestandsproblem,
  kein neues — es hatte zuvor schon dazu geführt, dass
  `epic.integration.test.ts` Erfolg auf einem Aufruf behauptete, der mit den
  Test-Capabilities gar nicht hätte durchgehen dürfen.
