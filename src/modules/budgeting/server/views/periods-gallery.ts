/**
 * Kachel-Gallery der Budgeting-Zeiträume (`/budgeting/periods`). Je Kachel eine
 * Runde. Reiner Builder (`buildPeriodsGallery`, `now` injiziert) + impurer Loader.
 *
 * Fokus-Ordnung: kommende + laufende Kacheln oben; abgeschlossene wandern
 * ausgegraut nach unten. Der Prozess-Status (`draft/running/decided/closed`) ist
 * unabhängig davon, ob der Budget-Zeitraum (`startDate`) schon begonnen hat.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";

export interface PeriodTile {
  id: string;
  cycleKey: string;
  label: string;
  status: string; // draft | running | decided | closed
  /** Budget-Zeitraum liegt (noch) in der Zukunft. */
  upcoming: boolean;
  poolTotal: number;
  participantCount: number;
  groupCount: number;
  submittedCount: number;
  startDate: Date | null;
  endDate: Date | null;
  submissionDeadline: Date | null;
  /** Offene Reserve einer abgeschlossenen Kachel (Grundlage des Übertrags). */
  reserveAmount: number;
  href: string;
}

export interface CarriableReserve {
  cycleKey: string;
  label: string;
  startDate: Date | null;
  amount: number;
}

export interface PeriodsGalleryModel {
  /** Kommende + laufende Kacheln (nicht abgeschlossen) — im Fokus. */
  focus: PeriodTile[];
  /** Abgeschlossene Kacheln — ausgegraut, nach unten. */
  past: PeriodTile[];
  /**
   * Abgeschlossene Kacheln mit offener Reserve — der Anlege-Dialog benennt sie,
   * damit der Reserve-Übertrag den Topf nicht mehr stillschweigend erhöht.
   * Neueste zuerst.
   */
  carriableReserves: CarriableReserve[];
  canManage: boolean;
}

export interface PeriodRoundInput {
  id: string;
  cycleKey: string;
  status: string;
  poolTotal: number;
  startDate: Date | null;
  endDate: Date | null;
  submissionDeadline: Date | null;
  participantCount: number;
  groupCount: number;
  submittedCount: number;
  reserveAmount: number;
}

function toTile(r: PeriodRoundInput, now: Date): PeriodTile {
  return {
    id: r.id,
    cycleKey: r.cycleKey,
    label: halfYearLabel(r.cycleKey),
    status: r.status,
    upcoming: r.startDate != null && r.startDate.getTime() > now.getTime(),
    poolTotal: r.poolTotal,
    participantCount: r.participantCount,
    groupCount: r.groupCount,
    submittedCount: r.submittedCount,
    startDate: r.startDate,
    endDate: r.endDate,
    submissionDeadline: r.submissionDeadline,
    reserveAmount: r.reserveAmount,
    href: `/budgeting/periods/${r.id}`,
  };
}

/** Sortier-Key: Start-Termin (fallback: cycleKey), neueste/späteste zuerst. */
function sortKey(t: PeriodTile): number {
  return t.startDate ? t.startDate.getTime() : 0;
}

/** Faltet die geladenen Runden in die Fokus-/Vergangen-Gruppen. Rein. */
export function buildPeriodsGallery(
  rounds: PeriodRoundInput[],
  canManage: boolean,
  now: Date,
): PeriodsGalleryModel {
  const tiles = rounds.map((r) => toTile(r, now));
  const byRecency = (a: PeriodTile, b: PeriodTile) =>
    sortKey(b) - sortKey(a) || b.cycleKey.localeCompare(a.cycleKey);
  const past = tiles.filter((t) => t.status === "closed").sort(byRecency);
  return {
    focus: tiles.filter((t) => t.status !== "closed").sort(byRecency),
    past,
    carriableReserves: past
      .filter((t) => t.reserveAmount > 0)
      .map((t) => ({
        cycleKey: t.cycleKey,
        label: t.label,
        startDate: t.startDate,
        amount: t.reserveAmount,
      })),
    canManage,
  };
}

/** Lädt alle Runden des Tenants + je Runde die Kennzahlen und baut das Modell. */
export async function loadPeriodsGallery(
  db: PrismaClient,
  tenantId: TenantId,
  canManage: boolean,
): Promise<PeriodsGalleryModel> {
  const rounds = await db.budgetRound.findMany({
    where: { tenantId },
    select: {
      id: true,
      cycleKey: true,
      status: true,
      poolTotal: true,
      startDate: true,
      endDate: true,
      submissionDeadline: true,
      reserveAmount: true,
      _count: { select: { participants: true, groups: true } },
      groups: { select: { submittedAt: true } },
    },
  });

  return buildPeriodsGallery(
    rounds.map((r) => ({
      id: r.id,
      cycleKey: r.cycleKey,
      status: r.status,
      poolTotal: Number(r.poolTotal),
      startDate: r.startDate,
      endDate: r.endDate,
      submissionDeadline: r.submissionDeadline,
      participantCount: r._count.participants,
      groupCount: r._count.groups,
      submittedCount: r.groups.filter((g) => g.submittedAt != null).length,
      reserveAmount: r.reserveAmount ? Number(r.reserveAmount) : 0,
    })),
    canManage,
    new Date(),
  );
}
