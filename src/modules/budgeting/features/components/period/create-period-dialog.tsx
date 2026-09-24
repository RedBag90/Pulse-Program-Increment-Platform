"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPeriodAction } from "@/modules/budgeting/features/actions/period";
import { formatEUR } from "@/lib/formatting";
import type { CarriableReserve } from "@/modules/budgeting/server/views/periods-gallery";
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
export function CreatePeriodDialog({
  defaultPool = 0,
  hasPrevious = false,
  carriableReserves = [],
}: {
  /** Topf-Vorgabe (Topf der jüngsten Kachel). */
  defaultPool?: number;
  /** Gibt es eine vorherige Kachel zum Übernehmen? */
  hasPrevious?: boolean;
  /** Abgeschlossene Kacheln mit offener Reserve — benannt, statt still addiert. */
  carriableReserves?: CarriableReserve[];
} = {}) {
  const t = useTranslations();
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
        {t("budgeting.period.neueKachel")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("budgeting.period.neuenBudgetingZeitraumAnlegen")}</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="period-start">
                {t("budgeting.period.geltungszeitraumDesBudgets")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input id="period-start" name="periodStart" type="date" required />
                <span className="text-sm text-muted-foreground">{t("budgeting.period.bis")}</span>
                <Input id="period-end" name="periodEnd" type="date" />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("budgeting.period.vonWannBisWann")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="period-pool">{t("budgeting.period.topf")}</Label>
              <Input
                id="period-pool"
                name="poolTotal"
                type="number"
                min={0}
                step={1000}
                defaultValue={defaultPool}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="period-deadline">Abgabe-Deadline (optional, Default = Ende)</Label>
              <Input id="period-deadline" name="submissionDeadline" type="date" />
            </div>

            {carriableReserves.length > 0 && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="carryReserve"
                  defaultChecked
                  className="mt-0.5 accent-primary"
                />
                <span>
                  {t("budgeting.period.reserveUebernehmen")}
                  <span className="block text-xs text-muted-foreground">
                    {t("budgeting.period.dieReserveDerLetzten")}{" "}
                    <em>{t("budgeting.period.vor")}</em> deinem Start-Termin wird auf den Topf
                    addiert. Offen:{" "}
                    {carriableReserves
                      .map((r) => `${r.label} · ${formatEUR(r.amount)}`)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            )}

            {hasPrevious && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="carryOver"
                  defaultChecked
                  className="mt-0.5 accent-primary"
                />
                <span>
                  {t("budgeting.period.vomVorherigenZeitraumUebernehmen")}
                  <span className="block text-xs text-muted-foreground">
                    {t("budgeting.period.beteiligteGruppenInklSprecher")}
                  </span>
                </span>
              </label>
            )}

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("budgeting.period.abbrechen")}
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
