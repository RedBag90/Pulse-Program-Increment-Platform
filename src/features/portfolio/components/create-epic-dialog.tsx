"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createEpicAction } from "@/features/portfolio/actions/epic";
import { useCreateResult } from "@/features/create/use-create-result";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
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

interface ValueStream {
  id: string;
  name: string;
}

export interface CreateEpicDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied value streams; when omitted they are fetched lazily. */
  valueStreams?: ValueStream[];
}

const initialState: ActionState = {};

export function CreateEpicDialog({ open, onOpenChange, valueStreams }: CreateEpicDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(createEpicAction, initialState);
  useCreateResult(state, () => setDialogOpen(false));

  const needFetch = valueStreams === undefined;
  const fetched = useEntityOptions<ValueStream>(
    needFetch ? optionsEndpoint("valueStream") : null,
    needFetch && dialogOpen,
  );
  const options = valueStreams ?? fetched.data;

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          New Epic
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                disabled={fetched.loading}
                className={SELECT_CLASS}
              >
                <option value="">{fetched.loading ? "Loading…" : "Select a value stream…"}</option>
                {options.map((vs) => (
                  <option key={vs.id} value={vs.id}>
                    {vs.name}
                  </option>
                ))}
              </select>
              {fetched.error && <p className="text-xs text-destructive">{fetched.error}</p>}
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
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
