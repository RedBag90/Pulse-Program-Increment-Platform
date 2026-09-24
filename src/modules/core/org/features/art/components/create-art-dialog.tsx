"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createArtAction } from "@/modules/core/org/features/art/actions/art";
import { useCreateResult } from "@/features/create/use-create-result";
import { useEntityOptions, optionsEndpoint } from "@/features/create/use-entity-options";
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

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface ValueStream {
  id: string;
  name: string;
}

export interface CreateArtDialogProps {
  /** Controlled mode (global "+" menu). Omit to render a self-triggering button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Page-supplied value streams; when omitted they are fetched lazily. */
  valueStreams?: ValueStream[];
}

const initialState: ActionState = {};

/**
 * ART anlegen — **kadenz-frei**: nur Wertstrom + Name. Eine PI-Timeline/Kadenz
 * ist Drumbeat und wird nachträglich pro ART zugewiesen, nicht hier (ADR-0014).
 * Ein Test hält das fest — sonst trägt es jemand nach, weil es zu fehlen scheint.
 *
 * **Zwei Aufrufstellen, ein Vertrag:** unkontrolliert (ohne `open`) bringt der
 * Dialog seinen eigenen Auslöser mit — so steht er in der Kopfzeile von
 * `/structure`. Kontrolliert öffnet ihn das globale „+"-Menü.
 *
 * Bis September 2026 war das Menü die **einzige** Aufrufstelle. Deshalb fiel
 * auch nicht auf, dass der Dialog englisch war, während alles um ihn herum
 * deutsch ist.
 */
export function CreateArtDialog({ open, onOpenChange, valueStreams }: CreateArtDialogProps) {
  const t = useTranslations();
  const isControlled = open !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const dialogOpen = open ?? selfOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange?.(v) : setSelfOpen(v));

  const [state, action, isPending] = useActionState(createArtAction, initialState);
  useCreateResult(state, () => setDialogOpen(false));

  const needFetch = valueStreams === undefined;
  const fetched = useEntityOptions<ValueStream>(
    needFetch ? optionsEndpoint("valueStream") : null,
    needFetch && dialogOpen,
  );
  const options = valueStreams ?? fetched.data;

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          {t("org.page.art")}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("org.ui.agileReleaseTrainAnlegen")}</DialogTitle>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="art-vs">
                {t("org.ui.wertstrom")} <span className="text-destructive">*</span>
              </Label>
              <select
                id="art-vs"
                name="valueStreamId"
                required
                disabled={fetched.loading}
                className={SELECT_CLASS}
              >
                <option value="">
                  {fetched.loading ? "Wird geladen …" : "Wertstrom wählen …"}
                </option>
                {options.map((vs) => (
                  <option key={vs.id} value={vs.id}>
                    {vs.name}
                  </option>
                ))}
              </select>
              {fetched.error && <p className="text-xs text-destructive">{fetched.error}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-name">
                {t("org.ui.name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="art-name"
                name="name"
                required
                maxLength={100}
                placeholder={t("org.ui.zBPlattformArt")}
              />
            </div>

            <p className="text-xs text-muted-foreground">{t("org.ui.diePiKadenzWird")}</p>

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
                {isPending ? "Wird angelegt …" : "ART anlegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
