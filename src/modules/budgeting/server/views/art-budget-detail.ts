/**
 * Das Seitenmodell des ART-Budget-Reiters: was diesem ART zugeteilt ist, in
 * welchem Zustand es steht, und was an der Datenlage hakt.
 *
 * Getrennt nach **Geldquelle**, obwohl es heute nur eine gibt. Sobald ART-Epics
 * aus dem eigenen Rahmen finanziert werden (`art-epics.md`), schreiben beide
 * Wege in dieselbe `BudgetAllocation` — die Vermischung entstünde also von
 * selbst, wenn die Form sie nicht von Anfang an trennt.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { loadArtCoverage } from "@/modules/budgeting/server/services/art-coverage";
import {
  loadArtEpicBudgetView,
  type ArtPotViewer,
} from "@/modules/budgeting/server/services/art-pot-view";
import { halfYearKey } from "@/modules/core/kernel/domain/calendar";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { readBudgetCandidates } from "@/modules/budgeting/server/services/budget-reads";
import { sortCycles, currentCycle, cycleLabel } from "@/modules/budgeting/domain/cycle";
import {
  loadEpicRows,
  type EpicRow,
  type CandidateRow,
} from "@/modules/budgeting/server/services/epic-rows";
import type {
  ArtBudgetDetail,
  ArtBudgetSourceView,
  UnfundedCandidate,
} from "@/modules/budgeting/domain/art-budget-model";
import { ALLOCATION_SOURCE_KEYS } from "@/modules/budgeting/domain/art-budget-model";
import { isChangeKind } from "@/modules/budgeting/domain/rtb-kind";
import { rtbAnnualAmount, rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";
import {
  summarizeAllocations,
  type AllocatedEpic,
} from "@/modules/budgeting/domain/allocation-state";
import { loadArtChangeBudgetByCycle } from "@/modules/budgeting/server/services/art-epic-budget";

/**
 * Faltet Kandidaten und Epics in das Seitenmodell. Rein — der Server reicht
 * herein, was er geladen hat, damit die Regel testbar bleibt.
 */
