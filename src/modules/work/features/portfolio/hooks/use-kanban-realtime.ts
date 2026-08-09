"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";

/**
 * Subscribes to Supabase Realtime changes on the `initiatives` table for the
 * given tenant. Calls router.refresh() whenever an UPDATE arrives so the
 * Server Component re-fetches and the Kanban board reflects the latest state.
 *
 * Only watches UPDATE events — card movements are the only real-time concern
 * at this stage (creates/deletes are rare and handled by optimistic UI).
 */
export function useKanbanRealtime(tenantId: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`kanban:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "initiatives",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, router]);
}
