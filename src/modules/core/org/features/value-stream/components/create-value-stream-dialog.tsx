"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createValueStreamAction } from "@/modules/core/org/features/value-stream/actions/value-stream";
import { useCreateResult } from "@/features/create/use-create-result";
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

export interface CreateValueStreamDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Schmale Variante für die Kopfzeile des Struktur-Baums: dort steht der
   * Auslöser neben einer kleinen Bereichs-Beschriftung und darf die Spalte
   * nicht dominieren.
   */
  compact?: boolean;
}

const initialState: ActionState = {};

export function CreateValueStreamDialog({
  open,
  onOpenChange,
  compact = false,
}: CreateValueStreamDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(createValueStreamAction, initialState);
  useCreateResult(state, () => setDialogOpen(false));

  return (
    <>
      {!isControlled && (
        <Button
          onClick={() => setDialogOpen(true)}
          data-tour="value-stream-create-button"
          {...(compact ? { size: "sm" as const, variant: "outline" as const } : {})}
        >
          <Plus className={compact ? "mr-1 size-3.5" : "mr-1.5 size-4"} />
          {compact ? "Wertstrom" : "Wertstrom anlegen"}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Wertstrom anlegen</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vs-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="vs-name" name="name" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vs-description">Beschreibung</Label>
              <Textarea id="vs-description" name="description" rows={3} />
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
                {isPending ? "Wird angelegt…" : "Anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
