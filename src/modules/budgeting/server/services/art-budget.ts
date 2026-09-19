import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ValueStreamId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import {
  readBudgetCandidates,
  readRtbItems,
  readRtbAwards,
  readSolutions,
} from "@/modules/budgeting/server/services/budget-reads";
import { resolveRtbToArts } from "@/modules/budgeting/domain/rtb-art-resolution";
import { rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";
import { isChangeKind } from "@/modules/budgeting/domain/rtb-kind";
import { budgetPlusLoadPeriods } from "@/modules/budgeting/domain/period-window";
import {
  aggregateArtFeatureLoad,
  type ArtFeatureLoad,
} from "@/modules/budgeting/domain/art-budget";
import { getValueStreamBudget } from "@/modules/budgeting/server/services/budgeting";

export interface ArtBudgetByPeriod {
  artId: string;
  name: string;
  /**
   * **Das Veränderungsgeld dieses ARTs je Halbjahr** — Portfolio-Zuteilung
   * **plus** zugesprochener ART-Rahmen.
   *
   * Bis 2026-09-19 standen hier nur die Portfolio-Zuteilungen. Der Rahmen ist
   * aber dasselbe Geld für denselben Zweck: er finanziert ART-Epics und
   * ART-eigene Arbeit. Er fehlte in der Matrix vollständig — bei Materials &
   * Energy waren das 100.500 €, die in der Reiterschiene danebenstanden und in
   * der Übersicht nicht vorkamen.
   */
  budgetByPeriod: Record<string, number>;
  /** Der Rahmenanteil daraus — für die Aufschlüsselung an der Zelle. */
  frameByPeriod: Record<string, number>;
  /** Feature count + Σ Job Size per half-year + backlog. */
  load: ArtFeatureLoad;
  /**
   * **Betriebsgeld dieses ARTs im gewählten Halbjahr** (REQ-9) — aufgelöst über
   * die Position, ihre Solution oder gleichmässig geschlüsselt.
   *
   * **Zugesprochen schlägt beantragt** (REQ-8), wie im Business Case: liegen für
   * das Halbjahr Zusprüche vor, gelten sie. Bis 2026-09-19 rechnete diese
   * Spalte mit dem geplanten Betrag und zeigte deshalb 24.500 €, wo der
   * Business Case desselben ARTs 28.824 € auswies.
   *
   * **Zählt nirgends in die Deckung.** `allocated`, die Lücke und der €-Satz je
   * Job-Size-Punkt bleiben Veränderungsgeld (REQ-10). Flösse Betriebsgeld dort
   * hinein, spränge die Ampel auf „gedeckt", obwohl kein Euro davon ein Feature
   * bezahlt — und der Satz stiege, weil sein Zähler wüchse und sein Nenner
   * (Job Size) nicht.
   */
  operatingPerCycle: number;
}

export interface ArtBudgetBreakdown {
  /** Half-year columns: the VS budget-plan periods ∪ the periods features' PIs fall in. */
  periods: { key: string; label: string }[];
  /**
   * **Das Veränderungsgeld des Wertstroms je Halbjahr** — die Bezugsgröße, gegen
   * die die ARTs ziehen: Σ der finalen Epic-Zuteilungen **plus** Σ der
   * zugesprochenen ART-Rahmen.
   *
   * **Lokal gerechnet, nicht aus `getValueStreamBudgets`.** Dessen „Budget" sind
   * allein die Epic-Zuteilungen, und es hat Nutzer in Struktur-, Timeline- und
   * Reporting-Sichten. Zwei Zahlen unter einem Namen wäre genau der Fehler, den
   * §2.5 der Konsolidierungs-Spec abstellt — deshalb heißt die Zeile auf der
   * Fläche „Wertstrom · Veränderung" und nicht „Wertstrom-Budget".
   */
  vsByPeriod: Record<string, number>;
  arts: ArtBudgetByPeriod[];
  /** Woher die Betriebsbeträge stammen — die Spalte beschriftet sich danach. */
  operatingBasis: "awarded" | "planned";
  /**
   * Betriebsgeld, das **keinem** ART zuzuordnen war — heute genau die
   * Positionen an einer Solution ohne ART. Die Fläche weist es aus, statt es
   * verschwinden zu lassen; es ist zugleich die Begründung dafür, dass
   * `solutions.art_id` zur Pflicht wird.
   */
  operatingUnresolved: number;
}

/**
 * ART-Budgets eines Wertstroms + die Feature-Last, je Halbjahr.
 *
 * **Vollständig abgeleitet.** Das Budget eines ART ist die Summe der final
 * zugeteilten Beträge seiner Epics, gruppiert nach dem Halbjahr der Kachel, aus
 * der die Zuteilung stammt. Früher stand daneben eine handgepflegte
 * `ArtBudget`-Tabelle — zwei Zahlen für dieselbe Sache, die auseinanderliefen.
 */
export async function getArtBudgetBreakdown(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: ValueStreamId,
  /**
   * Das gewählte Halbjahr — **nur** für die Betriebsspalte. Sie zeigt einen
   * Betrag, keine Reihe, und braucht deshalb ein Halbjahr, um „zugesprochen"
   * überhaupt beantworten zu können. Fehlt es, bleibt es beim geplanten Betrag.
   */
  cycleKey?: string,
): Promise<ArtBudgetBreakdown> {
  const [vsBudget, arts, candidates, rtbItems, rtbAwards, solutions] = await Promise.all([
    getValueStreamBudget(db, tenantId, valueStreamId),
    db.art.findMany({
      where: { tenantId, valueStreamId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Die geteilten Lader (REQ-5). Die Kandidaten standen hier als eigene,
    // eingeengte Abfrage **nach** dem `Promise.all` — also eine dritte
    // Rundreise, die auf die ersten beiden wartete, obwohl sie von ihnen nichts
    // braucht. Positionen und Solutions liest die Seite ohnehin.
    readBudgetCandidates(db, tenantId),
    readRtbItems(db, tenantId),
    // Über alle Halbjahre — genau dafür ist der Lader gebaut. Der Rahmen je
    // Spalte kommt daraus, die Betriebsspalte schneidet ihr Halbjahr heraus.
    readRtbAwards(db, tenantId),
    readSolutions(db, tenantId),
  ]);

  const epicByPeriod = vsBudget.budget?.byPeriod ?? {};
  const artIds = arts.map((a) => a.id);
  const ofThisStream = new Set(artIds);

  // Das ART-Budget je Halbjahr: die finalen Beträge der Epic-Kandidaten dieses
  // ART, gruppiert nach dem Zyklus der Kachel, die sie zugeteilt hat.
  const finals = candidates.filter(
    (c) =>
      c.kind === "epic" && c.finalAmount != null && c.artId != null && ofThisStream.has(c.artId),
  );
  const budgetByArt = new Map<string, Record<string, number>>();
  for (const f of finals) {
    if (!f.artId) continue;
    const byPeriod = budgetByArt.get(f.artId) ?? {};
    byPeriod[f.cycleKey] = (byPeriod[f.cycleKey] ?? 0) + (f.finalAmount ?? 0);
    budgetByArt.set(f.artId, byPeriod);
  }

  const features = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      artId: { in: artIds },
    },
    select: { artId: true, wsjfJobSize: true, pi: { select: { startDate: true } } },
  });

  const loads = new Map(
    aggregateArtFeatureLoad(
      artIds,
      features.map((f) => ({
        artId: f.artId ?? "",
        piStart: f.pi?.startDate ?? null,
        jobSize: f.wsjfJobSize ?? 0,
      })),
    ).map((l) => [l.artId, l]),
  );

  /**
   * **Der ART-Rahmen je ART und Halbjahr.** Dieselbe Regel wie in
   * `loadArtEpicBudgets` — Σ der Zusprüche auf den aktiven
   * `art_change`-Positionen eines ARTs —, nur über **alle** Halbjahre statt
   * eines. Die Position sagt, auf welches ART ein Zuspruch einzahlt.
   */
  const artOfFrameItem = new Map(
    rtbItems
      .filter(
        (i) => isChangeKind(i.kind) && i.active && i.artId != null && ofThisStream.has(i.artId),
      )
      .map((i) => [i.id, i.artId!]),
  );
  const frameByArt = new Map<string, Record<string, number>>();
  const frameByPeriodTotal: Record<string, number> = {};
  for (const a of rtbAwards) {
    const artId = artOfFrameItem.get(a.rtbItemId);
    if (artId == null) continue;
    const byPeriod = frameByArt.get(artId) ?? {};
    byPeriod[a.cycleKey] = (byPeriod[a.cycleKey] ?? 0) + a.amount;
    frameByArt.set(artId, byPeriod);
    frameByPeriodTotal[a.cycleKey] = (frameByPeriodTotal[a.cycleKey] ?? 0) + a.amount;
  }

  // Columns: the budget-plan periods ∪ any half-year a feature's PI sits in ∪
  // die Halbjahre, in denen ein ART-Rahmen zugesprochen wurde — sonst fehlte
  // eine Spalte, in der nur ein Rahmen liegt.
  const periods = budgetPlusLoadPeriods(
    [
      ...new Set([
        ...vsBudget.periods.map((p) => p.key),
        ...finals.map((f) => f.cycleKey),
        ...Object.keys(frameByPeriodTotal),
      ]),
    ],
    features.flatMap((f) => (f.pi ? [f.pi.startDate] : [])),
  );

  /**
   * **Das Betriebsgeld je ART** (REQ-9).
   *
   * Nur `run`: der ART-Rahmen (`art_change`) ist der andere Geldstrang und hat
   * seinen eigenen Platz im Reiter „Betrieb". Beide in einer Spalte wären genau
   * die Vermischung, gegen die das Vokabular der Spec geschrieben ist.
   *
   * Der Betrag ist der **Halbjahres**-Betrag — dieselbe Grösse wie eine
   * Periodenspalte, nur eben in jedem Halbjahr dieselbe, solange die Position
   * unverändert läuft. Deshalb steht er als **eine** Spalte und nicht N-mal.
   */
  const betrieb = rtbItems.filter(
    (i) => i.valueStreamId === valueStreamId && i.active && !isChangeKind(i.kind),
  );
  /**
   * **Zugesprochen schlägt beantragt** (REQ-8) — dieselbe Regel wie in
   * `art-business-case.ts`, und die Frage gilt dem **ganzen Halbjahr**, nicht
   * der einzelnen Position: sobald der Wertstrom aufgeteilt hat, ist eine
   * Position ohne Zuspruch eine mit 0 €, keine, für die der geplante Betrag
   * einspringt.
   */
  const ownItems = new Set(betrieb.map((i) => i.id));
  const zuspruch = new Map(
    rtbAwards
      .filter((a) => a.cycleKey === cycleKey && ownItems.has(a.rtbItemId))
      .map((a) => [a.rtbItemId, a.amount] as const),
  );
  const operatingBasis: "awarded" | "planned" = zuspruch.size > 0 ? "awarded" : "planned";

  const operating = resolveRtbToArts(
    betrieb.map((i) => ({
      id: i.id,
      artId: i.artId,
      solutionId: i.solutionId,
      amount:
        operatingBasis === "awarded"
          ? (zuspruch.get(i.id) ?? 0)
          : rtbCycleAmount(i.plannedAmount, i.interval),
    })),
    Object.fromEntries(
      solutions.filter((s) => s.valueStreamId === valueStreamId).map((s) => [s.id, s.artId]),
    ),
    artIds,
  );

  const rows: ArtBudgetByPeriod[] = arts.map((a) => {
    const portfolio = budgetByArt.get(a.id) ?? {};
    const frame = frameByArt.get(a.id) ?? {};
    return {
      artId: a.id,
      name: a.name,
      budgetByPeriod: Object.fromEntries(
        [...new Set([...Object.keys(portfolio), ...Object.keys(frame)])].map((k) => [
          k,
          (portfolio[k] ?? 0) + (frame[k] ?? 0),
        ]),
      ),
      frameByPeriod: frame,
      // `aggregateArtFeatureLoad(artIds, …)` guarantees exactly one entry per id
      // in `artIds` (= `arts.map(a => a.id)`), so this lookup is always present.
      load: loads.get(a.id)!,
      operatingPerCycle: operating.byArt[a.id] ?? 0,
    };
  });

  return {
    periods,
    // Die Bezugsgröße wächst mit den Zeilen. Stünde hier nur die Epic-Summe,
    // stiege die Auslastung über 100 % und „Nicht zugeordnet" würde negativ,
    // sobald ein Rahmen zugesprochen ist.
    vsByPeriod: Object.fromEntries(
      [...new Set([...Object.keys(epicByPeriod), ...Object.keys(frameByPeriodTotal)])].map((k) => [
        k,
        (epicByPeriod[k] ?? 0) + (frameByPeriodTotal[k] ?? 0),
      ]),
    ),
    arts: rows,
    operatingBasis,
    operatingUnresolved: operating.unresolved.reduce((sum, u) => sum + u.amount, 0),
  };
}
