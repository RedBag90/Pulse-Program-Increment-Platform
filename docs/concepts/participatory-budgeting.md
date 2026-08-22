# Participatory Budgeting (PB)

Der Budgeting-Kern von Pulse ist ein **Participatory-Budgeting-Prozess**: mehrere Gruppen verteilen
denselben Topf **unabhängig** auf dieselben Epics; ausgewertet wird nicht die einzelne Verteilung, sondern
die **Übereinstimmung** zwischen den Gruppen (Drei-Zonen). Die kontinuierliche €/Perioden/ART-Feinverteilung
bleibt als **nachgelagerte Detailplanung** für finanzierte Epics erhalten.

## Zwei Schichten

1. **PB-Entscheidungs-Schicht** (dieses Dokument): Runde → Gruppen-Erfassung → Zonen → Entscheidung → Protokoll.
   Finanzierung ist **all-or-nothing bis MVP**.
2. **Detail-Board** (bestehend, `/budgeting/round`): kontinuierliche €-Verteilung je Halbjahr + ART-Breakdown,
   **nur für PB-finanzierte Epics**.

## Ablauf (Status-Maschine der Runde)

`draft → running → decided → closed` (strikt vorwärts, `domain/round-status.ts`).

| Status | Was passiert | Guard beim Verlassen |
|---|---|---|
| **draft** | Rahmen setzen (Topf, Termin), Pflichtvorhaben, **Gruppen** schneiden (≥3, heterogen) | Topf > 0 · ≥3 Gruppen |
| **running** | **Hybrid-Erfassung**: Moderator trägt je (Gruppe, Epic) ein Ja/Nein ein; Zonen + Knappheit live | (Erfassung vollständig — heute lenient) |
| **decided** | Entscheidungsinstanz entscheidet die **Streuzone** (funded/rejected/deferred) | alle Streuzonen-Epics entschieden |
| **closed** | Reserve berechnet, **Übergabe** ans Detail-Board, Protokoll unveränderlich | — |

## Drei-Zonen-Auswertung (`domain/three-zone.ts`)

Je Epic aus den Gruppen-Ja-Stimmen:
- **Konsens** (alle Gruppen Ja) → gesetzt, keine Diskussion.
- **Ablehnung** (keine Gruppe Ja) → raus, keine Diskussion.
- **Streuzone** (uneinheitlich) → einzige Diskussion + Entscheidung.

`majority` (yes/no/none) speist die **Begründungspflicht**: weicht die Instanz von der Gruppenmehrheit ab,
ist eine schriftliche Begründung Pflicht (E-04). Gleichstand bei gerader Gruppenzahl = `none` (keine
Abweichung definiert).

## Weitere Regeln (rein, `domain/`)

- **Knappheitstor** (`scarcity.ts`): Nachfrage / verteilbares Budget muss ≥ **1,3** sein (sonst kein echter
  Trade-off).
- **Reserve** (`reserve.ts`): verteilbar − Σ finanziert; Rest unter dem günstigsten Epic → Reserve, **additiver
  Übertrag** in die Folgerunde (nur der Betrag).
- **Gruppen-Schnitt** (`group-cut.ts`): ≥3 Gruppen, 4–6 Personen, keine Team-Dopplung, Einreicher verteilt,
  Sprecher — als Warnungen.
- **Einreichung** (`work/domain/submission.ts`): ein Epic darf nur auf den Ballot, wenn Problem, MVP-Schnitt,
  Kosten-bis-MVP (eine Zahl), Risiko-Ampel und „wenn nicht finanziert" gesetzt sind (Vormerk-Gate serverseitig).

## Rollen & Rechte

- **Moderator** (`budget.round.manage`): Rahmen, Gruppen, Erfassung, Report-out. Erfassung ist
  **moderator-seriell** (kein Realtime).
- **Entscheidungsinstanz** (`budget.round.decide`): entscheidet die Streuzone, begründet Abweichungen.
- **Teilnehmer**: Runden-Mitgliedschaft (`BudgetGroupMember`), keine globale Rolle. Interessenkonflikt
  (Einreicher→Epic) ist Anzeige, keine Sperre.

## Datenmodell (Prisma)

`BudgetRound` (je Halbjahres-Cycle, `@@unique(tenantId, cycleKey)`) · `BudgetGroup` + `BudgetGroupMember`
(`hasRead` = Pre-Read) · `GroupAllocation` (`funded`, `@@unique(groupId, epicId)`) · `BudgetDecision`
(`outcome`, `justification`, `deferredCheckTask`, `deviatesFromMajority`) · `GroupReportOut`. Epic-Felder:
`mandatory`, `costToMvp`, `riskRating`, `problemStatement`, `mvpCut`, `ifNotFunded`.

## Fixierte Entscheidungen

- Erfassung nur durch den **Moderator** (Hybrid, kein Realtime).
- Guardrails = **nur Hinweis** auf der finanzierten Menge (kein harter Block).
- Reserve-Übertrag = **nur Betrag** (vertagte Epics manuell via Prüfauftrag).
- Kadenz **fest Halbjahr** (`YYYY-H1/H2`).

## Bewusst außerhalb Tooling (Workshop-Logistik)

Pitches (5 Min), räumliche Trennung, Timer, Regelzettel (PB D-04/05/07, G-02/03/04) sind **Prozess-Doku**,
keine Software. Pulse liefert die digitale Erfassung + Auswertung.

## Bekannte Folge-Schritte

- Verteilbogen-Druck (G-01), Report-out-Formular-UI, Sprecher-Picker/Pre-Read-Toggle in der UI.
- Folgerunden-Bericht gegen die Zusage (F-02) an die bestehende `lpm-review`.
- Dedizierter eingefrorener `BudgetPlanRevision`-Snapshot für die PB-Runde (heute dient die unveränderliche
  Closed-Runde als Protokoll).
