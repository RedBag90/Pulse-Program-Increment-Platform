"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteEpicAction } from "@/modules/work/features/portfolio/actions/epic";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ActionState } from "@/server/http/server-action";

interface DeleteEpicButtonProps {
  id: string;
  title: string;
  /** Wie viele Features unter diesem Epic hängen. */
  featureCount: number;
}

const initialState: ActionState = {};

/**
 * **Ein Epic löschen — und die Frage, was mit seinen Features geschieht.**
 *
 * Bisher verschwanden sie mit. Das war die einzige mögliche Antwort, solange
 * ein Feature ohne Epic nicht bestehen durfte; seit es das darf, ist
 * **Freigeben** die zweite: die Features werden eigenständig und behalten PI,
 * WSJF, Abhängigkeiten und ihren Verlauf.
 *
 * Gefragt wird nur, wenn es etwas zu entscheiden gibt. Ein Epic ohne Features
 * bekommt weiterhin die schlichte Rückfrage — eine Wahl ohne Gegenstand wäre
 * nur eine Hürde.
 */
export function DeleteEpicButton({ id, title, featureCount }: DeleteEpicButtonProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(deleteEpicAction, initialState);

  if (featureCount === 0) {
    return (
      <ConfirmMutateForm
        action={deleteEpicAction}
        fields={{ id }}
        label={<span className="sr-only">{t("work.epic.loeschen")}</span>}
        icon={<Trash2 className="size-3.5" />}
        confirmPrompt={t("work.epic.epicLoeschenFrage", { title })}
        variant="ghost"
        destructive
        className="h-7 px-2 text-muted-foreground"
      />
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-7 px-2 text-muted-foreground"
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">{t("work.epic.loeschen")}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("work.epic.epicLoeschenTitel", { title })}</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            {t.rich(
              featureCount === 1
                ? "work.epic.daranHaengtEinFeatureWasTun"
                : "work.epic.daranHaengenFeaturesWasTun",
              {
                count: featureCount,
                b: (c) => <strong className="font-medium text-foreground">{c}</strong>,
              },
            )}
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              <strong className="font-medium text-foreground">{t("work.epic.freigeben")}</strong>
              {t("work.epic.sieWerdenEigenstaendigUnd")}
            </li>
            <li>
              <strong className="font-medium text-foreground">{t("work.epic.mitloeschen")}</strong>
              {t("work.epic.sieVerschwindenMitDem")}
            </li>
          </ul>

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("work.epic.abbrechen")}
            </Button>
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="children" value="release" />
              <Button type="submit" variant="outline" disabled={isPending}>
                {t("work.epic.featuresFreigeben")}
              </Button>
            </form>
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="children" value="delete" />
              <Button type="submit" variant="destructive" disabled={isPending}>
                {t("work.epic.allesLoeschen")}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
