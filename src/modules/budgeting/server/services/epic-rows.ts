/**
 * Die Epics hinter den Kandidaten — Titel, Reifegrad, ART, Abschluss.
 *
 * Eigene Datei, weil zwei Sichten sie brauchten: die ART-Budgetfläche und der
 * Wertstrom-Verlauf. Den Verlauf gibt es seit dem 19.09.2026 nicht mehr; die
 * Datei bleibt trotzdem, weil sie ein Vorgang ist und kein Seitenmodell (der
 * Ordner `views/` trägt Lader **plus** Falter — hier fehlt der Falter).
 *
 * **Sie lud bis dahin die Reifegrad-Historie mit:** acht zusätzliche Spalten
 * je Epic samt dem JSON-Feld `timeline`, aus denen `buildEpicStageTimeline`
 * rekonstruierte, in welchem Zustand ein Epic in einem gegebenen Monat stand.
 * Gelesen hat das ausschliesslich der Verlauf. Mit ihm ist es entfallen — und
 * damit die einzige Stelle, an der Budgeting die Historie aus Work zog.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";

export interface CandidateRow {
  epicId: string;
  /** `null` = die Runde hat entschieden und nichts gegeben. */
  amount: number | null;
  ask: number;
  title: string;
  cycleKey: string;
  /** Nur eine abgeschlossene Kachel hat wirklich „nichts gegeben". */
  decided: boolean;
}

export interface EpicRow {
  id: string;
  title: string;
  stageGate: string;
  artId: string | null;
  implementationCompletedAt: Date | null;
}

/** Lädt die Epics der Kandidaten. */
export async function loadEpicRows(
  db: PrismaClient,
  tenantId: TenantId,
  candidates: readonly CandidateRow[],
): Promise<EpicRow[]> {
  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      id: { in: [...new Set(candidates.map((c) => c.epicId))] },
    },
    // Fünf Spalten. Die Zustandsstaffel braucht den Reifegrad und den
    // L4.2-Stempel, die Fläche den Titel, die Abweichungs-Anmerkung den ART.
    select: {
      id: true,
      title: true,
      stageGate: true,
      artId: true,
      implementationCompletedAt: true,
    },
  });

  return rows;
}
