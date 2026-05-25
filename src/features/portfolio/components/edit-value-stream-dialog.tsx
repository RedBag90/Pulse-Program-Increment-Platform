"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateValueStreamAction } from "@/features/portfolio/actions/value-stream";
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

interface EditValueStreamDialogProps {
  id: string;
  name: string;
  description?: string | null;
}

export function EditValueStreamDialog({ id, name, description }: EditValueStreamDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(updateValueStreamAction, {});

  useEffect(() => {
    if (state.success) {
      toast.success("Value Stream updated");
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Value Stream</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={id} />

            <div className="space-y-1.5">
              <Label htmlFor="edit-vs-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="edit-vs-name" name="name" required defaultValue={name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-vs-description">Description</Label>
              <Textarea
                id="edit-vs-description"
                name="description"
                rows={3}
                defaultValue={description ?? ""}
              />
            </div>

            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
