"use client";

import { useActionState, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { suggestRiskAction, documentRiskAction } from "@/modules/risks/features/risk/actions/risk";
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
import { RISK_LEVELS } from "@/modules/risks/domain/risk-matrix";
import { RISK_CATEGORIES } from "@/modules/risks/domain/risk-category";
import { LEVEL_LABELS, CATEGORY_LABELS } from "@/modules/risks/features/risk/components/labels";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface CreateRiskDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Whether the user may document directly (else the risk is suggested). */
  canDocument?: boolean;
  /** Pre-link the new risk to this Epic (from the Epic Risks tab). */
  epicId?: string;
  onCreated?: () => void;
}

const initialState: ActionState = {};

export function CreateRiskDialog({
  open,
  onOpenChange,
  canDocument = false,
  epicId,
  onCreated,
}: CreateRiskDialogProps) {
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const formRef = useRef<HTMLFormElement>(null);
  const action = canDocument ? documentRiskAction : suggestRiskAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  useCreateResult(state, () => {
    setDialogOpen(false);
    formRef.current?.reset();
    onCreated?.();
  });

  const cta = canDocument ? "Risiko dokumentieren" : "Risiko vorschlagen";

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setDialogOpen(true)}>
          <ShieldAlert className="mr-1.5 size-4" />
          {cta}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{cta}</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={formAction} className="space-y-4">
            {epicId && <input type="hidden" name="epicId" value={epicId} />}

            <div className="space-y-1.5">
              <Label>
                Titel <span className="text-destructive">*</span>
              </Label>
              <Input
                name="title"
                required
                maxLength={300}
                placeholder="Kurzbeschreibung des Risikos"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea
                name="description"
                rows={3}
                maxLength={5000}
                placeholder="Kontext, Auswirkung, Details"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Wahrscheinlichkeit</Label>
                <select name="probability" defaultValue="" className={SELECT_CLASS}>
                  <option value="">—</option>
                  {RISK_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Auswirkung</Label>
                <select name="impact" defaultValue="" className={SELECT_CLASS}>
                  <option value="">—</option>
                  {RISK_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategorie</Label>
                <select name="category" defaultValue="" className={SELECT_CLASS}>
                  <option value="">—</option>
                  {RISK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Zieltermin</Label>
                <Input type="date" name="targetResolutionDate" />
              </div>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Speichern…" : cta}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
