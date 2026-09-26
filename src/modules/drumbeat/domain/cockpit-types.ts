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
import type { JobSizeTarget } from "@/modules/drumbeat/domain/pi-job-size-target";

/**
 * Status einer Board-Spalte: PI-Status oder eine der beiden synthetischen
 * Spalten.
 *
 * `"overflow"` sammelt Features, deren PI **außerhalb des Fünf-PI-Fensters**
 * liegt. Ohne sie fielen sie zwischen `columns` und `features` hindurch und
 * verschwanden stumm vom Board — während der Zähler daneben sie mitzählte. Eine
 * Arbeit, die niemand sieht, ist schlimmer als eine, die schlecht aussieht.
 */
export type BoardColumnStatus = PiStatus | "backlog" | "overflow";

export interface CockpitPiSlot {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: BoardColumnStatus;
  /** Anzahl Features im aktuell ausgewaehlten Scope, die in diesem PI sitzen. */
  featureCount: number;
  /**
   * Σ Job Size der Features in diesem PI — aus **derselben** Menge wie
   * `featureCount`.
   *
   * Ein PI-Titel sagte bis September 2026 nur, *wie viele* Vorhaben darunter
   * liegen. Wie viel Arbeit das ist, stand nirgends; die Kapazität daneben war
   * gepflegt und wurde gegen nichts gestellt.
   */
  plannedJobSize: number;
  /**
   * Die Kapazitätszahl des ARTs in diesem PI (`ArtPiCapacity`); `null` =
   * keine eingetragen. Eingang der Formel, kein Ziel.
   */
  capacity: number | null;
  /**
   * Das **errechnete** Job-Size-Ziel samt Herleitung
   * (`deriveJobSizeTarget`). `null` nur für Spalten, die kein PI sind
   * (Backlog, außerhalb des Fensters).
   */
  jobSizeTarget: JobSizeTarget | null;
  /**
   * JS je Kapazität **dieses** PI — nur für abgeschlossene PIs mit Kapazität.
   * So stehen die Eingangswerte der Formel dort, wo sie entstanden sind.
   */
  deliveredPerCapacity: number | null;
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
  /** Der Aufwand; er summiert sich unter dem PI-Titel. `null` = unbewertet. */
  wsjfJobSize: number | null;
  /** Die drei WSJF-Zähler — Vorbelegung des Dialogs auf der Karte. */
  wsjfBusinessValue: number | null;
  wsjfTimeCriticality: number | null;
  wsjfRiskReduction: number | null;
  /** UI loest Owner-Namen separat auf (Auth-Provider) — fuer Avatare /
   *  Inline-Anzeige. Null wenn unbekannt. */
  ownerName: string | null;
  /** True wenn das Feature mind. eine eingehende `blocks`-Dependency hat,
   *  die noch nicht abgeschlossen ist — gibt Board-Card das ⚠-Signal. */
  hasBlocker: boolean;
  /** Erste blockierende Quelle, fuer den Karten-Hinweis „blockt durch X". */
  blockerHint: string | null;
  /**
   * Name der **Primär-Solution des Epics**, an dem dieses Feature hängt;
   * `null`, wenn das Epic keine trägt (gemessen 40 % der Features).
   *
   * Die Solution hängt am Epic (`Initiative.primarySolutionId`), nicht am
   * Feature — auf der Karte steht sie trotzdem: im Betrieb muss man sehen, zu
   * welchem Produkt die Arbeit gehört, nicht nur zu welchem Vorhaben.
   */
  solutionName: string | null;
}
