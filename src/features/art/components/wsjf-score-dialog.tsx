"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { scoreFeatureAction, type FeatureActionState } from "@/features/art/actions/feature";
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
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
}

const initial: FeatureActionState = {};

export function WsjfScoreDialog({ featureId, artId, current }: Props) {
  const [open, setOpen] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prev: FeatureActionState, formData: FormData) => {
      const result = await scoreFeatureAction(prev, formData);
      if (result.success) {
        toast.success("WSJF score updated");
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
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-primary hover:underline whitespace-nowrap"
      >
        {score !== null ? score : "Score"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update WSJF Score</DialogTitle>
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
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
