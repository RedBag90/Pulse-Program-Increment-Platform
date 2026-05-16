"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";

/**
 * Subscribes to Supabase Realtime changes on the `initiatives` table scoped to
 * one sprint. Calls router.refresh() on any change so the Server-Component
 * Sprint Board reflects card movements made by other users (concept PULSE-32).
 *
 * Renders nothing — it exists purely to host the subscription effect inside an
 * otherwise server-rendered page.
 */
export function SprintRealtime({ sprintId }: { sprintId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`sprint:${sprintId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "initiatives",
          filter: `sprint_id=eq.${sprintId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sprintId, router]);

  return null;
}
