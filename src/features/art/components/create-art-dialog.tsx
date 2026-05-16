"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createArtAction } from "@/features/art/actions/art";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  valueStreams: { id: string; name: string }[];
}

export function CreateArtDialog({ valueStreams }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createArtAction, {});

  useEffect(() => {
    if (state.success) {
      toast.success("ART created");
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" />
        New ART
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Agile Release Train</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="art-vs">
                Value Stream <span className="text-destructive">*</span>
              </Label>
              <select
                id="art-vs"
                name="valueStreamId"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a value stream…</option>
                {valueStreams.map((vs) => (
                  <option key={vs.id} value={vs.id}>
                    {vs.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="art-name"
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Platform ART"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-cadence">PI Cadence (weeks)</Label>
              <Input
                id="art-cadence"
                name="piCadenceWeeks"
                type="number"
                min={8}
                max={12}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">Typical PI cadence is 10 weeks (8–12)</p>
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create ART"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