export function buildArtBudgetDetail(input: {
  /**
   * Der ART, um dessen Sicht es geht.
   *
   * Stand bis 2026-09-19 als `string | null` da: `null` war die Sicht **ohne**
   * ART, der Wertstrom-Verlauf. Mit ihm ist der Zweig entfallen — ein
   * Kennzeichen, das nur noch einen Wert annimmt, ist keines.
   */
  artId: string;
  now: Date;
  candidates: readonly CandidateRow[];
  epics: readonly EpicRow[];
  artNames: Record<string, string>;
  withoutArt: { count: number; amount: number };
  cycleKey?: string | undefined;
  /**
   * Halbjahre, in denen dieser ART aus **seinem eigenen Rahmen** verteilt hat.
   *
   * Ohne sie bildete sich die Achse allein aus den Kachel-Kandidaten: ein
   * Halbjahr, in dem ein ART ausschließlich ART-Epics finanziert hat, wäre gar
   * nicht anwählbar und seine Verteilfläche dauerhaft unsichtbar — genau der
   * Normalfall, den Guardrail 3 herstellen soll.
   */
  artCycleKeys?: readonly string[] | undefined;
}): ArtBudgetDetail {
  // Neueste zuerst — die Ordnung ist benannt, nicht unterstellt.
  const cycleKeys = sortCycles(
    [...input.candidates.map((c) => c.cycleKey), ...(input.artCycleKeys ?? [])],
    "desc",
  );
  // Ohne Zuteilung zeigt die Fläche das laufende Halbjahr statt gar nichts.
  const cycles = (cycleKeys.length > 0 ? cycleKeys : [currentCycle(input.now)]).map((key) => ({
    key,
    label: cycleLabel(key),
  }));
  const cycleKey =
    input.cycleKey != null && cycles.some((c) => c.key === input.cycleKey)
      ? input.cycleKey
      : (cycles[0]?.key ?? halfYearKey(input.now));

  const byEpic = new Map<string, EpicRow>(input.epics.map((e) => [e.id, e]));
  const allocated: AllocatedEpic[] = [];
  const titles: Record<string, string> = {};

  const unfunded: UnfundedCandidate[] = [];

  for (const c of input.candidates) {
    if (c.cycleKey !== cycleKey) continue;

    // Ohne Betrag ist die Kachel entweder noch nicht durch — oder sie hat
    // entschieden und nichts gegeben. Nur der zweite Fall ist „nicht finanziert".
    if (c.amount == null || c.amount === 0) {
      if (!c.decided) continue;
      unfunded.push({
        epicId: c.epicId,
        // Der Kandidat trägt seinen eigenen Titel — er gilt auch für ein
        // gelöschtes Epic, dessen Antrag trotzdem stattgefunden hat.
        title: byEpic.get(c.epicId)?.title ?? c.title,
        stageGate: byEpic.get(c.epicId)?.stageGate ?? null,
        ask: c.ask,
        reason: "ballot",
      });
      continue;
    }

    const epic = byEpic.get(c.epicId);
    if (!epic) continue; // gelöschtes Epic — die Kachel-Zeile bleibt, die Sicht nicht
    allocated.push({
      epicId: c.epicId,
      amount: c.amount,
      stageGate: epic.stageGate,
      implementationCompletedAt: epic.implementationCompletedAt,
    });
    titles[c.epicId] = epic.title;
  }

  unfunded.sort((a, b) => b.ask - a.ask);

  const sources: ArtBudgetSourceView[] = [
    {
      source: "portfolio",
      label: ALLOCATION_SOURCE_KEYS.portfolio,
      breakdown: summarizeAllocations(allocated),
      titles,
    },
  ];

  // Der ART der Kachel ist eingefroren; wechselt ein Epic danach, bleibt das
  // Budget hier — die Kachel hat es hier entschieden. Sichtbar machen, nicht
  // stillschweigend hinnehmen.
  const switchedArt = allocated
    .map((a) => byEpic.get(a.epicId))
    .filter((e): e is EpicRow => e != null && e.artId !== input.artId)
    .map((e) => ({
      epicId: e.id,
      title: e.title,
      currentArtName: e.artId ? (input.artNames[e.artId] ?? null) : null,
    }));

  return {
    artId: input.artId,
    cycles,
    cycleKey,
    sources,
    switchedArt,
    epicsWithoutArt: input.withoutArt,
    unfunded,
    // Der Builder kennt nur die Zuteilungen; Last und Rahmen kommen aus
    // weiteren Abfragen und werden vom Loader nachgereicht.
    coverage: null,
    pot: null,
    rtb: { run: [], change: [] },
  };
}

