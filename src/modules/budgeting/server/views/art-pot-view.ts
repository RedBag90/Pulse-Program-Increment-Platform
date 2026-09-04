/**
 * Die Verteilliste eines ARTs: welche seiner ART-Epics wie viel aus dem
 * zugesprochenen ART-Epic-Budget bekommen haben, und welche Zeile der Betrachter
 * bedienen darf.
 *
 * Lag bis zum Zerlegen von `art-budget-detail.ts` in dieser Datei — obwohl sie
 * zum Verteil-Service gehört und nicht zum Falter des Budget-Reiters.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import { classifyEpic } from "@/modules/work/domain/pb-submission";
import { mayDistributeToEpic } from "@/modules/budgeting/domain/art-pot-access";
import { summarizeAllocations } from "@/modules/budgeting/domain/allocation-state";
import { loadArtPot, loadArtEpicAllocations } from "@/modules/budgeting/server/services/art-pot";
import type { ArtPotView } from "@/modules/budgeting/server/views/art-budget-model";

/**
 * Der ART-Epic-Budget eines ARTs und die Epics, auf die er verteilt wird.
 *
 * Gelistet werden nur Epics, die **vorgemerkt** (`stagedForBudgeting`),
 * **budgeting-reif** und der Klasse `art` sind. Die Vormerkung bleibt der aktive
 * Schritt des Owners — sie meldet hier keine Portfolio-Runde an, sondern die
 * Verteilung durch den Wertstrom.
 */
/**
 * Wer schaut auf die Verteilliste — die drei Fakten, aus denen sich je Zeile
 * ergibt, ob sie bedienbar ist. Fehlt der Betrachter, ist keine Zeile bedienbar;
 * die Fläche entscheidet dann allein über ihr eigenes Schreibrecht.
 */
export interface ArtPotViewer {
  userId: string;
  isValueStreamFinance: boolean;
  hasRtbCapability: boolean;
  /** `art_budget.distribute` auf **diesem** ART — der Weg des RTE. */
  hasArtDistributeCapability: boolean;
}

export async function loadArtPotView(
  db: PrismaClient,
  tenantId: TenantId,
  art: { id: string; valueStreamId: string },
  cycleKey: string,
  threshold: number,
  now: Date = new Date(),
  viewer?: ArtPotViewer,
): Promise<ArtPotView> {
  const [pot, allocations, candidates, onPbList] = await Promise.all([
    loadArtPot(db, tenantId, art.id, cycleKey, now),
    loadArtEpicAllocations(db, tenantId, art.id, cycleKey),
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        artId: art.id,
        stagedForBudgeting: true,
        businessCaseApprovedAt: { not: null },
      },
      select: {
        id: true,
        title: true,
        stageGate: true,
        implementationCompletedAt: true,
        businessCase: true,
        businessCaseApprovedAt: true,
        hypothesisApprovedAt: true,
        portfolioOverrideAt: true,
        primarySolution: { select: { productManagerId: true } },
      },
    }),
    // REQ-18: Epics, die für dieses Halbjahr schon auf der PB-Liste stehen,
    // gehören nicht auch in die Verteilliste. Beide schreiben dieselbe Zelle in
    // `BudgetAllocation`; wer zuletzt schriebe, gewönne.
    db.budgetCandidate.findMany({
      where: { tenantId, kind: "epic", artId: art.id, round: { cycleKey } },
      select: { epicId: true },
    }),
  ]);

  const onList = new Set(onPbList.map((c) => c.epicId).filter((id): id is string => id != null));
  const byEpic = new Map(allocations.map((a) => [a.epicId, a]));

  const rows = candidates
    .filter((e) => !onList.has(e.id))
    .flatMap((e) => {
      const c = classifyEpic(e, threshold);
      if (c.epicClass !== "art") return [];
      const existing = byEpic.get(e.id);
      const currentAsk = c.cost ?? 0;
      // Der Richtwert friert beim ersten Zuteilen ein — sonst verschöbe sich die
      // Liste zwischen zwei Besuchen, ohne dass jemand etwas getan hat.
      const ask = existing ? existing.ask : currentAsk;
      const pm = e.primarySolution?.productManagerId ?? null;
      return [
        {
          epicId: e.id,
          title: e.title,
          stageGate: e.stageGate,
          ask,
          amount: existing?.amount ?? 0,
          askDrifted: existing != null && existing.ask !== currentAsk,
          canDistribute:
            viewer != null &&
            mayDistributeToEpic({
              isValueStreamFinance: viewer.isValueStreamFinance,
              isEpicSolutionProductManager: pm != null && pm === viewer.userId,
              hasRtbCapability: viewer.hasRtbCapability,
              hasArtDistributeCapability: viewer.hasArtDistributeCapability,
            }),
        },
      ];
    });

  rows.sort((a, b) => b.ask - a.ask);

  // Die zweite Quelle bekommt dieselbe Staffel wie die erste — getrennt
  // ausgewiesen, nicht stillschweigend addiert.
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const breakdown = summarizeAllocations(
    rows.map((r) => ({
      epicId: r.epicId,
      amount: r.amount,
      stageGate: r.stageGate,
      implementationCompletedAt: byId.get(r.epicId)?.implementationCompletedAt ?? null,
    })),
  );

  return {
    pot,
    rows,
    breakdown,
    titles: Object.fromEntries(rows.map((r) => [r.epicId, r.title])),
  };
}
