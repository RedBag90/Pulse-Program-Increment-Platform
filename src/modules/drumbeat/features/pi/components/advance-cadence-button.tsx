"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { advanceCadenceAction } from "@/modules/drumbeat/features/pi/actions/pi";

/**
 * „PI abschließen & nächstes öffnen" — schreibt die Kadenz fort (aktives PI →
 * completed, nächstes → active; fehlendes nächstes PI wird erzeugt). Leichtes
 * Weiterrollen: offene Closure-Punkte blockieren nicht, sondern erscheinen als
 * Warn-Toast. Inline-Bestätigung, weil es die Zeitleiste bewegt. Genutzt im
 * Umsetzung-Cockpit-Strip und auf der PI-Detailseite.
 */
export function AdvanceCadenceButton({ piId }: { piId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function advance() {
    setPending(true);
    const res = await advanceCadenceAction(piId);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setConfirming(false);
    if (res.warnings && res.warnings.length > 0) {
      toast.warning(`Fortgeschrieben trotz offener Punkte: ${res.warnings.join(" · ")}`);
    } else {
      toast.success(`Kadenz fortgeschrieben${res.toName ? ` → ${res.toName}` : ""}`);
    }
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">Abschließen &amp; nächstes öffnen?</span>
        <Button type="button" size="sm" disabled={pending} onClick={advance}>
          {pending ? "…" : "Fortschreiben"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Abbrechen
        </Button>
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0"
      onClick={() => setConfirming(true)}
    >
      PI abschließen &amp; nächstes öffnen
    </Button>
  );
}
