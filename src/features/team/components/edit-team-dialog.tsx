"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateTeamAction } from "@/features/team/actions/team";
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

interface EditTeamDialogProps {
  id: string;
  artId: string;
  name: string;
}

export function EditTeamDialog({ id, artId, name }: EditTeamDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(updateTeamAction, {});

  useEffect(() => {
    if (state.success) {
      toast.success("Team updated");
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="artId" value={artId} />

            <div className="space-y-1.5">
              <Label htmlFor="edit-team-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="edit-team-name" name="name" required maxLength={100} defaultValue={name} />
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
