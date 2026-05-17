"use client";

import { useActionState, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { createKpiAction } from "@/features/portfolio/actions/kpi";
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

export interface CreateKpiDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied parent Epic; when omitted an Epic select is shown. */
  initiativeId?: string;
  /** Route context used to pre-select the Epic in the global menu. */
  context?: CreateContext;
}

const initialState: ActionState = {};

export function CreateKpiDialog({
  open,
  onOpenChange,
  initiativeId,
  context,
}: CreateKpiDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createKpiAction, initialState);
  useCreateResult(state, () => {
    setDialogOpen(false);
    formRef.current?.reset();
  });

  const pageScoped = initiativeId !== undefined;
  const [epicSel, setEpicSel] = useState(context?.epicId ?? "");

  return (
    <>
      {!isControlled && (
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1" />
          Add KPI
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add KPI</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={action} className="space-y-4">
            {pageScoped ? (
              <input type="hidden" name="initiativeId" value={initiativeId} />
            ) : (
              <EntitySelect
                kind="epic"
                name="initiativeId"
                label="Epic"
                required
                labelField="title"
                value={epicSel}
                onChange={setEpicSel}
              />
            )}

            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input name="name" required maxLength={200} placeholder="e.g. Conversion rate" />
              {state.fieldErrors?.name && (
                <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input name="unit" maxLength={40} placeholder="e.g. %" />
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1.5">
                <Label>Baseline</Label>
                <Input name="baseline" type="number" step="any" placeholder="0" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Target</Label>
                <Input name="target" type="number" step="any" placeholder="100" />
              </div>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add KPI"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
