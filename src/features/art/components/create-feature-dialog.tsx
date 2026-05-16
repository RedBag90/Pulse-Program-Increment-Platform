"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createFeatureAction } from "@/features/art/actions/feature";
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

const FIBONACCI = [1, 2, 3, 5, 8, 13, 20] as const;

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  artId: string;
  epics: { id: string; title: string }[];
}

export function CreateFeatureDialog({ artId, epics }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createFeatureAction, {});

  useEffect(() => {
    if (state.success) {
      toast.success("Feature created");
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" />
        New Feature
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Feature</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="artId" value={artId} />

            <div className="space-y-1.5">
              <Label htmlFor="f-parent">
                Parent Epic <span className="text-destructive">*</span>
              </Label>
              <select id="f-parent" name="parentId" required className={SELECT_CLASS}>
                <option value="">Select a parent epic…</option>
                {epics.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="f-title"
                name="title"
                required
                maxLength={200}
                placeholder="e.g. User can reset password via email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-desc">Description</Label>
              <Textarea id="f-desc" name="description" rows={3} />
            </div>

            <fieldset className="border border-border rounded-md p-4 space-y-3">
              <legend className="text-sm font-medium px-1">WSJF Scoring</legend>
              {(
                [
                  ["wsjfBusinessValue", "Business Value"],
                  ["wsjfTimeCriticality", "Time Criticality"],
                  ["wsjfRiskReduction", "Risk Reduction / Opportunity Enablement"],
                  ["wsjfJobSize", "Job Size"],
                ] as const
              ).map(([name, label]) => (
                <div key={name} className="space-y-1">
                  <Label htmlFor={`f-${name}`}>
                    {label} <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id={`f-${name}`}
                    name={name}
                    required
                    defaultValue=""
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {FIBONACCI.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="f-ac">Acceptance Criteria</Label>
              <Textarea
                id="f-ac"
                name="acceptanceCriteria"
                rows={4}
                placeholder={"Given…\nWhen…\nThen…"}
              />
              <p className="text-xs text-muted-foreground">One criterion per line</p>
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Feature"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
