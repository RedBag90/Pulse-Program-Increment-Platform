import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { loadZonesModel } from "@/modules/budgeting/server/views/zones-view";
import type { Majority } from "@/modules/budgeting/domain/three-zone";

export interface DecisionRow {
  epicId: string;
  title: string;
  cost: number;
  yes: number;
  total: number;
  majority: Majority;
  decision: {
    outcome: string;
    justification: string | null;
    deferredCheckTask: string | null;
    deviatesFromMajority: boolean;
  } | null;
}

export interface GroupReportOutView {
  costliestYesEpicId: string | null;
  clearestNoEpicId: string | null;
  biggestDisputeEpicId: string | null;
  costliestYesReason: string | null;
  clearestNoReason: string | null;
  disputeReason: string | null;
}

export interface DecisionGroupView {
  id: string;
  name: string;
  spokespersonId: string | null;
  reportOut: GroupReportOutView | null;
}

export interface DecisionsModel {
  roundId: string;
  status: string;
  reserveAmount: number | null;
  spread: DecisionRow[];
  canDecide: boolean;
  /** `budget.round.manage` — darf Report-outs erfassen. */
  canManage: boolean;
  /** Gruppen der Runde + ihr Report-out-Stand (F-B4). */
  groups: DecisionGroupView[];
  /** Alle Ballot-Epics (Titel) — für die Report-out-Auswahl. */
  epics: { id: string; title: string }[];
}

/** Streuzonen-Epics + ihr Entscheidungsstand + Reserve. */
export async function loadDecisionsModel(
  db: PrismaClient,
  principal: Principal,
  roundId: string,
): Promise<DecisionsModel | null> {
  const zones = await loadZonesModel(db, principal.tenantId, roundId);
  if (!zones) return null;

  const [decisions, round, groups] = await Promise.all([
    db.budgetDecision.findMany({
      where: { roundId },
      select: {
        epicId: true,
        outcome: true,
        justification: true,
        deferredCheckTask: true,
        deviatesFromMajority: true,
      },
    }),
    db.budgetRound.findFirst({
      where: { id: roundId, tenantId: principal.tenantId },
      select: { reserveAmount: true },
    }),
    db.budgetGroup.findMany({
      where: { roundId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        spokespersonId: true,
        reportOut: {
          select: {
            costliestYesEpicId: true,
            clearestNoEpicId: true,
            biggestDisputeEpicId: true,
            costliestYesReason: true,
            clearestNoReason: true,
            disputeReason: true,
          },
        },
      },
    }),
  ]);
  const byEpic = new Map(decisions.map((d) => [d.epicId, d]));

  const spread: DecisionRow[] = zones.epics
    .filter((e) => e.zone === "spread")
    .map((e) => {
      const d = byEpic.get(e.epicId);
      return {
        epicId: e.epicId,
        title: e.title,
        cost: e.cost,
        yes: e.yes,
        total: e.total,
        majority: e.majority,
        decision: d
          ? {
              outcome: d.outcome,
              justification: d.justification,
              deferredCheckTask: d.deferredCheckTask,
              deviatesFromMajority: d.deviatesFromMajority,
            }
          : null,
      };
    });

  return {
    roundId,
    status: zones.status,
    reserveAmount: round?.reserveAmount != null ? Number(round.reserveAmount) : null,
    spread,
    canDecide: hasCapability(principal, "budget.round.decide", { tenantId: principal.tenantId }),
    canManage: hasCapability(principal, "budget.round.manage", { tenantId: principal.tenantId }),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      spokespersonId: g.spokespersonId,
      reportOut: g.reportOut ?? null,
    })),
    epics: zones.epics.map((e) => ({ id: e.epicId, title: e.title })),
  };
}
