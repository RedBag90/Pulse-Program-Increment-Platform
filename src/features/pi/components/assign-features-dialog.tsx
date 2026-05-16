"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { setFeaturePiAction } from "@/features/art/actions/feature";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Candidate {
  id: string;
  title: string;
  wsjfComputed: number | null;
  currentPiName: string | null;
}

interface Props {
  piId: string;
  artId: string;
  candidates: Candidate[];
}

export function AssignFeaturesDialog({ piId, artId, candidates }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await setFeaturePiAction([...selected], piId, artId);
      if (result.error) {
        setError(result.error);
      } else {
        toast.success(`${selected.size} feature${selected.size > 1 ? "s" : ""} added to PI`);
        setSelected(new Set());
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1" />
        Add Features
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Features to this PI</DialogTitle>
          </DialogHeader>

          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No assignable features in this ART. Create features under an Epic first.
            </p>
          ) : (
            <div className="rounded-md border divide-y max-h-80 overflow-y-auto">
              {candidates.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="rounded border-border"
                  />
                  <span className="flex-1 min-w-0 truncate">{f.title}</span>
                  {f.wsjfComputed !== null && (
                    <Badge variant="secondary" className="shrink-0">
                      WSJF {f.wsjfComputed.toFixed(2)}
                    </Badge>
                  )}
                  {f.currentPiName && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {f.currentPiName}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || selected.size === 0}
            >
              {isPending ? "Adding…" : selected.size > 0 ? `Add ${selected.size}` : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveFromPiButton({ featureId, artId }: { featureId: string; artId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await setFeaturePiAction([featureId], null, artId);
      if (result.error) setError(result.error);
      else toast.success("Feature removed from PI");
    });
  }

  return (
    <span className="flex items-center gap-1">
      {error && <span className="text-[10px] text-destructive">{error}</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
      >
        {isPending ? "…" : "Remove"}
      </Button>
    </span>
  );
}
