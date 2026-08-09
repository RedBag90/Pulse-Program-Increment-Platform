"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";

/**
 * Subscribed Supabase-Realtime auf die zwei Tabellen, die der
 * Netzplan-Render benoetigt: `initiatives` (Feature-Status, -Title,
 * -Type, -WSJF, neu/geloeschte Features) und `dependencies` (Edges).
 *
 * Auf jedes Event triggert ein `router.refresh()`, debounced 300 ms
 * gegen Storms (Quick-Add-Aktionen ruehren mehrere Rows in derselben
 * Transaktion).
 *
 * Filter ist auf `tenant_id` — Postgres-Changes koennen nicht ueber
 * Joins filtern. Refreshes von Aenderungen ausserhalb des aktuellen
 * Epics sind trotzdem billig (Page-Loader macht ein paar parallele
 * Queries) und kommen selten genug, um den Aufwand nicht zu
 * rechtfertigen, hier feiner zu filtern.
 */
export function useBreakdownRealtime(tenantId: string) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // 600 ms debounce: quick-add ruehrt mehrere rows in einer
      // transaktion an, server-action revalidate triggert sowieso
      // ein refresh — der hier ist der "andere user hat was geaendert"-
      // path. weniger aggressiv schont React + ReactFlow vor
      // race-conditions, die das canvas kurz weiss-flashen lassen.
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        router.refresh();
      }, 600);
    };

    const channel = supabase
      .channel(`breakdown:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "initiatives",
          filter: `tenant_id=eq.${tenantId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dependencies",
          filter: `tenant_id=eq.${tenantId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, router]);
}
