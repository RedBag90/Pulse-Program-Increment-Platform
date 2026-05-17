"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createTeamAction } from "@/features/team/actions/team";
import { useCreateResult } from "@/features/create/use-create-result";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
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

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Art {
  id: string;
  name: string;
}

export interface CreateTeamDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied parent ART; when omitted an ART select is shown. */
  artId?: string;
  /** Route context used to pre-select the ART in the global menu. */
  context?: CreateContext;
}

const initialState: ActionState = {};

export function CreateTeamDialog({ open, onOpenChange, artId, context }: CreateTeamDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(createTeamAction, initialState);
  useCreateResult(state, () => setDialogOpen(false));

  const needArt = artId === undefined;
  const arts = useEntityOptions<Art>(
    needArt ? optionsEndpoint("art") : null,
    needArt && dialogOpen,
  );

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          New Team
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            {artId !== undefined ? (
              <input type="hidden" name="artId" value={artId} />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="team-art">
                  ART <span className="text-destructive">*</span>
                </Label>
                <select
                  id="team-art"
                  name="artId"
                  required
                  defaultValue={context?.artId ?? ""}
                  disabled={arts.loading}
                  className={SELECT_CLASS}
                >
                  <option value="">{arts.loading ? "Loading…" : "Select an ART…"}</option>
                  {arts.data.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.name}
                    </option>
                  ))}
                </select>
                {arts.error && <p className="text-xs text-destructive">{arts.error}</p>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="team-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="team-name"
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Phoenix Team"
              />
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
                {isPending ? "Creating…" : "Create Team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
