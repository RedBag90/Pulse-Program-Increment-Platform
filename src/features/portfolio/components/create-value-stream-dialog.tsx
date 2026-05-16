"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createValueStreamAction } from "@/features/portfolio/actions/value-stream";
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

export function CreateValueStreamDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createValueStreamAction, {});

  useEffect(() => {
    if (state.success) {
      toast.success("Value Stream created");
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" />
        New Value Stream
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Value Stream</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vs-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="vs-name" name="name" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vs-description">Description</Label>
              <Textarea id="vs-description" name="description" rows={3} />
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="vs-budget">Budget</Label>
                <Input id="vs-budget" name="budgetAmount" placeholder="100000.00" />
              </div>
              <div className="w-24 space-y-1.5">
                <Label htmlFor="vs-currency">Currency</Label>
                <Input id="vs-currency" name="budgetCurrency" maxLength={3} placeholder="EUR" />
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
                {isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
