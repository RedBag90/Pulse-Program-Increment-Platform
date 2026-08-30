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
beantragbaren **Schritte** (`GATE_STEPS`) lautet `L0 · L1 · L2 · L3 · L4 · L4.2 ·
L5`; das Gate-Subsystem ist auf den Typ `GateStep` getypt. Drei Konsequenzen:

- **`Initiative.stageGate` bleibt bei „L4".** L4.2 materialisiert sich im
  Stempel `implementationCompletedAt` — der Audit-Log der Haupt-Gates bleibt
  unberührt, `currentGateStep()` setzt Spalte und Stempel zum Schritt zusammen.
- **Die Kriterien wandern eine Stufe nach unten.** „Alle Child-Features
  abgeschlossen" ist jetzt Voraussetzung von **L4.2**; der L5-Antrag verlangt
  stattdessen die abgenommene Bestätigung (`implementation_confirmed`). L4.2 ist
  ausdrücklich **nicht** L5: zwischen fertiger Umsetzung und nachgewiesenem
  Impact darf beliebig viel Zeit liegen.
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
