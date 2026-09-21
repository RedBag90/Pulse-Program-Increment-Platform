# Participatory Budgeting (PB)

> Der Ablauf aus Sicht der Beteiligten — Portfolio Manager, Gruppenmitglied,
> Finance — steht in
> [budgeting-walkthrough.md](budgeting-walkthrough.md). Dieses Dokument
> beschreibt das Modell dahinter.

> **Aktuelles Modell (Kachel-Prozess).** Der PB-Prozess lebt in **Kacheln** je
> Budgeting-Zeitraum (`/budgeting/periods`, Entity `BudgetRound`, Identität `id`,
> mehrere/zukünftige koexistieren). Ablauf je Kachel: **Beteiligte definieren
> (`BudgetParticipant`) → Gruppen bilden → PB-Liste kuratieren
> (`BudgetCandidate` = Epics **und** Run-the-Business-Positionen) → Runde starten
> (friert Kandidaten ein, materialisiert RtB) → Gruppen verteilen **freie
> €-Beträge** selbst (`GroupAllocation.amount`, mitglieds-scoped, bis Deadline) →
> Sprecher reicht ein (`BudgetGroup.submittedAt`) → Finance sieht alle Verteilungen
> und finalisiert (`BudgetCandidate.finalAmount`, Median-Vorbefüllung; Reserve =
> verteilbar − Σ final) → VS-/ART-/RtB-Budget-Tab (abgeleitet) → „nächste Kachel"
> übernimmt Beteiligte + Gruppen + Reserve.** Gruppenmitglieder sehen einen
> abgeleiteten **My-Tasks-Hinweis** (verschwindet nach Abgabe). **Run the Business**
> ist ein stehender, VS-Owner-gepflegter Betriebskosten-Plan
> (`RunTheBusinessItem`), der partizipativ mitbudgetiert wird — **die einzige**
> Definition der Betriebskosten. Jede Position trägt ihre eigene Periode
> (`interval`: monatlich / je Halbjahr / jährlich) und ist **optional einer
> Solution zugerechnet** (`solutionId`; `null` = wertstrom-übergreifend). Der Ask
> einer Kachel ist der Halbjahres-Anteil (`rtbCycleAmount`), die Run-Zahl einer
> Solution das Jahres-Äquivalent ihrer aktiven Positionen (`rtbAnnualAmount`) —
> beides ausschließlich in `budgeting/domain/rtb-interval.ts`. Rechte:
> `budget.group.contribute` (Selbst-Verteilung, Gruppen-Scope im Service),
> `budget.manage` (Finance-Finalisierung), `rtb_item.manage` (RtB-Plan),
> `budget.round.manage` (Kachel-Setup). Der Abschnitt unten (Drei-Zonen-
> Auswertung + Entscheidungsinstanz) ist der **abgelöste Vorgänger** — Finance
> entscheidet jetzt direkt.

---

Der Budgeting-Kern von Pulse ist ein **Participatory-Budgeting-Prozess**: mehrere Gruppen verteilen
denselben Topf **unabhängig** auf dieselben Epics; ausgewertet wird nicht die einzelne Verteilung, sondern
die **Übereinstimmung** zwischen den Gruppen (Drei-Zonen). Die kontinuierliche €/Perioden/ART-Feinverteilung
bleibt als **nachgelagerte Detailplanung** für finanzierte Epics erhalten.

## Zwei Schichten

1. **PB-Entscheidungs-Schicht** (dieses Dokument): Runde → Gruppen-Erfassung → Zonen → Entscheidung → Protokoll.
   Finanzierung ist **all-or-nothing bis MVP**.
