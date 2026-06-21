"use client";

import { useActionState, useState, startTransition, useEffect } from "react";
import { createPiOnTimelineAction, updatePiOnTimelineAction } from "@/features/timeline/actions/pi";
import type { ActionState } from "@/server/http/server-action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PiInitialValues {
  id?: string;
  name?: string;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
  status?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timelineId: string;
  /** Wenn `id` gesetzt ist → Edit-Mode; sonst Create-Mode. */
  initial?: PiInitialValues;
}

const initialState: ActionState = {};

/**
 * Dialog fuer PI-Create / Edit. Bei Edit-Mode ist `initial.id` gesetzt;
 * Felder werden mit aktuellen Werten vorbefuellt. Bei Create-Mode ohne
 * Vorgabe startet alles leer; mit Vorgabe (z. B. aus Kalender-Klick)
 * wird das Start-Datum vorbelegt. End-Datum traegt der User immer manuell ein.
 */
export function PiDialog({ open, onOpenChange, timelineId, initial }: Props) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit ? updatePiOnTimelineAction : createPiOnTimelineAction;
  const [state, run, pending] = useActionState(action, initialState);

  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");

  // Reset when opening with new initials.
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setStartDate(initial?.startDate ?? "");
      setEndDate(initial?.endDate ?? "");
    }
  }, [open, initial?.id, initial?.name, initial?.startDate, initial?.endDate]);

  // Close on successful submit.
  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  const isActiveOrDone = initial?.status === "active" || initial?.status === "completed";

  const onSubmit = (fd: FormData) => {
    startTransition(() => run(fd));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "PI bearbeiten" : "Neues PI"}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          {!isEdit && <input type="hidden" name="timelineId" value={timelineId} />}
          {isEdit && initial?.id && <input type="hidden" name="id" value={initial.id} />}

          {isActiveOrDone && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
              Dieses PI ist{" "}
              <strong>{initial?.status === "active" ? "aktiv" : "abgeschlossen"}</strong>. Start-
              und End-Datum sind gesperrt; nur der Name kann geändert werden.
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="pi-name" className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              id="pi-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              disabled={pending}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="z. B. PI 25-04"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="pi-start" className="text-sm font-medium">
                Start <span className="text-destructive">*</span>
              </label>
              <input
                id="pi-start"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                disabled={pending || isActiveOrDone}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pi-end" className="text-sm font-medium">
                Ende <span className="text-destructive">*</span>
              </label>
              <input
                id="pi-end"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                disabled={pending || isActiveOrDone}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums disabled:opacity-50"
              />
            </div>
          </div>

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-md border px-3 text-sm hover:bg-muted/50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Speichere…" : isEdit ? "Speichern" : "Anlegen"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
