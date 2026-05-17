"use client";

import { useActionState, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { createPiObjectiveAction } from "@/features/pi/actions/pi-objective";
import { useCreateResult } from "@/features/create/use-create-result";
import { EntitySelect } from "@/features/create/entity-select";
import type { CreateContext } from "@/features/create/create-context";
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

export interface CreatePiObjectiveDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied parent PI; when omitted an ART → PI + Team cascade is shown. */
  piId?: string;
  artId?: string;
  /** Page-supplied teams for the team select. */
  teams?: Team[];
  /** Route context used to pre-select ART / PI in the global menu. */
  context?: CreateContext;
}

const initialState: ActionState = {};

export function CreatePiObjectiveDialog({
  open,
  onOpenChange,
  piId,
  artId,
  teams,
  context,
}: CreatePiObjectiveDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createPiObjectiveAction, initialState);
  useCreateResult(state, () => {
    setDialogOpen(false);
    formRef.current?.reset();
  });

  const pageScoped = piId !== undefined && artId !== undefined;
  const [artSel, setArtSel] = useState(context?.artId ?? "");
  const [piSel, setPiSel] = useState(context?.piId ?? "");
  const [teamSel, setTeamSel] = useState("");

  return (
    <>
      {!isControlled && (
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1" />
          Add Objective
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add PI Objective</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={action} className="space-y-4">
            {pageScoped ? (
              <>
                <input type="hidden" name="piId" value={piId} />
                <input type="hidden" name="artId" value={artId} />
                <div className="space-y-1.5">
                  <Label>Team *</Label>
                  <select name="teamId" required className={SELECT_CLASS}>
                    <option value="">Select team…</option>
                    {(teams ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {state.fieldErrors?.teamId && (
                    <p className="text-xs text-destructive">{state.fieldErrors.teamId[0]}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <EntitySelect
                  kind="art"
                  name="artId"
                  label="ART"
                  required
                  labelField="name"
                  value={artSel}
                  onChange={(v) => {
                    setArtSel(v);
                    setPiSel("");
                    setTeamSel("");
                  }}
                />
                <EntitySelect
                  kind="pi"
                  name="piId"
                  label="Program Increment"
                  required
                  labelField="name"
                  params={{ artId: artSel }}
                  disabled={!artSel}
                  value={piSel}
                  onChange={setPiSel}
                />
                <EntitySelect
                  kind="team"
                  name="teamId"
                  label="Team"
                  required
                  labelField="name"
                  params={{ artId: artSel }}
                  disabled={!artSel}
                  value={teamSel}
                  onChange={setTeamSel}
                />
              </>
            )}

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
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
