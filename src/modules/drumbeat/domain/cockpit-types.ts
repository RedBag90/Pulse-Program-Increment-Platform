/**
 * Canonical board/cockpit read-model shapes shared between the pure board
 * builder (`domain/board-matrix.ts`) and the server read-model
 * (`server/views/umsetzung-cockpit-view.ts`). They live in `domain/` so the
 * pure matrix helper imports **down**, not up into `server/views` (which would
 * be a layer inversion + latent cycle). The view re-exports them so existing
 * consumers keep their import path.
 */

// FeatureStatus ist der Delivery-Status — SSOT in `domain/status.ts`
// (spiegelt Work-`FeatureDeliveryStatus`). Re-Export, damit bestehende
// Importpfade (`board-matrix`, `view`) unverändert bleiben.
export type { FeatureStatus } from "@/modules/drumbeat/domain/status";
import type { PiStatus } from "@/modules/drumbeat/domain/pi-rules";
import type { FeatureBreakdown } from "@/modules/work/domain/feature-breakdown";

/** Status einer Board-Spalte: PI-Status oder die synthetische Backlog-Spalte. */
export type BoardColumnStatus = PiStatus | "backlog";

export interface CockpitPiSlot {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: BoardColumnStatus;
  /** Anzahl Features im aktuell ausgewaehlten Scope, die in diesem PI sitzen. */
  featureCount: number;
  /** True wenn dieser PI das aktuelle „jetzt"-PI ist (laut Datum). */
  isCurrent: boolean;
}

/**
 * Cockpit-Read-Model eines Features: der Work-eigene `FeatureBreakdown`-Read-Port
 * (Titel/Status/ART/Parent/Owner) **plus** die drumbeat-spezifischen Anreicherungen
 * (PI-Zuordnung, Blocker-Signale, aufgelöster Owner-Name). Drumbeat besitzt die
 * Feature-Lesegestalt nicht mehr selbst, sondern erweitert den Work-Port (ADR-0013).
 */
export interface CockpitFeature extends FeatureBreakdown {
  /** PI-Zuordnung (Drumbeat-Kadenz); `null` = Backlog. */
  piId: string | null;
  /** UI loest Owner-Namen separat auf (Auth-Provider) — fuer Avatare /
   *  Inline-Anzeige. Null wenn unbekannt. */
  ownerName: string | null;
  /** True wenn das Feature mind. eine eingehende `blocks`-Dependency hat,
   *  die noch nicht abgeschlossen ist — gibt Board-Card das ⚠-Signal. */
  hasBlocker: boolean;
  /** Erste blockierende Quelle, fuer den Karten-Hinweis „blockt durch X". */
  blockerHint: string | null;
}
