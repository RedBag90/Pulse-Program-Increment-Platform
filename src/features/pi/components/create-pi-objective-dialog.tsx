"use client";

import { useActionState, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createPiObjectiveAction } from "@/features/pi/actions/pi-objective";
import type { ActionState } from "@/server/http/server-action";
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

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Team {
  id: string;
  name: string;
}

interface Props {
  piId: string;
  artId: string;
  teams: Team[];
}

const initialState: ActionState = {};

export function CreatePiObjectiveDialog({ piId, artId, teams }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createPiObjectiveAction, initialState);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1" />
        Add Objective
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add PI Objective</DialogTitle>
          </DialogHeader>
          <form
            ref={formRef}
            action={async (fd) => {
              await action(fd);
              if (!state.fieldErrors && !state.error) {
                toast.success("PI Objective added");
                setOpen(false);
                formRef.current?.reset();
              }
            }}
            className="space-y-4"
          >
            <input type="hidden" name="piId" value={piId} />
            <input type="hidden" name="artId" value={artId} />

            <div className="space-y-1.5">
              <Label>Team *</Label>
              <select name="teamId" required className={SELECT_CLASS}>
                <option value="">Select team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.teamId && (
                <p className="text-xs text-destructive">{state.fieldErrors.teamId[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input name="title" required placeholder="Deploy new payment service" />
              {state.fieldErrors?.title && (
                <p className="text-xs text-destructive">{state.fieldErrors.title[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea name="description" rows={2} placeholder="Optional details…" />
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5">
                <Label>Business Value (1–10)</Label>
                <Input name="businessValue" type="number" min={1} max={10} placeholder="8" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Type</Label>
                <select name="committed" className={SELECT_CLASS}>
                  <option value="true">Committed</option>
                  <option value="false">Uncommitted</option>
                </select>
              </div>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add Objective"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
