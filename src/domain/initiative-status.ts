/**
 * Delivery state machine fuer Features — pure, no I/O.
 *
 * QS-Gate (`draft → in_review → approved`) ist abgeschafft (2026-06-13):
 * Features starten direkt im Delivery-Lebenszyklus ab `approved` (= UI-
 * Lane „Bereit"). Bestands-Eintraege in `draft`/`in_review` wurden per
 * Backfill auf `approved` migriert. Epics nutzen den separaten
 * `approvalPhase`-Pfad und sind hiervon nicht betroffen.
 */

/** The delivery lifecycle statuses for a Feature. */
export const DELIVERY_STATUSES = [
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/**
 * Allowed delivery transitions. `cancelled` is reachable from every live state
 * (the work is abandoned); `completed` only from `in_progress` (a Feature in
 * `blocked` must resume before it can be marked done). Terminal states have no
 * outgoing edges.
 */
const DELIVERY_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  approved: ["in_progress", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

/** True when `to` is a permitted delivery transition from `from`. */
export function canDeliveryTransition(from: string, to: string): boolean {
  return (DELIVERY_TRANSITIONS[from as DeliveryStatus] ?? []).includes(to as DeliveryStatus);
}
