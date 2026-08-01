"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { decideProvisionAction } from "@/features/platform/actions/provision-actions";
import type { ProvisionRequestRow } from "@/server/services/tenant-provision";

const STATUS_LABEL: Record<string, string> = {
  pending: "Offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

/**
 * Provisioning-Anträge (Platform). Offene Anträge sind mit Genehmigen/Ablehnen
 * bedienbar; entschiedene zeigen nur ihren Status. Genehmigen legt den Tenant an
 * (via Service) und navigiert zur Detail-Ansicht.
 */
export function ProvisionRequestList({ requests }: { requests: ProvisionRequestRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (id: string, approve: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await decideProvisionAction(id, approve);
      if (res.error) setError(res.error);
      else router.refresh();
    });

  if (requests.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Keine Anträge.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y rounded-lg border">
        {requests.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.desiredName}</p>
              <p className="text-xs text-muted-foreground">
                {r.email} · {r.createdAt} · {STATUS_LABEL[r.status] ?? r.status}
              </p>
              {r.note && <p className="mt-1 text-xs text-muted-foreground/80">„{r.note}"</p>}
            </div>
            {r.status === "pending" ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => decide(r.id, true)}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  Genehmigen
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
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
