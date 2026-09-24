"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useActionResult } from "@/lib/hooks/use-action-result";
import { updateValueStreamAction } from "@/modules/core/org/features/value-stream/actions/value-stream";
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

interface EditValueStreamDialogProps {
  id: string;
  name: string;
  description?: string | null;
}

export function EditValueStreamDialog({ id, name, description }: EditValueStreamDialogProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(updateValueStreamAction, {});

  useActionResult(state, "Value Stream updated", () => setOpen(false));

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("org.ui.edit")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("org.ui.editValueStream")}</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={id} />

            <div className="space-y-1.5">
              <Label htmlFor="edit-vs-name">
                {t("org.ui.name")} <span className="text-destructive">*</span>
              </Label>
              <Input id="edit-vs-name" name="name" required defaultValue={name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-vs-description">{t("org.ui.description")}</Label>
              <Textarea
                id="edit-vs-description"
                name="description"
                rows={3}
                defaultValue={description ?? ""}
              />
            </div>

            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("org.ui.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
