"use client";

import { useTranslations } from "next-intl";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteFeatureAction } from "@/modules/work/features/feature/actions/feature";

interface DeleteFeatureButtonProps {
  id: string;
  artId: string;
  title: string;
}

export function DeleteFeatureButton({ id, artId, title }: DeleteFeatureButtonProps) {
  const t = useTranslations();
  return (
    <ConfirmMutateForm
      action={deleteFeatureAction}
      fields={{ id, artId }}
      label={t("work.feature.loeschen")}
      pendingLabel="Wird gelöscht …"
      // Hier stand „Alle untergeordneten Stories werden mitgeloescht." Stories
      // gibt es nicht — `InitiativeLevel` kennt EPIC und FEATURE, es gibt kein
      // `Story`-Modell und keine `story.*`-Capability —, und `softDeleteFeature`
      // setzt `deletedAt` auf genau einer Zeile.
      confirmPrompt={`Feature „${title}“ löschen?`}
      variant="ghost"
      destructive
      className="text-xs hover:underline"
    />
  );
}
