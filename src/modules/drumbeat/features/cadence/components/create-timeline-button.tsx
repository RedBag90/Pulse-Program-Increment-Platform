"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createTimelineAction } from "@/modules/drumbeat/features/cadence/actions/timeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateTimelineButton() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(createTimelineAction, {});

  // Close on success (state.success flips true) — simple and matches other dialogs.
  if (state?.success && open) {
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" />
        {t("drumbeat.ui.neueTimeline")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("drumbeat.ui.neueTimelineAnlegen")}</DialogTitle>
          </DialogHeader>
          <form action={run} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="timeline-name">
                {t("drumbeat.ui.name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="timeline-name"
                name="name"
                required
                maxLength={100}
                placeholder={t("drumbeat.ui.zBQuartalskadenzBank")}
              />
            </div>
            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("drumbeat.ui.abbrechen")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t("drumbeat.ui.anlegenLaeuft") : t("drumbeat.ui.anlegen")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
