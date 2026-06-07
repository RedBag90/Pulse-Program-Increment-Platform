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