/** Lädt den Budget-Reiter eines ARTs. */
export async function loadArtBudgetDetail(
  db: PrismaClient,
  tenantId: TenantId,
  art: { id: string; valueStreamId: string },
  opts: {
    now?: Date;
    cycleKey?: string | undefined;
    /** Practice `artEpics` — ohne sie gibt es keinen Rahmen und keine Fläche. */
    artEpics?: boolean;
    /** Aufgelöstes Portfolio-Limit des Wertstroms. */
    threshold?: number;
    /** Der Betrachter — entscheidet, welche Zeilen der Verteilliste bedienbar sind. */
    viewer?: ArtPotViewer;
  } = {},
): Promise<ArtBudgetDetail> {
  const now = opts.now ?? new Date();

  const [allCandidates, arts, artCycles] = await Promise.all([
    // Ein Lader statt zweier Abfragen (REQ-5): die Zeilen dieses ARTs und die
    // des Wertstroms **ohne** ART kamen bisher aus zwei eingeengten Abfragen,
    // obwohl sie in derselben Tabelle nebeneinander liegen.
    readBudgetCandidates(db, tenantId),
    // **Ohne `deletedAt`-Filter, und das ist richtig:** hier werden nur Namen
    // aufgelöst. Ein Epic, das in einem seither gelöschten ART sass, soll
    // dessen Namen zeigen und nicht „—".
    db.art.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    // Die Halbjahre, in denen dieser ART aus seinem Rahmen verteilt hat — zweite
    // Quelle der Achse (siehe `artCycleKeys`).
    db.artEpicAllocation.findMany({
      where: { tenantId, artId: art.id },
      select: { cycleKey: true },
      distinct: ["cycleKey"],
    }),
  ]);

  const finals = allCandidates.filter((c) => c.kind === "epic" && c.artId === art.id);
  // Zuteilungen des Wertstroms ohne ART — sie tauchen in keiner ART-Sicht auf.
  const vsFinals = allCandidates.filter(
    (c) =>
      c.kind === "epic" &&
      c.valueStreamId === art.valueStreamId &&
      c.artId == null &&
      c.finalAmount != null,
  );

  const candidates: CandidateRow[] = finals
    .filter((f): f is typeof f & { epicId: string } => f.epicId != null)
    .map((f) => ({
      epicId: f.epicId,
      title: f.title,
      ask: f.ask,
      amount: f.finalAmount,
      cycleKey: f.cycleKey,
      decided: f.roundStatus === "closed",
    }));

  const epics = await loadEpicRows(db, tenantId, candidates);

  const detail = buildArtBudgetDetail({
    artId: art.id,
    now,
    candidates,
    epics,
    artNames: Object.fromEntries(arts.map((a) => [a.id, a.name])),
    withoutArt: {
      count: vsFinals.length,
      amount: vsFinals.reduce((s, f) => s + (f.finalAmount ?? 0), 0),
    },
    artCycleKeys: artCycles.map((c) => c.cycleKey),
    ...(opts.cycleKey != null ? { cycleKey: opts.cycleKey } : {}),
  });

  // Veränderungsgeld je Zyklus — Zähler des Satzes und Bezugsgröße der Lücke.
  // Aus dem geteilten Lader, nicht aus den Kandidaten dieser Seite: der
  // ART-Rahmen finanziert dieselben Features und stand hier bis September 2026
  // nicht drin (`loadArtChangeBudgetByCycle`).
  const allocatedByCycle =
    (await loadArtChangeBudgetByCycle(db, tenantId, [art.id])).get(art.id) ?? {};

  const [coverage, pot, rtbItems] = await Promise.all([
    loadArtCoverage(db, tenantId, art.id, detail.cycleKey, allocatedByCycle),
    opts.artEpics
      ? loadArtEpicBudgetView(
          db,
          tenantId,
          art,
          detail.cycleKey,
          opts.threshold ?? 100_000,
          now,
          opts.viewer,
        )
      : Promise.resolve(null),
    listRtbItems(db, tenantId, { artId: art.id }),
  ]);

  const rtbRow = (i: (typeof rtbItems)[number]) => ({
    id: i.id,
    name: i.name,
    cycleAmount: rtbCycleAmount(i.plannedAmount, i.interval),
    annualAmount: rtbAnnualAmount(i.plannedAmount, i.interval),
  });

  return {
    ...detail,
    coverage,
    pot,
    // Betrieb und ART-Epic-Budget getrennt: das eine ist Run, das andere
    // Grow — in einer Summe wären beide falsch dargestellt.
    rtb: {
      run: rtbItems.filter((i) => i.active && !isChangeKind(i.kind)).map(rtbRow),
      change: rtbItems.filter((i) => i.active && isChangeKind(i.kind)).map(rtbRow),
    },
    // Zwei Quellen, getrennt ausgewiesen: beide schreiben in dieselbe
    // `BudgetAllocation`, die Vermischung entstünde also von selbst.
    sources:
      pot && pot.breakdown.total > 0
        ? [
            ...detail.sources,
            {
              source: "art" as const,
              label: ALLOCATION_SOURCE_KEYS.art,
              breakdown: pot.breakdown,
              titles: pot.titles,
            },
          ]
        : detail.sources,
  };
}
