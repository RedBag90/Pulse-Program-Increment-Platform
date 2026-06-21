"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createTimelineAction } from "@/features/structure/actions/timeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateTimelineButton() {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(createTimelineAction, {});

  // Close on success (state.success flips true) — simple and matches other dialogs.
  if (state?.success && open) {
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" />
        Neue Timeline
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Timeline anlegen</DialogTitle>
          </DialogHeader>
          <form action={run} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="timeline-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="timeline-name"
                name="name"
                required
                maxLength={100}
                placeholder="z. B. Quartalskadenz Bank"
              />
            </div>
            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Anlegen…" : "Anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
