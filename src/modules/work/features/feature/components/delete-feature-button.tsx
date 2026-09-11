"use client";

import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteFeatureAction } from "@/modules/work/features/feature/actions/feature";

interface DeleteFeatureButtonProps {
  id: string;
  artId: string;
  title: string;
}

export function DeleteFeatureButton({ id, artId, title }: DeleteFeatureButtonProps) {
  return (
    <ConfirmMutateForm
      action={deleteFeatureAction}
      fields={{ id, artId }}
      label="Löschen"
      pendingLabel="Wird gelöscht …"
      confirmPrompt={`Feature „${title}“ löschen? Alle untergeordneten Stories werden mitgelöscht.`}
      variant="ghost"
      destructive
      className="text-xs hover:underline"
    />
  );
}
