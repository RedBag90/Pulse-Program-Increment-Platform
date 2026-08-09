"use client";

import { useCockpitRealtime } from "@/modules/drumbeat/features/umsetzung/hooks/use-cockpit-realtime";

/**
 * Mounts den Realtime-Hook ins Cockpit. Server-Component-Shell rendert
 * diesen Subscriber als Geschwister-Element; er selbst hat kein UI.
 */
export function CockpitRealtimeSubscriber({ tenantId }: { tenantId: string }) {
  useCockpitRealtime(tenantId);
  return null;
}