2. **Detail-Board** (bestehend, `/budgeting/round`, in der Nav **„Detailplanung"**): kontinuierliche
   €-Verteilung je Halbjahr + ART-Breakdown, **nur für PB-finanzierte Epics**.

## Ein geführter Fluss (kein Flächen-Springen)

Die PB-Runde **ist** der Prozess; die €/ART-Detailplanung ist eine **Stufe** darin, kein Rivale. Eine
status-getriebene **Prozess-Leiste** (`server/views/budget-process-rail.ts`) spannt sich über alle Flächen —
sechs Schritte: **Einreichung · Rahmen & Gruppen · Erfassung & Zonen · Entscheidung · €/ART-Detail ·
Protokoll** — mit `done|blocked` aus dem Runden-Status + nachgelagertem Zustand und Deep-Links. Runde, Board
und Controlling konsumieren dieselbe Leiste.

### Der Seam (Runde → Detailplanung)

Beim `close` verbindet eine Transaktion die zwei Schichten sichtbar in Daten (`round-service.ts`):

- **Vorbefüllung** (F-B5): je **finanziertem** Epic wird eine `BudgetAllocation` mit `costToMvp` als Startwert
  für den Cycle **angelegt** — finanziert = budgetiert. Eine bereits bestehende (manuell gepflegte) Allokation
  wird **nicht** überschrieben.
- **Topf-Vererbung** (F-C2): der Runden-Topf (inkl. Reserve-Übertrag) wird der Detailplanungs-Topf dieses
  Cycles (`Tenant.budgetPoolByPeriod[cycleKey]`).
- **Un-Staging**: nicht finanzierte PB-Listen-Epics verlassen das Board (`stagedForBudgeting=false`).

Auf `/budgeting/rounds` erscheint bei `closed` eine **Übergabe-CTA** „Zur €/ART-Detailplanung"; das Controlling
zeigt die aktive Runde als Widget (Status, Fortschritt, Reserve).

## Ablauf (Status-Maschine der Runde)

`draft → running → decided → closed` (strikt vorwärts, `domain/round-status.ts`).

| Status      | Was passiert                                                                                    | Guard beim Verlassen                                      |
| ----------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **draft**   | Rahmen setzen (Topf, Termin), Pflichtvorhaben, **Gruppen** schneiden (≥3, heterogen)            | empfohlen Topf > 0 · ≥3 Gruppen (**weich** — nur Warnung) |
| **running** | **Hybrid-Erfassung**: Moderator trägt je (Gruppe, Epic) ein Ja/Nein ein; Zonen + Knappheit live | (Erfassung vollständig — heute lenient)                   |
| **decided** | Entscheidungsinstanz entscheidet die **Streuzone** (funded/rejected/deferred)                   | alle Streuzonen-Epics entschieden                         |
| **closed**  | Reserve berechnet, **Übergabe** ans Detail-Board, Protokoll unveränderlich                      | —                                                         |

## Drei-Zonen-Auswertung (Code entfernt)

Je Epic aus den Gruppen-Ja-Stimmen:

- **Konsens** (alle Gruppen Ja) → gesetzt, keine Diskussion.
- **Ablehnung** (keine Gruppe Ja) → raus, keine Diskussion.
- **Streuzone** (uneinheitlich) → einzige Diskussion + Entscheidung.

`majority` (yes/no/none) speist die **Begründungspflicht**: weicht die Instanz von der Gruppenmehrheit ab,
ist eine schriftliche Begründung Pflicht (E-04). Gleichstand bei gerader Gruppenzahl = `none` (keine
Abweichung definiert).

## Weitere Regeln (rein, `domain/`)

- **Knappheitstor** (Code entfernt): Nachfrage / verteilbares Budget muss ≥ **1,3** sein (sonst kein echter
  Trade-off).
- **Reserve** (`reserve.ts`): verteilbar − Σ finanziert; Rest unter dem günstigsten Epic → Reserve, **additiver
  Übertrag** in die Folgerunde (nur der Betrag).
- **Gruppen-Schnitt** (`group-cut.ts`): ≥3 Gruppen, 4–6 Personen, keine Team-Dopplung, Einreicher verteilt,
  Sprecher — als Warnungen.
- **Einreichung** (`work/domain/submission.ts`): ein Epic darf nur auf die PB-Liste, wenn Problem, MVP-Schnitt,
  Kosten-bis-MVP (eine Zahl), Risiko-Ampel und „wenn nicht finanziert" gesetzt sind (Vormerk-Gate serverseitig).

## Rollen & Rechte

- **Moderator** (`budget.round.manage`): Rahmen, Gruppen, Erfassung, Sprecher/Pre-Read, Report-out. Erfassung
  ist **moderator-seriell** (kein Realtime).
- **Entscheidungsinstanz** (`budget.round.decide`): entscheidet die Streuzone, begründet Abweichungen.
- **Detailplanung** (`budget.manage`): das €/ART-Board — Feinverteilung der **finanzierten** Menge. Der
  Snapshot des Protokolls braucht zusätzlich `budget_plan.revision.capture`.
- **Teilnehmer**: Runden-Mitgliedschaft (`BudgetGroupMember`), keine globale Rolle. Interessenkonflikt
  (Einreicher→Epic) ist Anzeige, keine Sperre.

> **Rechtebild:** Die geführte Runde (`budget.round.manage/.decide`) und die Detailplanung (`budget.manage`)
> sind bewusst getrennte Fähigkeiten — dieselbe Person kann beide haben, muss aber nicht. Der Seam
> (Vorbefüllung/Topf-Vererbung) läuft serverseitig beim `close` und braucht **kein** `budget.manage` beim
> schließenden Moderator; das Protokoll-Einfrieren beim `close` passiert nur, wenn der Akteur
> `budget_plan.revision.capture` hat (sonst per Button nachholbar).

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

## Protokoll (eine Schicht)

Beim Erfassen einer `BudgetPlanRevision` wird der **€/ART-Snapshot** in die `payload` geschrieben
(`domain/budget-plan-snapshot.ts`, Schlüssel `snapshot`). Die Revisions-Detailseite rendert ihn.

> **Die zweite Schicht ist im September 2026 zurückgebaut worden.** Daneben stand ein `round`-Block
> (Zonen, Entscheidungen, Report-outs) aus `domain/pb-round-snapshot.ts`. Er ruhte auf dem
> Drei-Zonen-Verfahren und las `GroupAllocation.funded` — ein Ja/Nein, das seit dem Wechsel auf freie
> €-Beträge **kein Dienst mehr schreibt**. Gemessen: 518 Zuteilungen, davon 0 mit `funded`, 0 mit
> `epicId`; und keine der 9 erfassten Revisionen trug je einen `round`-Block.
>
> Er war damit nicht bloß leer, sondern **falsch**: ohne Stimmen stuft `classifyZones` jedes Epic als
> „Ablehnung" ein, und das Protokoll hätte beim nächsten Zyklus mit Runde behauptet, es sei nichts
> finanziert worden. Entfernt wurden `pb-round-snapshot.ts`, `epic-zones.ts`, `three-zone.ts`,
> `scarcity.ts`, `services/zones.ts` und `PbRoundProtocol`. **Alt-Payloads bleiben lesbar** — der Block
> wird ignoriert, es gab keinen Version-Bruch und keinen Backfill.
>
> Die Tabellen `budget_decisions` und `group_report_outs` sowie die Spalten `GroupAllocation.funded`
> und `.epicId` stehen **noch** — ihr letzter Leser ist fort, ihr Abbau ist ein eigener Zug.

## Bekannte Folge-Schritte

- Folgerunden-Bericht gegen die Zusage (F-02) an die bestehende `lpm-review`.
- Rendering des Verteilbogens als echtes PDF (heute Browser-Druck über `/budgeting/periods/[id]/sheet`).
