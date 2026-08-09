"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";

/**
 * Subscribed Supabase-Realtime auf die zwei Tabellen, die der Cockpit
 * rendert: `initiatives` (Feature-Status, PI-Zuordnung, Erstellung,
 * Loeschung) und `dependencies` (Blocker-Hinweise). Auf jedes Event
 * triggert ein router.refresh() — die Page-Component laedt das Model
 * neu, Sub-Komponenten rendern via memo nur wo noetig.
 *
 * Filter ist auf `tenant_id`, weil Postgres-Changes nicht ueber Joins
 * filtern koennen. Refreshes von Aenderungen ausserhalb des aktuell
 * gewaehlten ARTs sind billig (paar parallele Queries) und kommen
 * selten — feinerer Filter rechnet sich nicht. Debounce 600 ms schont
 * React vor Bulk-Aktionen, die mehrere Rows in einer Transaktion ruehren.
 */
export function useCockpitRealtime(tenantId: string) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        router.refresh();
      }, 600);
    };

    const channel = supabase
      .channel(`cockpit:${tenantId}`)
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
