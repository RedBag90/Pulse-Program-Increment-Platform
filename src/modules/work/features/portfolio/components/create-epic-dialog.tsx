"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createEpicAction } from "@/modules/work/features/portfolio/actions/epic";
import { linkEpicToGoalAction } from "@/modules/core/goals/features/actions/ziele";
import { useCreateResult } from "@/features/create/use-create-result";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
import { GoalTreePicker } from "@/modules/core/goals/features/components/goal-tree-picker";
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
  // Optionale Ziel-Verknüpfung: nach der Epic-Anlage in einem zweiten Schritt.
  const [linkState, linkRun, linkPending] = useActionState(linkEpicToGoalAction, initialState);
  const [goalId, setGoalId] = useState("");
  const linkDone = useRef(false);

  // Epic angelegt: wenn ein Ziel gewählt ist, dieses verknüpfen (nicht schließen —
  // das erledigt der Link-Effekt); sonst normal schließen. `useCreateResult` zeigt
  // den „Epic created"-Toast (mit Open-Link) in beiden Fällen.
  useCreateResult(state, () => {
    const id = state.created?.id;
    if (id && goalId) {
      const fd = new FormData();
      fd.set("goalId", goalId);
      fd.set("epicId", id);
      startTransition(() => linkRun(fd));
    } else {
      setDialogOpen(false);
    }
  });

  // Link aufgelöst: bei Erfolg schließen; bei Fehler (z. B. fehlendes `kpi.bind`)
  // ist das Epic trotzdem angelegt — informieren und schließen (kein Doppel-Anlegen).
  useEffect(() => {
    if (linkDone.current) return;
    if (linkState.success) {
      linkDone.current = true;
      setDialogOpen(false);
    } else if (linkState.error) {
      linkDone.current = true;
      toast.error(`Epic angelegt — Ziel-Verknüpfung nicht möglich: ${linkState.error}`, {
        duration: 8000,
      });
      setDialogOpen(false);
    }
  }, [linkState]);

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
          <Plus className="mr-1.5 size-4" />
          Neues Epic
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Epic anlegen</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="epic-title">
                Titel <span className="text-destructive">*</span>
              </Label>
              <Input id="epic-title" name="title" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="epic-vs">
                Wertstrom <span className="text-destructive">*</span>
              </Label>
              <select
                id="epic-vs"
                name="valueStreamId"
                required
                disabled={fetched.loading}
                className={SELECT_CLASS}
              >
                <option value="">{fetched.loading ? "Lade…" : "Wertstrom wählen…"}</option>
                {options.map((vs) => (
                  <option key={vs.id} value={vs.id}>
                    {vs.name}
                  </option>
                ))}
              </select>
              {fetched.error && <p className="text-xs text-destructive">{fetched.error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Unterstütztes Ziel</Label>
              <GoalTreePicker value={goalId} onChange={setGoalId} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="epic-description">Beschreibung</Label>
              <Textarea id="epic-description" name="description" rows={3} />
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isPending || linkPending}>
                {isPending ? "Lege an…" : linkPending ? "Verknüpfe…" : "Anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
