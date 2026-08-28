/**
 * Status-Registry (SSOT) für das Drumbeat-Modul — **eine** Quelle für die drei
 * Statusachsen und ihre deutschen Labels. Rein (nur Typen + Text), keine Farben/
 * JSX (die liegen in der Präsentations-Schicht `features/lib/status-badges`).
 *
 * - **Feature-Delivery-Status** spiegelt die Work-Schreibmaschine
 *   (`FeatureDeliveryStatus`, `work/.../feature.ts`) — hier als `FeatureStatus`
 *   für die Cockpit-Lesemodelle. `assertSameFeatureStatus` unten sichert per
 *   Compile-Time, dass beide Unions nicht auseinanderlaufen.
 * - **PI-Status** und **Dependency-Typ** werden aus ihren kanonischen Domain-
 *   Modulen re-exportiert (`pi-rules`, `graph-scope`), damit es je Konzept genau
 *   einen Typ gibt.
 *
 * `UI Deutsch, Code Englisch`: Code-Werte englisch, Labels deutsch.
 */

import type { FeatureDeliveryStatus } from "@/modules/work/domain/feature-status";
import { PI_STATUSES, type PiStatus } from "@/modules/drumbeat/domain/pi-rules";
import { DEPENDENCY_TYPES, type DependencyType } from "@/modules/drumbeat/domain/graph-scope";

export { PI_STATUSES, DEPENDENCY_TYPES };
export type { PiStatus, DependencyType };

// ── Feature-Delivery-Status ───────────────────────────────────────────────────

export const FEATURE_STATUSES = [
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;
export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

/** Compile-Time-Wächter: `FeatureStatus` bleibt deckungsgleich mit der Work-Union. */
type _AssertFeatureStatus = FeatureStatus extends FeatureDeliveryStatus
  ? FeatureDeliveryStatus extends FeatureStatus
    ? true
    : never
  : never;
export const assertSameFeatureStatus: _AssertFeatureStatus = true;

/** Deutsche Anzeige-Labels je Delivery-Status (überall dasselbe Wort). */
export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  approved: "Freigegeben",
  in_progress: "In Umsetzung",
  blocked: "Blockiert",
  completed: "Abgeschlossen",
  cancelled: "Verworfen",
};

// ── PI-Status ─────────────────────────────────────────────────────────────────

export const PI_STATUS_LABELS: Record<PiStatus, string> = {
  planned: "Geplant",
  active: "Aktiv",
  completed: "Abgeschlossen",
};

// ── Dependency-Typ (ein deutsches Vokabular) ─────────────────────────────────

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  blocks: "blockiert",
  depends_on: "hängt ab von",
  relates_to: "bezieht sich auf",
};
