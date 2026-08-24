/**
 * Eine Prozess-Leiste über den ganzen Budget-Fluss (F-A2/F-C4) — ersetzt die
 * zwei rivalisierenden Rails (die 4-Schritt-PB-Stepper und die 5-Schritt-€-Rail).
 *
 * Sechs Schritte, status-getrieben: **Einreichung · Rahmen & Gruppen · Erfassung
 * & Zonen · Entscheidung · €/ART-Detail · Protokoll**. Jeder Schritt trägt
 * `done|blocked` (die aktive Position leitet die Präsentation aus dem ersten
 * nicht-erledigten, nicht-blockierten Schritt ab) und einen Deep-Link.
 *
 * Reiner Builder (`buildBudgetProcessRail`) + impurer Loader
 * (`loadBudgetProcessInputs`), nach dem Vorbild der übrigen View-Nähte.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { RoundStatus } from "@/modules/budgeting/domain/round-status";
import { resolveActiveCycle } from "@/modules/budgeting/domain/budget-cycle";
import { getBudgetingBoard } from "@/modules/budgeting/server/services/budgeting";
import { loadRoundBallot } from "@/modules/budgeting/server/services/ballot";
import { getRoundForCycle } from "@/modules/budgeting/server/services/round-service";

export interface ProcessStep {
  key: string;
  label: string;
  done: boolean;
  /** Vorbedingung fehlt (z. B. Entscheidung ohne laufende Runde). */
  blocked: boolean;
  href: string;
}

export interface BudgetProcessInputs {
  /** Status der Runde des aktiven Cycles — `null`, wenn noch keine Runde. */
  roundStatus: RoundStatus | null;
  /** Vorgemerkte, einreichungsbereite Epics (Einreichung). */
  stagedCount: number;
  /** Σ aller €/ART-Zuteilungen (Detailplanung). */
  allocatedTotal: number;
  /** Gehört die jüngste Revision zum aktiven Zyklus (Protokoll)? */
  latestIsCurrentCycle: boolean;
}

const HREF_ROUND = "/budgeting/rounds";
const HREF_DETAIL = "/budgeting/round";
const HREF_OVERVIEW = "/budgeting";

/** Runden-Reihenfolge → Index (draft=0 … closed=3), −1 = keine Runde. */
const ORDER: RoundStatus[] = ["draft", "running", "decided", "closed"];

/**
 * Faltet Runden-Status + nachgelagerten Zustand in die sechs Prozessschritte.
 * Rein: gleiche Eingabe ⇒ gleiche Schritte; keine Uhr, keine DB.
 */
export function buildBudgetProcessRail(i: BudgetProcessInputs): ProcessStep[] {
  const idx = i.roundStatus ? ORDER.indexOf(i.roundStatus) : -1;
  const roundClosed = i.roundStatus === "closed";
  const allocated = i.allocatedTotal > 0;
  // Vor dem Schließen ist die Detailplanung blockiert, sofern noch nichts
  // zugeteilt wurde (die Vorbefüllung beim Schließen setzt den Startwert).
  const detailBlocked = !roundClosed && !allocated;

  return [
    { key: "einreichung", label: "Einreichung", done: i.stagedCount > 0, blocked: false, href: HREF_ROUND },
    { key: "rahmen", label: "Rahmen & Gruppen", done: idx >= 1, blocked: false, href: HREF_ROUND },
    { key: "erfassung", label: "Erfassung & Zonen", done: idx >= 2, blocked: idx < 0, href: HREF_ROUND },
    { key: "entscheidung", label: "Entscheidung", done: idx >= 3, blocked: idx < 1, href: HREF_ROUND },
    { key: "detail", label: "€/ART-Detail", done: allocated, blocked: detailBlocked, href: HREF_DETAIL },
    { key: "protokoll", label: "Protokoll", done: i.latestIsCurrentCycle, blocked: detailBlocked, href: HREF_OVERVIEW },
  ];
}

/**
 * Lädt die Zahlen für die Prozess-Leiste (ohne die Snapshot-Info, die der
 * Aufrufer schon aus dem Controlling-/Board-Modell hat).
 */
export async function loadBudgetProcessInputs(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Omit<BudgetProcessInputs, "latestIsCurrentCycle"> & { poolTotal: number }> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { activeBudgetCycle: true },
  });
  const cycleKey = resolveActiveCycle(
    { activeBudgetCycle: tenant?.activeBudgetCycle ?? null },
    new Date(),
  );

  const [board, ballot, round] = await Promise.all([
    getBudgetingBoard(db, tenantId),
    loadRoundBallot(db, tenantId),
    getRoundForCycle(db, tenantId, cycleKey),
  ]);

  const poolTotal = Object.values(board.pool).reduce((s, v) => s + v, 0);
  const allocatedTotal = board.epics.reduce(
    (s, e) => s + Object.values(e.allocations).reduce((a, b) => a + b, 0),
    0,
  );

  return {
    roundStatus: (round?.status as RoundStatus | undefined) ?? null,
    stagedCount: ballot.ballot.length,
    allocatedTotal,
    poolTotal,
  };
}
