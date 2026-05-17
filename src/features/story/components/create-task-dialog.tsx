"use client";

import { useActionState, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { createTaskAction } from "@/features/story/actions/task";
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

export interface CreateTaskDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied parent Story; when omitted an ART → Feature → Story cascade is shown. */
  storyId?: string;
  /** Route context used to pre-select ART / Feature in the global menu. */
  context?: CreateContext;
}

const initialState: ActionState = {};

export function CreateTaskDialog({ open, onOpenChange, storyId, context }: CreateTaskDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createTaskAction, initialState);
  useCreateResult(state, () => {
    setDialogOpen(false);
    formRef.current?.reset();
  });

  const pageScoped = storyId !== undefined;
  const [artSel, setArtSel] = useState(context?.artId ?? "");
  const [featureSel, setFeatureSel] = useState(context?.featureId ?? "");
  const [storySel, setStorySel] = useState("");

  return (
    <>
      {!isControlled && (
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1" />
          Add Task
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={action} className="space-y-4">
            {pageScoped ? (
              <input type="hidden" name="storyId" value={storyId} />
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
                    setFeatureSel("");
                    setStorySel("");
                  }}
                />
                <EntitySelect
                  kind="feature"
                  name="featureId"
                  label="Feature"
                  required
                  labelField="title"
                  params={{ artId: artSel }}
                  disabled={!artSel}
                  value={featureSel}
                  onChange={(v) => {
                    setFeatureSel(v);
                    setStorySel("");
                  }}
                />
                <EntitySelect
                  kind="story"
                  name="storyId"
                  label="Story"
                  required
                  labelField="title"
                  params={{ featureId: featureSel }}
                  disabled={!featureSel}
                  value={storySel}
                  onChange={setStorySel}
                />
              </>
            )}

            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input name="title" required placeholder="e.g. Wire up the API client" />
              {state.fieldErrors?.title && (
                <p className="text-xs text-destructive">{state.fieldErrors.title[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea name="description" rows={2} placeholder="Optional context…" />
            </div>

            <div className="space-y-1.5">
              <Label>Estimate (hours)</Label>
              <Input name="estimateHours" type="number" step="0.5" min={0.5} placeholder="4" />
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
