/**
 * Kanonische **Feature-Delivery-Status**-Union (SSOT) — die Schreibmaschine
 * `approved → in_progress ↔ blocked → completed | cancelled`. Wohnt in
 * **Work-Domain**, damit Work-Views (Roadmap) und das Drumbeat-Modul (via
 * `drumbeat/domain/status`) abwärts denselben Typ teilen, statt ihn mehrfach zu
 * definieren (ADR-0013). Rein, keine Logik.
 */

export const FEATURE_DELIVERY_STATUSES = [
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;

export type FeatureDeliveryStatus = (typeof FEATURE_DELIVERY_STATUSES)[number];
