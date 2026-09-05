/**
 * Die Epics hinter den Kandidaten, samt rekonstruierter Reifegrad-Historie.
 *
 * Eigene Datei, weil zwei Sichten sie brauchen: die ART-Budgetfläche und der
 * Wertstrom-Verlauf. Vorher lag sie in der ART-Sicht, und der Wertstrom
 * importierte quer hinein.
 *
 * Lag bis September 2026 in `server/views/`. Die Epics hinter den Kandidaten — ein Ladevorgang, den zwei Sichten teilen. Der Ordner `views/`
 * trägt Seitenmodelle — impurer Loader **plus** reiner Falter; wo der Falter
 * fehlt, ist es ein Vorgang und gehört zu den Services.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import {
  buildEpicStageTimeline,
  type StageTransition,
} from "@/modules/work/domain/epic-stage-timeline";

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
  /** Reifegrad-Verlauf, sofern geladen — sonst bleibt der Kurs leer. */
  stageTimeline?: StageTransition[] | undefined;
}

/** Lädt die Epics der Kandidaten samt rekonstruierter Reifegrad-Historie. */
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
    select: {
      id: true,
      title: true,
      stageGate: true,
      artId: true,
      implementationCompletedAt: true,
      // Reifegrad-Historie: aus diesen Stempeln rekonstruiert `buildEpicStageTimeline`,
      // in welchem Zustand das Epic in einem gegebenen Monat stand.
      createdAt: true,
      selectedForDetailingAt: true,
      hypothesisApprovedAt: true,
      selectedForAnalyzingAt: true,
      businessCaseApprovedAt: true,
      implementationStartedAt: true,
      impactRecognizedAt: true,
      timeline: true,
    },
  });

  const iso = (d: Date | null): string | null => (d == null ? null : d.toISOString());
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    stageGate: e.stageGate,
    artId: e.artId,
    implementationCompletedAt: e.implementationCompletedAt,
    stageTimeline: buildEpicStageTimeline({
      createdAt: e.createdAt.toISOString(),
      selectedForDetailingAt: iso(e.selectedForDetailingAt),
      hypothesisApprovedAt: iso(e.hypothesisApprovedAt),
      selectedForAnalyzingAt: iso(e.selectedForAnalyzingAt),
      businessCaseApprovedAt: iso(e.businessCaseApprovedAt),
      implementationStartedAt: iso(e.implementationStartedAt),
      impactRecognizedAt: iso(e.impactRecognizedAt),
      timeline: e.timeline,
    }),
  }));
}
