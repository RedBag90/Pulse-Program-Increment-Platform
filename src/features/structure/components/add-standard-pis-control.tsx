"use client";

import { useActionState, useState, startTransition } from "react";
import { addStandardPisAction } from "@/features/structure/actions/pi-standard";
import { Button } from "@/components/ui/button";

const SELECT_CLASS =
  "h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface PiStandardOption {
  id: string;
  name: string;
}

/**
 * Per-ART control in the Structure Timeline: pick a named PI standard and add
 * its current-year PIs to the ART. Only PIs whose period is free are added
 * (overlap-skip), so re-applying is idempotent. Gated by `canCreatePi`.
 */
export function AddStandardPisControl({
  artId,
  standards,
}: {
  artId: string;
  standards: PiStandardOption[];
}) {
  const [standardId, setStandardId] = useState(standards[0]?.id ?? "");
  const [state, run, pending] = useActionState(addStandardPisAction, {});

  if (standards.length === 0) return null;

  function apply() {
    if (!standardId) return;
    const fd = new FormData();
    fd.set("artId", artId);
    fd.set("standardId", standardId);
    startTransition(() => run(fd));
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <select
          className={SELECT_CLASS}
          value={standardId}
          onChange={(e) => setStandardId(e.target.value)}
          aria-label="PI-Standard"
        >
          {standards.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={apply}>
          {pending ? "…" : "+ Standard"}
        </Button>
      </div>
      {state?.error && <p className="text-[10px] text-destructive">{state.error}</p>}
      {state?.success && <p className="text-[10px] text-muted-foreground">Standard-PIs ergänzt.</p>}
    </div>
  );
}
