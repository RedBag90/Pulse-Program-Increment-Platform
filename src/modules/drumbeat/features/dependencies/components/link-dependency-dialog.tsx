"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useCreateDialogState } from "@/features/create/use-create-dialog-state";
import { Link2 } from "lucide-react";
import { useActionResult } from "@/lib/hooks/use-action-result";
import { linkDependencyAction } from "@/modules/drumbeat/features/dependencies/actions/dependency";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DEPENDENCY_TYPE_KEYS } from "@/modules/drumbeat/domain/status";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type DependencyType = "blocks" | "relates_to";

interface Candidate {
  id: string;
  title: string;
}

interface Props {
  fromId: string;
  artId: string;
  candidates: Candidate[];
}

/**
 * Die wählbaren Typen. Bis September 2026 standen hier englische Literale
 * („depends on") auch auf der deutschen Oberfläche — und `depends_on`, das es
 * seitdem nicht mehr gibt: es hiess „hängt ab von", wurde im Netzplan aber als
 * „zuerst" gezeichnet. Übrig ist `blocks` für die Reihenfolge.
 */
const TYPES: readonly DependencyType[] = ["blocks", "relates_to"];

export function LinkDependencyDialog({ fromId, artId, candidates }: Props) {
  const t = useTranslations();
  const [open, setOpen] = useCreateDialogState("dependency");
  const [toId, setToId] = useState("");
  const [type, setType] = useState<DependencyType>("blocks");
  const [state, formAction, isPending] = useActionState(linkDependencyAction, {});

  useActionResult(state, "Dependency linked", () => {
    setToId("");
    setType("blocks");
    setOpen(false);
  });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Link2 className="size-4 mr-1.5" />
        {t("drumbeat.ui.linkDependency")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("drumbeat.ui.linkADependency")}</DialogTitle>
          </DialogHeader>

          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("drumbeat.ui.noOtherFeaturesIn")}
            </p>
          ) : (
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="fromId" value={fromId} />
              <input type="hidden" name="artId" value={artId} />
              <div className="space-y-1.5">
                <Label htmlFor="dep-type">{t("drumbeat.ui.thisFeature")}</Label>
                <select
                  id="dep-type"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as DependencyType)}
                  className={SELECT_CLASS}
                >
                  {TYPES.map((typ) => (
                    <option key={typ} value={typ}>
                      {t(DEPENDENCY_TYPE_KEYS[typ])}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dep-target">{t("drumbeat.ui.targetFeature")}</Label>
                <select
                  id="dep-target"
                  name="toId"
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">{t("drumbeat.ui.selectAFeature")}</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
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
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("drumbeat.ui.cancel")}
                </Button>
                <Button type="submit" disabled={isPending || !toId}>
                  {isPending ? t("drumbeat.ui.verknuepfeLaeuft") : t("work.epic.verknuepfen")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
