"use client";

import { useActionState, useState } from "react";
import { useActionResult } from "@/lib/hooks/use-action-result";
import { updateArtAction } from "@/features/art/actions/art";
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

interface EditArtDialogProps {
  id: string;
  name: string;
  description?: string | null;
  piCadenceWeeks: number;
}

/**
 * Mirror von `EditValueStreamDialog`: bearbeitet Name, Beschreibung und
 * PI-Cadence (8–12 Wochen) eines ARTs. RTE-Zuweisung läuft an einer eigenen
 * Surface — dieser Dialog hält sich an die Grundfelder. Verdrahtet gegen
 * `updateArtAction`.
 */
export function EditArtDialog({ id, name, description, piCadenceWeeks }: EditArtDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(updateArtAction, {});

  useActionResult(state, "ART aktualisiert", () => setOpen(false));

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Bearbeiten
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ART bearbeiten</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={id} />

            <div className="space-y-1.5">
              <Label htmlFor="edit-art-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="edit-art-name" name="name" required defaultValue={name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-art-description">Beschreibung</Label>
              <Textarea
                id="edit-art-description"
                name="description"
                rows={3}
                defaultValue={description ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-art-cadence">PI-Cadence (Wochen)</Label>
              <Input
                id="edit-art-cadence"
                name="piCadenceWeeks"
                type="number"
                min={8}
                max={12}
                step={1}
                defaultValue={piCadenceWeeks}
              />
              <p className="text-xs text-muted-foreground">Erlaubter Bereich: 8–12 Wochen.</p>
            </div>

            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Speichere…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
