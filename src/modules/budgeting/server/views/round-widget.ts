/**
 * Controlling-Runden-Widget (F-A3) — macht die PB-Runde des aktiven Cycles auf
 * der Controlling-Übersicht sichtbar: Status, Gruppen, Ballot-/Entscheidungs-
 * Fortschritt und (nach dem Schließen) die Reserve. Bisher kannte das Controlling
 * die Runde nicht — sie war eine Insel.
 *
 * Reiner Builder (`buildRoundWidget`) + impurer Loader (`loadRoundWidget`).
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { RoundStatus } from "@/modules/budgeting/domain/round-status";
import { resolveActiveCycle } from "@/modules/budgeting/domain/budget-cycle";
import { getRoundForCycle } from "@/modules/budgeting/server/services/round-service";
import { loadRoundBallot } from "@/modules/budgeting/server/services/ballot";

const STATUS_LABEL: Record<RoundStatus, string> = {
  draft: "Entwurf",
  running: "läuft",
  decided: "entschieden",
  closed: "abgeschlossen",
};

export interface RoundWidgetInputs {
  cycleKey: string;
  status: RoundStatus | null;
  poolTotal: number;
  reserveAmount: number | null;
  groupCount: number;
  ballotCount: number;
  decidedCount: number;
}

export interface RoundWidget {
  cycleKey: string;
  status: RoundStatus;
  statusLabel: string;
  poolTotal: number;
  /** Reserve nur nach dem Schließen aussagekräftig. */
  reserve: number | null;
  groupCount: number;
  ballotCount: number;
  decidedCount: number;
  /** Entscheidungs-Fortschritt 0..1 (entschiedene / Ballot). */
  decidedFraction: number;
  href: string;
}

/**
 * Faltet die geladenen Zahlen in das Widget-DTO. Rein: gibt `null` zurück, wenn
 * es für den aktiven Cycle keine Runde gibt (dann zeigt die Seite eine CTA).
 */
export function buildRoundWidget(i: RoundWidgetInputs): RoundWidget | null {
  if (i.status == null) return null;
  const decidedFraction = i.ballotCount > 0 ? Math.min(1, i.decidedCount / i.ballotCount) : 0;
  return {
    cycleKey: i.cycleKey,
    status: i.status,
    statusLabel: STATUS_LABEL[i.status],
    poolTotal: i.poolTotal,
    reserve: i.status === "closed" ? i.reserveAmount : null,
    groupCount: i.groupCount,
    ballotCount: i.ballotCount,
    decidedCount: i.decidedCount,
    decidedFraction,
    href: "/budgeting/rounds",
  };
}

/** Lädt die Runde des aktiven Cycles + Fortschrittszahlen und baut das Widget. */
export async function loadRoundWidget(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<RoundWidget | null> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { activeBudgetCycle: true },
  });
  const cycleKey = resolveActiveCycle(
    { activeBudgetCycle: tenant?.activeBudgetCycle ?? null },
    new Date(),
  );

  const round = await getRoundForCycle(db, tenantId, cycleKey);
  if (!round) {
    return buildRoundWidget({
      cycleKey,
      status: null,
      poolTotal: 0,
      reserveAmount: null,
      groupCount: 0,
      ballotCount: 0,
      decidedCount: 0,
    });
  }

  const [ballot, decidedCount] = await Promise.all([
    loadRoundBallot(db, tenantId),
    db.budgetDecision.count({ where: { roundId: round.id } }),
  ]);

  return buildRoundWidget({
    cycleKey,
    status: round.status as RoundStatus,
    poolTotal: Number(round.poolTotal),
    reserveAmount: round.reserveAmount != null ? Number(round.reserveAmount) : null,
    groupCount: round.groups.length,
    ballotCount: ballot.ballot.length,
    decidedCount,
  });
}
