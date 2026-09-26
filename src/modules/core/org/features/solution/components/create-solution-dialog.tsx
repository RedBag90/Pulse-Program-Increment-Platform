"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  createSolutionAction,
  updateSolutionAction,
} from "@/modules/core/org/features/solution/actions/solution";
import { useCreateResult } from "@/features/create/use-create-result";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
import {
  SOLUTION_STATUSES,
  SOLUTION_STATUS_KEYS,
  solutionStatusOf,
  type InvestmentMode,
} from "@/modules/core/org/domain/solution";
import { type Horizon } from "@/modules/core/org/domain/horizon";
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
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
  const t = useTranslations();
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
          {t("org.ui.solution")}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? t("org.ui.solutionDialogBearbeiten") : t("org.ui.solutionDialogNeu")}
            </DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            {isEdit && <input type="hidden" name="id" value={solution.id} />}

            <div className="space-y-1.5">
              <Label htmlFor="sol-name">
                {t("org.ui.name")} <span className="text-destructive">*</span>
              </Label>
              <Input id="sol-name" name="name" required defaultValue={solution?.name ?? ""} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sol-desc">{t("org.ui.beschreibung")}</Label>
              <Textarea
                id="sol-desc"
                name="description"
                rows={2}
                defaultValue={solution?.description ?? ""}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sol-vs">
                  {t("org.ui.valueStream")} <span className="text-destructive">*</span>
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
                  <option value="">
                    {fetchedVs.loading
                      ? t("org.ui.solutionDialogLade")
                      : t("org.ui.solutionDialogValueStreamWaehlen")}
                  </option>
                  {fetchedVs.data.map((vs) => (
                    <option key={vs.id} value={vs.id}>
                      {vs.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sol-art">{t("org.ui.art")}</Label>
                {/*
                  **Pflichtfeld seit 2026-09-19.** „— kein ART —" stand hier als
                  gleichwertige Wahl; über dieses Feld löst sich aber das
                  Betriebsgeld dieser Solution auf einen Zug auf, und ohne ART
                  bleibt es sichtbar liegen. Der leere Eintrag heißt jetzt
                  „noch nicht gewählt", nicht „keins" — `required` lässt ihn
                  nicht durch.
                */}
                <select
                  key={vsId}
                  id="sol-art"
                  name="artId"
                  required
                  defaultValue={solution?.artId ?? ""}
                  disabled={!vsId || arts.loading}
                  className={SELECT_CLASS}
                >
                  <option value="">
                    {!vsId
                      ? t("org.ui.solutionDialogZuerstValueStream")
                      : t("org.ui.solutionDialogBitteWaehlen")}
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
                {t("org.ui.status")} <span className="text-destructive">*</span>
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
                    {t(SOLUTION_STATUS_KEYS[s])}
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
                {t("org.ui.abbrechen")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? t("common.ui.speichernLaeuft")
                  : isEdit
                    ? t("common.save")
                    : t("org.ui.solutionDialogAnlegen")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
