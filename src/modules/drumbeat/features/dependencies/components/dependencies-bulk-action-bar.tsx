"use client";

import { useActionState, useEffect, startTransition } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unlinkDependencyBatchAction } from "@/modules/drumbeat/features/dependencies/actions/dependency";
import { unlinkDependencyBatchFormData } from "@/modules/drumbeat/features/dependencies/lib/dependency-actions-client";
import type { DependencyListRow } from "@/server/views/dependencies-list";

interface Props {
  selectedRows: DependencyListRow[];
  artId: string;
  onClear: () => void;
}

/**
 * Sticky bottom bar for the dependencies list. Calls
 * `unlinkDependencyBatchAction` (Round 3 batch mode, cap 50) to remove
 * many links at once. Confirms because deletion is irreversible.
 */
export function DependenciesBulkActionBar({ selectedRows, artId, onClear }: Props) {
  const [state, dispatch, pending] = useActionState(unlinkDependencyBatchAction, {});

  useEffect(() => {
    if (state.success) onClear();
  }, [state.success, onClear]);

  if (selectedRows.length === 0) return null;

  function unlink() {
    if (!window.confirm(`${selectedRows.length} Abhängigkeit(en) entfernen?`)) return;
    const fd = unlinkDependencyBatchFormData({
      dependencyIds: selectedRows.map((r) => r.id),
      artId,
    });
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium tabular-nums text-primary-foreground">
          {selectedRows.length} ausgewählt
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={unlink}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" /> Lösen
          </Button>
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
          <p role="alert" className="w-full text-xs text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
