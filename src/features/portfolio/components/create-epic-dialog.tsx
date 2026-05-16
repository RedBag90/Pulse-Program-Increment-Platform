"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createEpicAction } from "@/features/portfolio/actions/epic";
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
import { Textarea } from "@/components/ui/textarea";

interface ValueStream {
  id: string;
  name: string;
}

interface CreateEpicDialogProps {
  valueStreams: ValueStream[];
}

export function CreateEpicDialog({ valueStreams }: CreateEpicDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createEpicAction, {});

  useEffect(() => {
    if (state.success) {
      toast.success("Epic created");
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" />
        New Epic
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Epic</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="epic-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input id="epic-title" name="title" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="epic-vs">
                Value Stream <span className="text-destructive">*</span>
              </Label>
              <select
                id="epic-vs"
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
              <Label htmlFor="epic-description">Description</Label>
              <Textarea id="epic-description" name="description" rows={3} />
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
                {isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
