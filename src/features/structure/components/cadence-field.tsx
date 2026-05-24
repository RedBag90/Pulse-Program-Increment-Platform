"use client";

import { useActionState } from "react";
import { updateArtAction } from "@/features/art/actions/art";

/** Inline editor for an ART's PI cadence (weeks) — posts the existing updateArt. */
export function CadenceField({ artId, value }: { artId: string; value: number }) {
  const [state, action, pending] = useActionState(updateArtAction, {});
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={artId} />
      <input
        type="number"
        name="piCadenceWeeks"
        min={8}
        max={12}
        defaultValue={value}
        aria-label="PI-Kadenz (Wochen)"
        className="w-14 rounded border border-input bg-background px-1.5 py-0.5 text-xs"
      />
      <span className="text-xs text-muted-foreground">Wo</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        {pending ? "…" : "Speichern"}
      </button>
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      {state.success && <span className="text-xs text-emerald-600">✓</span>}
    </form>
  );
}
