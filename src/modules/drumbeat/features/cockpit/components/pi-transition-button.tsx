"use client";

import { useTransition, useState } from "react";
import { PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { transitionPiAction } from "@/modules/drumbeat/features/cockpit/actions/pi";
import { Button } from "@/components/ui/button";

interface Props {
  piId: string;
  currentStatus: string;
}

/**
 * Startet ein geplantes PI (planned → active). Das Abschließen läuft über
 * „PI abschließen & nächstes öffnen" (`AdvanceCadenceButton`) — der strenge
 * Complete-PI-Weg ist entfallen (Spec WP2). Darum rendert dieser Button nur
 * für geplante PIs; für aktive/abgeschlossene ist er unsichtbar.
 */
export function PiTransitionButton({ piId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (currentStatus !== "planned") return null;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await transitionPiAction(piId);
      if (result.error) setError(result.error);
      else toast.success("PI started");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={isPending} size="sm">
        <PlayCircle className="size-4 mr-1.5" />
        {isPending ? "Saving…" : "Start PI"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
