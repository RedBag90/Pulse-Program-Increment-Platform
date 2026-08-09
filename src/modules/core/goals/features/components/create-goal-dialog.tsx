"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createGoalNodeAction } from "@/modules/core/goals/features/actions/ziele";
import { useCreateResult } from "@/features/create/use-create-result";
import { GoalPeriodField } from "@/modules/core/goals/features/components/goal-period-field";
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

export interface CreateGoalDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const initialState: ActionState = {};

/**
 * Schnell-Anlage eines Top-Level-Ziels aus dem globalen „+"-Menü. Minimal: Titel
 * (Pflicht) + Umsetzungszeitraum + Beschreibung; alles Weitere (Metrik,
 * Fortschrittsquelle, Verknüpfungen) pflegt man danach im Ziel-Drawer. Ruft
 * `createGoalNodeAction` direkt (Muster wie die übrigen +-Dialoge).
 */
export function CreateGoalDialog({ open, onOpenChange }: CreateGoalDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(createGoalNodeAction, initialState);
  useCreateResult(state, () => setDialogOpen(false));

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Neues Ziel
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ziel anlegen</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="goal-title">
                Titel <span className="text-destructive">*</span>
              </Label>
              <Input id="goal-title" name="title" required autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label>Zeitraum</Label>
              <GoalPeriodField />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-narrative">Beschreibung</Label>
              <Textarea id="goal-narrative" name="narrative" rows={3} />
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
              <Button type="submit" disabled={isPending}>
                {isPending ? "Legt an…" : "Anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
