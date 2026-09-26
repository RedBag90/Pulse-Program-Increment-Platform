"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  scoreFeatureAction,
  type FeatureActionState,
} from "@/modules/work/features/feature/actions/feature";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const FIB = [1, 2, 3, 5, 8, 13, 20] as const;

interface Props {
  featureId: string;
  artId: string;
  current: {
    bv: number | null;
    tc: number | null;
    rr: number | null;
    js: number | null;
  };
  /** Custom-Trigger statt der Score-Pille (z. B. fuer Netzplan-Quick-Edit). */
  renderTrigger?: (props: { onClick: () => void; score: string | null }) => ReactNode;
}

const initial: FeatureActionState = {};

export function WsjfScoreDialog({ featureId, artId, current, renderTrigger }: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prev: FeatureActionState, formData: FormData) => {
      const result = await scoreFeatureAction(prev, formData);
      if (result.success) {
        toast.success(t("work.feature.wsjfAktualisiert"));
        setOpen(false);
      }
      return result;
    },
    initial,
  );

  const score =
    current.bv !== null && current.tc !== null && current.rr !== null && current.js !== null
      ? (((current.bv + current.tc + current.rr) / current.js) as number).toFixed(2)
      : null;

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ onClick: () => setOpen(true), score })
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-primary hover:underline whitespace-nowrap"
        >
          {score !== null ? score : t("work.feature.scoreKurz")}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("work.feature.updateWsjfScore")}</DialogTitle>
          </DialogHeader>
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="featureId" value={featureId} />
            <input type="hidden" name="artId" value={artId} />

            {(
              [
                { name: "wsjfBusinessValue", label: "Business Value", value: current.bv },
                { name: "wsjfTimeCriticality", label: "Time Criticality", value: current.tc },
                { name: "wsjfRiskReduction", label: "Risk Reduction", value: current.rr },
                { name: "wsjfJobSize", label: "Job Size", value: current.js },
              ] as const
            ).map(({ name, label, value }) => (
              <div key={name} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <select name={name} defaultValue={value ?? 1} className={SELECT_CLASS}>
                  {FIB.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {state.error && <p className="text-xs text-destructive">{state.error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("work.feature.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? t("common.ui.speichernLaeuft") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
