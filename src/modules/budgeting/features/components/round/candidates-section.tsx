"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { setEpicFlagAction } from "@/modules/work/features/portfolio/actions/epic";
import { Button } from "@/components/ui/button";
import type { BudgetingCandidate } from "@/modules/budgeting/server/services/budgeting";

interface Props {
  candidates: BudgetingCandidate[];
}

/**
 * Inline-Vormerken: freigegebene Epics, die noch nicht in der Runde sind, mit
 * einem „Vormerken"-Knopf je Zeile (`setEpicFlagAction`, Capability `epic.update`).
 * So passiert Schritt 2 im Board-Kontext statt nur im Epic-Overview.
 */
export function CandidatesSection({ candidates }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (candidates.length === 0) return null;

  async function stage(id: string) {
    setPendingId(id);
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("flag", "budgeting");
    fd.set("value", "true");
    const res = await setEpicFlagAction({}, fd);
    setPendingId(null);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        Kandidaten vormerken
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {candidates.length} verfügbar
        </span>
      </summary>
      <div className="space-y-2 px-4 pb-4">
        <p className="text-xs text-muted-foreground">
          Epics mit freigegebener Hypothese oder freigegebenem Business Case, die noch nicht für diese
          Runde vorgemerkt sind.
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {candidates.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
          >
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
              {c.isHypothesisOnly ? "Hypothese" : "Business Case"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.valueStream ?? "Ohne Wertstrom"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto shrink-0"
              disabled={pendingId === c.id}
              onClick={() => stage(c.id)}
            >
              {pendingId === c.id ? "…" : "Vormerken"}
            </Button>
          </div>
        ))}
      </div>
    </details>
  );
}
