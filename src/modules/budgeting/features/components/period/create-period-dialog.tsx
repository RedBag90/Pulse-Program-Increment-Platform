"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPeriodAction } from "@/modules/budgeting/features/actions/period";
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

const initialState: ActionState = {};

/**
 * Legt einen Budgeting-Zeitraum an. Der Start kommt aus **demselben Picker wie
 * die Ziele** (`GoalPeriodField`); das Ende füllt der Server auf Start + 6 Monate,
 * wenn im Individuell-Modus keins gesetzt ist.
 */
export function CreatePeriodDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createPeriodAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Neue Kachel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuen Budgeting-Zeitraum anlegen</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Start der Budgeting-Phase <span className="text-destructive">*</span>
              </Label>
              <GoalPeriodField />
              <p className="text-xs text-muted-foreground">
                Raster (H1/H2) oder individuelles Datum. Ohne Ende: Start + 6 Monate.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="period-pool">Topf (€)</Label>
              <Input id="period-pool" name="poolTotal" type="number" min={0} step={1000} defaultValue={0} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="period-deadline">Abgabe-Deadline (optional, Default = Ende)</Label>
              <Input id="period-deadline" name="submissionDeadline" type="date" />
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Lege an…" : "Kachel anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
