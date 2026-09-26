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
export const FEATURE_STATUS_KEYS: Record<FeatureStatus, string> = {
  approved: "drumbeat.featureStatus.approved",
  in_progress: "drumbeat.featureStatus.inProgress",
  blocked: "drumbeat.featureStatus.blocked",
  completed: "drumbeat.featureStatus.completed",
  cancelled: "drumbeat.featureStatus.cancelled",
};

/**
 * **Braucht dieser Statuswechsel eine Begründung?**
 *
 * „Blockiert" und „Verworfen" halten Arbeit an. Wer das tut, schuldet dem Rest
 * des Zuges einen Satz dazu — sonst steht später eine tote Karte im Board und
 * niemand weiß mehr, warum.
 *
 * Die Regel stand zweimal wörtlich im Board (Drop und Tastatur-Menü) und
 * **fehlte** in der Tabelle und in der Bulk-Leiste. Dieselbe Handlung folgte je
 * nach Weg zwei verschiedenen Regeln — kein Komfort, sondern ein Loch: wer den
 * Grund nicht angeben wollte, nahm die Tabelle.
 */
export function needsReasonForStatus(next: FeatureStatus): boolean {
  return next === "blocked" || next === "cancelled";
}

// ── PI-Status ─────────────────────────────────────────────────────────────────

export const PI_STATUS_KEYS: Record<PiStatus, string> = {
  planned: "drumbeat.piStatus.planned",
  active: "drumbeat.piStatus.active",
  completed: "drumbeat.piStatus.completed",
};

// ── Dependency-Typ (ein deutsches Vokabular) ─────────────────────────────────

export const DEPENDENCY_TYPE_KEYS: Record<DependencyType, string> = {
  blocks: "drumbeat.dependencyType.blocks",
  relates_to: "drumbeat.dependencyType.relatesTo",
};
