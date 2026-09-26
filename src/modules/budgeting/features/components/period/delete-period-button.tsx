"use client";

import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deletePeriodAction } from "@/modules/budgeting/features/actions/period";
import { formatEUR } from "@/lib/formatting";
import type { Locale } from "@/i18n/routing";
import { cycleMoneyTotal, type CycleMoney } from "@/modules/budgeting/domain/cycle-money";

/**
 * „Kachel löschen" — Bestätigung + Löschen der Runde **und des Geldes ihres
 * Halbjahres** (ART-Topf, Run-Zuspruch, ART-Verteilungen, Epic-Budgets).
 *
 * Bis September 2026 stand hier „Bereits finalisierte Epic-Budgets bleiben
 * erhalten" — und das Geld blieb tatsächlich stehen, auch der ART-Topf, den
 * der Text gar nicht erwähnte. Jetzt nennt der Dialog vorher die Summen, die
 * verschwinden.
 *
 * **Die Umleitung steht in der Aktion**, nicht hier: ein `onSuccess` im Browser
 * kam gegen das Flight-Paket der gelöschten Seite nicht an und endete auf einem
 * 404. Siehe `deletePeriodAction`.
 */
export function DeletePeriodButton({
  id,
  atStake,
  cycleLabel,
}: {
  id: string;
  /** Was unter dem Halbjahr liegt; `null` = nicht geladen. */
  atStake: CycleMoney | null;
  cycleLabel: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const eur = (n: number) => formatEUR(n, locale);

  const prompt =
    atStake == null || cycleMoneyTotal(atStake) === 0
      ? t("budgeting.period.loeschenFrage")
      : t("budgeting.period.loeschenFrageMitGeld", {
          halbjahr: cycleLabel,
          artTopf: eur(atStake.artFrame),
          run: eur(atStake.run),
          epics: eur(atStake.epicBudgets),
        });

  return (
    <ConfirmMutateForm
      action={deletePeriodAction}
      fields={{ id }}
      label={t("budgeting.period.loeschen")}
      pendingLabel={t("budgeting.period.loeschtGerade")}
      confirmPrompt={prompt}
      variant="outline"
      destructive
      icon={<Trash2 className="mr-1 size-4" />}
    />
  );
}
