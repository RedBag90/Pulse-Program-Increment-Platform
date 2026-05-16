"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createPiAction } from "@/features/pi/actions/pi";
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
  artId: string;
}

export function CreatePiDialog({ artId }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createPiAction, {});

  useEffect(() => {
    if (state.success) {
      toast.success("Program Increment created");
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" />
        New PI
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Program Increment</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="artId" value={artId} />

            <div className="space-y-1.5">
              <Label htmlFor="pi-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pi-name"
                name="name"
                required
                maxLength={100}
                placeholder="e.g. PI 2025-Q3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pi-start">
                  Start Date <span className="text-destructive">*</span>
                </Label>
                <Input id="pi-start" name="startDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pi-end">
                  End Date <span className="text-destructive">*</span>
                </Label>
                <Input id="pi-end" name="endDate" type="date" required />
              </div>
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
                {isPending ? "Creating…" : "Create PI"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
