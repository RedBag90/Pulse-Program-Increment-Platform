"use client";

import { useActionState, useState } from "react";
import { Settings } from "lucide-react";
import { setRiskPrefixAction } from "@/modules/risks/features/risk/actions/risk";
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

const initialState: ActionState = {};

/** Admin-only editor for the tenant's risk-number prefix. */
export function RiskSettingsDialog({ prefix }: { prefix: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(setRiskPrefixAction, initialState);
  useCreateResult(state, () => setOpen(false));

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings className="mr-1.5 size-4" />
        Präfix
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Risiko-Nummernpräfix</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Präfix</Label>
              <Input name="prefix" defaultValue={prefix} maxLength={8} required />
              <p className="text-xs text-muted-foreground">
                z. B. <code>RISK-</code> → RISK-001. Bestehende Risiken werden neu formatiert.
              </p>
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Speichern…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
