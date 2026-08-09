"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { AlertOctagon, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  escalateImpedimentBatchAction,
  resolveImpedimentBatchAction,
} from "@/modules/drumbeat/features/impediment/actions/impediment";
import type { ImpedimentListRow } from "@/server/views/impediments-list";

interface Props {
  selectedRows: ImpedimentListRow[];
  artId: string;
  canEscalate: boolean;
  canResolve: boolean;
  onClear: () => void;
}

/**
 * Sticky bottom bar for the impediment list. Surfaces the two batch
 * actions (`resolveImpedimentBatchAction` and
 * `escalateImpedimentBatchAction`). Resolving collects a single shared
 * resolution string via a popover; escalating is one click.
 *
 * Selection-aware disabling: bulk-resolve requires every row to be non-
 * resolved; bulk-escalate requires every row to be `open`. The bar
 * shows a hint in either disabled case so the user knows why.
 */
export function ImpedimentsBulkActionBar({
  selectedRows,
  artId,
  canEscalate,
  canResolve,
  onClear,
}: Props) {
  const [resolveState, resolveDispatch, resolving] = useActionState(
    resolveImpedimentBatchAction,
    {},
  );
  const [escalateState, escalateDispatch, escalating] = useActionState(
    escalateImpedimentBatchAction,
    {},
  );
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const pending = resolving || escalating;

  useEffect(() => {
    if (resolveState.success || escalateState.success) {
      onClear();
      setOpen(false);
      setResolution("");
    }
  }, [resolveState.success, escalateState.success, onClear]);

  if (selectedRows.length === 0) return null;

  const allOpen = selectedRows.every((r) => r.status === "open");
  const anyResolved = selectedRows.some((r) => r.status === "resolved");

  function escalate() {
    const fd = new FormData();
    for (const r of selectedRows) fd.append("impedimentIds", r.id);
    fd.set("artId", artId);
    startTransition(() => escalateDispatch(fd));
  }

  function resolve() {
    if (resolution.trim() === "") return;
    const fd = new FormData();
    for (const r of selectedRows) fd.append("impedimentIds", r.id);
    fd.set("artId", artId);
    fd.set("resolution", resolution.trim());
    startTransition(() => resolveDispatch(fd));
  }

  const lastError = resolveState.error ?? escalateState.error;

  return (
    <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium tabular-nums text-primary-foreground">
          {selectedRows.length} ausgewählt
        </span>

        {anyResolved && (
          <span className="text-xs text-muted-foreground">
            Aufgelöste Einträge in der Auswahl — Aktionen begrenzt.
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {canEscalate && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !allOpen}
              onClick={escalate}
              title={allOpen ? "Alle Eskalieren" : "Nur offene Impediments eskalieren"}
            >
              <AlertOctagon className="size-3.5" /> Eskalieren
            </Button>
          )}
          {canResolve && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || anyResolved}
                    title={anyResolved ? "Aufgelöste entfernen" : "Auflösen"}
                  >
                    <Check className="size-3.5" /> Auflösen
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-80">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Gemeinsame Auflösung für {selectedRows.length} Impediment
                    {selectedRows.length === 1 ? "" : "s"} eintragen.
                  </p>
                  <Textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Wie wurde es gelöst?"
                    rows={3}
                    maxLength={2000}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || resolution.trim() === ""}
                    onClick={resolve}
                  >
                    {resolving ? "Speichert…" : "Bestätigen"}
                  </Button>
                </div>
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

        {lastError && (
          <p role="alert" className="w-full text-xs text-destructive">
            {lastError}
          </p>
        )}
      </div>
    </div>
  );
}
