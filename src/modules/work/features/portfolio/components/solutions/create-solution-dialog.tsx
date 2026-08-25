"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  createSolutionAction,
  updateSolutionAction,
} from "@/modules/work/features/portfolio/actions/solution";
import { useCreateResult } from "@/features/create/use-create-result";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
import {
  SOLUTION_STATUSES,
  SOLUTION_STATUS_LABEL,
  solutionStatusOf,
  type InvestmentMode,
} from "@/modules/work/domain/solution";
import { type Horizon } from "@/modules/work/domain/portfolio-guardrails";
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
interface Art {
  id: string;
  name: string;
  valueStream?: { id: string } | null;
}

export interface SolutionForEdit {
  id: string;
  name: string;
  description: string | null;
  valueStreamId: string;
  artId: string | null;
  horizon: string;
  investmentMode: string | null;
}

export interface CreateSolutionDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Vorhandene Solution → Bearbeiten-Modus. */
  solution?: SolutionForEdit;
}

const initialState: ActionState = {};

export function CreateSolutionDialog({ open, onOpenChange, solution }: CreateSolutionDialogProps) {
  const isEdit = solution !== undefined;
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(
    isEdit ? updateSolutionAction : createSolutionAction,
    initialState,
  );

  // Anlegen: Toast + schließen (useCreateResult). Bearbeiten: bei success schließen.
  useCreateResult(state, () => setDialogOpen(false));
  useEffect(() => {
    if (isEdit && state.success) setDialogOpen(false);
  }, [isEdit, state.success]);

  const fetchedVs = useEntityOptions<ValueStream>(optionsEndpoint("valueStream"), dialogOpen);
  const [vsId, setVsId] = useState(solution?.valueStreamId ?? "");
  const arts = useEntityOptions<Art>(optionsEndpoint("art"), dialogOpen);
  const artOptions = arts.data.filter((a) => a.valueStream?.id === vsId);

  return (
    <>
      {!isControlled && !isEdit && (
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Solution
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Solution bearbeiten" : "Neue Solution"}</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            {isEdit && <input type="hidden" name="id" value={solution.id} />}

            <div className="space-y-1.5">
              <Label htmlFor="sol-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="sol-name" name="name" required defaultValue={solution?.name ?? ""} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sol-desc">Beschreibung</Label>
              <Textarea id="sol-desc" name="description" rows={2} defaultValue={solution?.description ?? ""} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sol-vs">
                  Value Stream <span className="text-destructive">*</span>
                </Label>
                <select
                  id="sol-vs"
                  name="valueStreamId"
                  required
                  value={vsId}
                  onChange={(e) => setVsId(e.target.value)}
                  disabled={fetchedVs.loading}
                  className={SELECT_CLASS}
                >
                  <option value="">{fetchedVs.loading ? "Lade…" : "Value Stream wählen…"}</option>
                  {fetchedVs.data.map((vs) => (
                    <option key={vs.id} value={vs.id}>
                      {vs.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sol-art">ART</Label>
                <select
                  key={vsId}
                  id="sol-art"
                  name="artId"
                  defaultValue={solution?.artId ?? ""}
                  disabled={!vsId || arts.loading}
                  className={SELECT_CLASS}
                >
                  <option value="">
                    {!vsId ? "Zuerst Value Stream…" : "— kein ART —"}
                  </option>
                  {artOptions.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sol-status">
                Status <span className="text-destructive">*</span>
              </Label>
              <select
                id="sol-status"
                name="status"
                required
                defaultValue={
                  solution
                    ? solutionStatusOf(
                        solution.horizon as Horizon,
                        solution.investmentMode as InvestmentMode | null,
                      )
                    : "investing"
                }
                className={SELECT_CLASS}
              >
                {SOLUTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SOLUTION_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
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
                {isPending ? "Speichern…" : isEdit ? "Speichern" : "Solution anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
