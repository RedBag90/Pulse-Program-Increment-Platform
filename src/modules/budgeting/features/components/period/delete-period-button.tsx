"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deletePeriodAction } from "@/modules/budgeting/features/actions/period";

/**
 * „Kachel löschen" — Bestätigung + Löschen der Runde (Cascade räumt die
 * Subtree). App-weite Epic-Budgets bleiben (s. Confirm-Text).
 *
 * **Die Umleitung steht in der Aktion**, nicht hier: ein `onSuccess` im Browser
 * kam gegen das Flight-Paket der gelöschten Seite nicht an und endete auf einem
 * 404. Siehe `deletePeriodAction`.
 */
export function DeletePeriodButton({ id }: { id: string }) {
  const t = useTranslations();
  return (
    <ConfirmMutateForm
      action={deletePeriodAction}
      fields={{ id }}
      label={t("budgeting.period.loeschen")}
      pendingLabel="Lösche…"
      confirmPrompt="Diese Kachel inkl. Gruppen, Beteiligten und Verteilungen löschen? Das kann nicht rückgängig gemacht werden. (Bereits finalisierte Epic-Budgets bleiben erhalten.)"
      variant="outline"
      destructive
      icon={<Trash2 className="mr-1 size-4" />}
    />
  );
}
