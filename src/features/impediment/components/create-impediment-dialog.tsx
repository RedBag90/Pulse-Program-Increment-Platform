"use client";

import { useActionState, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createImpedimentAction } from "@/features/impediment/actions/impediment";
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
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Art {
  id: string;
  name: string;
}

export interface CreateImpedimentDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied parent ART; when omitted an ART select is shown. */
  artId?: string;
  /** Route context used to pre-select the ART in the global menu. */
  context?: CreateContext;
  /** Called after a successful create (page-level list refresh). */
  onCreated?: () => void;
}

const initialState: ActionState = {};

export function CreateImpedimentDialog({
  open,
  onOpenChange,
  artId,
  context,
  onCreated,
}: CreateImpedimentDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createImpedimentAction, initialState);
  useCreateResult(state, () => {
    setDialogOpen(false);
    formRef.current?.reset();
    onCreated?.();
  });

  const needArt = artId === undefined;
  const arts = useEntityOptions<Art>(
    needArt ? optionsEndpoint("art") : null,
    needArt && dialogOpen,
  );

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setDialogOpen(true)}>
          <AlertTriangle className="size-4 mr-1.5" />
          Log Impediment
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Impediment</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={action} className="space-y-4">
            {artId !== undefined ? (
              <input type="hidden" name="artId" value={artId} />
            ) : (
              <div className="space-y-1.5">
                <Label>
                  ART <span className="text-destructive">*</span>
                </Label>
                <select
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
              <Label>
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                name="title"
                required
                maxLength={300}
                placeholder="Short description of the impediment"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                name="description"
                rows={3}
                maxLength={5000}
                placeholder="Additional context, impact, or details"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Severity</Label>
              <select name="severity" defaultValue="medium" className={SELECT_CLASS}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Log Impediment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
