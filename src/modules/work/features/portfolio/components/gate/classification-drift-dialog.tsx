"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useActionState, startTransition } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEUR } from "@/lib/formatting";
import { setPortfolioOverrideAction } from "@/modules/work/features/portfolio/actions/epic";
import type { ClassificationDrift } from "@/modules/work/domain/pb-submission";
import type { Locale } from "@/i18n/routing";

export interface DriftInfo {
  drift: ClassificationDrift;
  intended: "portfolio" | "art";
  derived: "portfolio" | "art";
  cost: number | null;
  threshold: number;
  valueStreamId: string;
  /** Trägt der Betrachter `epic.portfolio_override`? Ohne das nur der Hinweis. */
  canOverride: boolean;
}

/**
 * Der Zwischenruf vor dem **L2**-Antrag: der Business Case widerlegt die
 * Erwartung, mit der dieses Epic angelegt wurde. Gerechnet wird dabei gegen
 * den **Entwurf** — die entschiedene Klasse entsteht erst durch die Abnahme,
 * vor der hier gewarnt wird.
 *
 * In **beide** Richtungen ein Hinweis — beide sind eine Überraschung, und wer
 * einreicht, soll sie nicht erst hinterher bemerken. Bestehen darf man aber nur
 * in **einer**: bleibt es Portfolio-Sache, obwohl die Kosten unter dem Limit
 * liegen, ist das eine Ausnahme, die jemand mit dem Recht begründen kann. In
 * die andere Richtung bindet die Kostenregel — was über dem Limit liegt,
 * braucht eine Portfolio-Entscheidung, und ein ART-Rahmen könnte es ohnehin
 * nicht tragen. Deshalb stellt der Antrag in dieser Richtung die Einordnung
 * selbst um (`reclassifyAboveLimit` im Gate-Dienst) — der Dialog kündigt das
 * nur an.
 *
 * **Ein Satz je Richtung**, nicht ein Satz mit `"über" : "unter"` darin: bis
 * September 2026 stand der Absatz als JSX-Text zwischen Ausdrücken und
 * erschien auf der englischen Oberfläche deutsch.
 */
export function ClassificationDriftDialog({
  epicId,
  info,
  open,
  onOpenChange,
  onProceed,
}: {
  epicId: string;
  info: DriftInfo;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Weiter zum Antrag — die abgeleitete Klasse gilt. */
  onProceed: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [reason, setReason] = useState("");
  const [state, submitOverride, busy] = useActionState(setPortfolioOverrideAction, {});
  const mayInsist = info.drift === "down" && info.canOverride;

  function insist() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("valueStreamId", info.valueStreamId);
    fd.set("reason", reason);
    startTransition(() => {
      submitOverride(fd);
      onProceed();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" aria-hidden />
            {t("work.gate.dieEinordnungAendertSich")}
          </DialogTitle>
          <DialogDescription>
            {t.rich(info.drift === "up" ? "work.gate.driftHoch" : "work.gate.driftRunter", {
              cost: info.cost != null ? formatEUR(info.cost, locale) : "—",
              limit: formatEUR(info.threshold, locale),
              b: (c) => <strong className="font-medium tabular-nums">{c}</strong>,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {info.drift === "up" ? (
            <p className="text-muted-foreground">{t("work.gate.einordnungWirdUmgestellt")}</p>
          ) : mayInsist ? (
            <>
              <p className="text-muted-foreground">{t("work.gate.esHaengtKuenftigAm")}</p>
              <div className="space-y-1.5">
                <Label htmlFor="drift-reason">{t("work.gate.begruendungFuerDieAusnahme")}</Label>
                <Textarea
                  id="drift-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("work.gate.zBStrategischeAbhaengigkeit")}
                />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">{t("work.gate.esHaengtKuenftigAm2")}</p>
          )}

          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("work.gate.abbrechen")}
          </Button>
          {mayInsist && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || reason.trim() === ""}
              onClick={insist}
            >
              {t("work.gate.portfolioSacheBleiben")}
            </Button>
          )}
          <Button type="button" onClick={onProceed}>
            {t("work.gate.verstandenBeantragen")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
