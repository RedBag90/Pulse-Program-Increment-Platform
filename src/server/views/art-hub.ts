/**
 * Page-Model fuer den ART-Hub (Roadmap-P3.A · Skelett + Active-PI-Hero).
 *
 * Wraps das bestehende `RteCockpitModel` und ergaenzt es um die
 * Naechster-PI-Sicht und eine kompakte PI-Historie. Reine Funktion —
 * kein DB-Zugriff. Die Seite liefert die rohen Daten + den
 * Cockpit-Output.
 */

import type { RteCockpitModel } from "@/server/views/rte-cockpit";

export interface ArtNextPi {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  /** Tage bis Start (negativ wenn schon laeuft / vorbei). */
  daysUntilStart: number;
  /** Anzahl assignter Features (Plan-Stand). */
  plannedFeatureCount: number;
  /** Anzahl Objectives — Pre-Check fuer startPi: je Team ≥ 1. */
  committedObjectiveCount: number;
}

export interface ArtHistoryPi {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  /** delivered/committed Anteil per Features (completed / total). */
  predictability: number | null;
  /** Confidence-Avg ueber die committed Objectives. */
  confidenceAvg: number | null;
}

const HISTORY_COMPLETED_STATUSES = new Set(["completed", "done"]);

/**
 * Pure-Helper, der aus geladenen Closed-PIs + Features + Objectives die
 * History-Zeilen ableitet. Wird vom Page-Loader genutzt und ist
 * unabhaengig testbar.
 */
export function buildArtHistory(input: {
  closedPis: { id: string; name: string; startDate: Date; endDate: Date }[];
  features: { piId: string; status: string }[];
  objectives: { piId: string; committed: boolean; confidence: number | null }[];
}): ArtHistoryPi[] {
  const featuresByPi = new Map<string, { total: number; completed: number }>();
  for (const f of input.features) {
    const b = featuresByPi.get(f.piId) ?? { total: 0, completed: 0 };
    b.total += 1;
    if (HISTORY_COMPLETED_STATUSES.has(f.status)) b.completed += 1;
    featuresByPi.set(f.piId, b);
  }

  const confidenceByPi = new Map<string, { sum: number; voted: number }>();
  for (const o of input.objectives) {
    if (!o.committed || o.confidence == null) continue;
    const b = confidenceByPi.get(o.piId) ?? { sum: 0, voted: 0 };
    b.sum += o.confidence;
    b.voted += 1;
    confidenceByPi.set(o.piId, b);
  }

  return input.closedPis.map((pi) => {
    const fb = featuresByPi.get(pi.id);
    const cb = confidenceByPi.get(pi.id);
    return {
      id: pi.id,
      name: pi.name,
      startDate: pi.startDate,
      endDate: pi.endDate,
      predictability: fb && fb.total > 0 ? fb.completed / fb.total : null,
      confidenceAvg: cb && cb.voted > 0 ? cb.sum / cb.voted : null,
    };
  });
}

export interface ArtHubInput {
  artId: string;
  artName: string;
  timelineName: string | null;
  cockpit: RteCockpitModel;
  nextPi: ArtNextPi | null;
  history: ArtHistoryPi[];
  /** Snapshot-Zeitpunkt fuer daysUntilStart-Berechnung. Default = `new Date()`. */
  now?: Date;
}

export interface ArtHubModel {
  artId: string;
  artName: string;
  timelineName: string | null;
  cockpit: RteCockpitModel;
  nextPi: ArtNextPi | null;
  history: ArtHistoryPi[];
}

export function buildArtHubModel(input: ArtHubInput): ArtHubModel {
  // Pass-through — die Heavy-Lifting passiert serverseitig in der Page;
  // dieses Model existiert hauptsaechlich als Vertrag fuer die Shell und
  // zur einfachen Erweiterung in P3.B (History-Snapshots).
  return {
    artId: input.artId,
    artName: input.artName,
    timelineName: input.timelineName,
    cockpit: input.cockpit,
    nextPi: input.nextPi,
    history: input.history,
  };
}
