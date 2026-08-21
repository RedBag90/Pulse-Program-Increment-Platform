/**
 * Canonical board/cockpit read-model shapes shared between the pure board
 * builder (`domain/board-matrix.ts`) and the server read-model
 * (`server/views/umsetzung-cockpit-view.ts`). They live in `domain/` so the
 * pure matrix helper imports **down**, not up into `server/views` (which would
 * be a layer inversion + latent cycle). The view re-exports them so existing
 * consumers keep their import path.
 */

export type FeatureStatus = "approved" | "in_progress" | "blocked" | "completed" | "cancelled";

export interface CockpitPiSlot {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  /** Anzahl Features im aktuell ausgewaehlten Scope, die in diesem PI sitzen. */
  featureCount: number;
  /** True wenn dieser PI das aktuelle „jetzt"-PI ist (laut Datum). */
  isCurrent: boolean;
}

export interface CockpitFeature {
  id: string;
  title: string;
  status: FeatureStatus;
  piId: string | null;
  artId: string;
  artName: string;
  /** Parent-Epic-Bezug — Cockpit-Roadmap gruppiert die Features
   *  darunter (Linear/Productboard-Pattern). Null = Orphan-Feature. */
  parentId: string | null;
  parentTitle: string | null;
  ownerId: string | null;
  /** UI loest Owner-Namen separat auf (Auth-Provider) — fuer Avatare /
   *  Inline-Anzeige. Null wenn unbekannt. */
  ownerName: string | null;
  wsjfComputed: number | null;
  /** True wenn das Feature mind. eine eingehende `blocks`-Dependency hat,
   *  die noch nicht abgeschlossen ist — gibt Board-Card das ⚠-Signal. */
  hasBlocker: boolean;
  /** Erste blockierende Quelle, fuer den Karten-Hinweis „blockt durch X". */
  blockerHint: string | null;
}
