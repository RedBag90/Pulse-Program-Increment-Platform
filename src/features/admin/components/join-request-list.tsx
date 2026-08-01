"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideJoinRequestAction } from "@/features/admin/actions/join-request-actions";
import type { JoinRequestRow } from "@/server/views/join-requests";

/**
 * Offene Beitritts-Anfragen des aktiven Tenants mit Freigeben/Ablehnen
 * (tenant_admin). Direkt-Aufruf der Server-Action über useTransition.
 */
export function JoinRequestList({ requests }: { requests: JoinRequestRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (id: string, approve: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await decideJoinRequestAction(id, approve);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  if (requests.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Keine offenen Anfragen.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y rounded-lg border">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.email}</p>
              <p className="text-xs text-muted-foreground">
                via {r.via === "link" ? "Link" : "Code"} · {r.createdAt}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={isPending}
                onClick={() => decide(r.id, true)}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Freigeben
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => decide(r.id, false)}
                className="rounded-md border px-3 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
              >
                Ablehnen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
