"use client";

import { useActionState, useState, startTransition } from "react";
import { Sparkles } from "lucide-react";
import { createTimelineFromStandardAction } from "@/modules/core/org/features/structure/actions/timeline";
import { Button } from "@/components/ui/button";
import type { PiStandard } from "@/modules/core/org/features/structure/components/pi-standards-manager";

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Bootstrap: spawns a new Timeline named after the chosen PI standard and
 * immediately applies the standard's PI series for the current year. Used in
 * the Structure Timeline toolbar when no Timelines exist yet.
 */
export function CreateTimelineFromStandard({ standards }: { standards: PiStandard[] }) {
  const [standardId, setStandardId] = useState(standards[0]?.id ?? "");
  const [state, run, pending] = useActionState(createTimelineFromStandardAction, {});

  if (standards.length === 0) return null;

  function apply() {
    if (!standardId) return;
    const fd = new FormData();
    fd.set("standardId", standardId);
    startTransition(() => run(fd));
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={SELECT_CLASS}
        value={standardId}
        onChange={(e) => setStandardId(e.target.value)}
        aria-label="PI-Standard"
      >
        {standards.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.cadenceWeeks} Wo · {s.piCount} PIs)
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={apply}>
        <Sparkles className="size-4 mr-1.5" />
        {pending ? "…" : "Timeline aus Standard"}
      </Button>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
