"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createArtAction } from "@/features/art/actions/art";
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

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ValueStream {
  id: string;
  name: string;
}

export interface CreateArtDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied value streams; when omitted they are fetched lazily. */
  valueStreams?: ValueStream[];
}

const initialState: ActionState = {};

export function CreateArtDialog({ open, onOpenChange, valueStreams }: CreateArtDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(createArtAction, initialState);
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
          New ART
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Agile Release Train</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="art-vs">
                Value Stream <span className="text-destructive">*</span>
              </Label>
              <select
                id="art-vs"
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
              <Label htmlFor="art-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="art-name"
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Platform ART"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-cadence">PI Cadence (weeks)</Label>
              <Input
                id="art-cadence"
                name="piCadenceWeeks"
                type="number"
                min={8}
                max={12}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">Typical PI cadence is 10 weeks (8–12)</p>
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
                {isPending ? "Creating…" : "Create ART"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
