/**
 * Prozess-Leiste der Budget-Runde — „wo stehe ich, was blockiert". Reiner
 * Builder (`buildProcessRail`) + impurer Loader (`loadProcessRailInputs`), nach
 * dem Vorbild der übrigen View-Nähte (impure load, pure build).
 *
 * Der Builder ist rein und unit-getestet; er kennt nur Zahlen, keine DB.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { getBudgetingBoard } from "@/modules/budgeting/server/services/budgeting";

export interface ProcessRailInputs {
  /** Σ Topf über alle Halbjahre. */
  poolTotal: number;
  /** Anzahl vorgemerkter, freigegebener Epics (Board-Population). */
  stagedCount: number;
  /** Σ aller Epic-Zuteilungen. */
  allocatedTotal: number;
  /** Anzahl gesetzter `ArtBudget`-Zeilen. */
  artRowCount: number;
  /** Gehört die jüngste Revision zum aktiven Zyklus? */
  latestIsCurrentCycle: boolean;
}

export interface ProcessStep {
  key: string;
  label: string;
  done: boolean;
  /** Vorbedingung fehlt (z. B. Zuteilen ohne Topf). */
  blocked: boolean;
  href: string;
}

/**
 * Faltet die Zahlen in die fünf verdichteten Prozessschritte. Rein: gleiche
 * Eingabe ⇒ gleiche Schritte; keine Uhr, keine DB.
 */
export function buildProcessRail(i: ProcessRailInputs): ProcessStep[] {
  const topf = i.poolTotal > 0;
  const vormerken = i.stagedCount > 0;
  const zuteilen = i.allocatedTotal > 0;
  const arts = i.artRowCount > 0;
  return [
    { key: "topf", label: "Topf setzen", done: topf, blocked: false, href: "/budgeting/round?level=pool" },
    {
      key: "vormerken",
      label: "Epics vormerken",
      done: vormerken,
      blocked: false,
      href: "/budgeting/round?level=pool",
    },
    { key: "zuteilen", label: "Zuteilen", done: zuteilen, blocked: !topf, href: "/budgeting/round?level=pool" },
    {
      key: "arts",
      label: "ARTs verteilen",
      done: arts,
      blocked: !zuteilen,
      href: "/budgeting/round?level=art",
    },
    { key: "snapshot", label: "Snapshot", done: i.latestIsCurrentCycle, blocked: !zuteilen, href: "/budgeting" },
  ];
}

/**
 * Lädt die Zahlen für die Prozess-Leiste (ohne die Snapshot-Info, die der
 * Aufrufer schon aus dem Controlling-Modell hat).
 */
export async function loadProcessRailInputs(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Omit<ProcessRailInputs, "latestIsCurrentCycle">> {
  const [board, artRowCount] = await Promise.all([
    getBudgetingBoard(db, tenantId),
    db.artBudget.count({ where: { tenantId } }),
  ]);
  const poolTotal = Object.values(board.pool).reduce((s, v) => s + v, 0);
  const allocatedTotal = board.epics.reduce(
    (s, e) => s + Object.values(e.allocations).reduce((a, b) => a + b, 0),
    0,
  );
  return { poolTotal, stagedCount: board.epics.length, allocatedTotal, artRowCount };
}
