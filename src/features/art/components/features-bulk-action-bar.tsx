"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setFeaturePiAction } from "@/features/art/actions/feature";
import type { FeatureListRow, PiOption } from "@/server/views/features-list";

interface Props {
  selectedRows: FeatureListRow[];
  artId: string;
  canEdit: boolean;
  assignablePis: PiOption[];
  onClear: () => void;
}

/**
 * Sticky bottom bar for the feature backlog. Appears when ≥ 1 row is
 * selected and surfaces the bulk PI assignment via the existing batch
 * `setFeaturePiAction`. The popover lets the user pick a target PI (or
 * "Backlog" to unassign). Mirrors the epics bulk bar.
 */
export function FeaturesBulkActionBar({
  selectedRows,
  artId,
  canEdit,
  assignablePis,
  onClear,
}: Props) {
  const [state, dispatch, pending] = useActionState(setFeaturePiAction, {});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.success) {
      onClear();
      setOpen(false);
    }
  }, [state.success, onClear]);

  if (selectedRows.length === 0) return null;

  function moveTo(piId: string) {
    const fd = new FormData();
    for (const r of selectedRows) fd.append("featureIds", r.id);
    fd.set("piId", piId);
    fd.set("artId", artId);
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium tabular-nums text-primary-foreground">
          {selectedRows.length} ausgewählt
        </span>

        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                render={
                  <Button type="button" size="sm" disabled={pending}>
                    <ArrowRight className="size-3.5" /> PI zuweisen
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-64">
                <p className="px-2 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Ziel-PI wählen
                </p>
                <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto text-sm">
                  <li>
                    <button
                      type="button"
                      onClick={() => moveTo("")}
                      disabled={pending}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 disabled:opacity-50"
                    >
                      <span>← Backlog</span>
                    </button>
                  </li>
                  {assignablePis.length === 0 ? (
                    <li className="px-2 py-1.5 text-xs text-muted-foreground">
                      Keine zuweisbaren PIs vorhanden.
                    </li>
                  ) : (
                    assignablePis.map((pi) => (
                      <li key={pi.id}>
                        <button
                          type="button"
                          onClick={() => moveTo(pi.id)}
                          disabled={pending}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 disabled:opacity-50"
                        >
                          <span>{pi.name}</span>
                          {pi.status === "active" && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                              aktiv
                            </span>
                          )}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </PopoverContent>
            </Popover>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClear}
            aria-label="Auswahl aufheben"
            className="size-8"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {state.error && (
          <p role="alert" className="mt-1 w-full text-xs text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
