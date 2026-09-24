"use client";

import { useTranslations } from "next-intl";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteValueStreamAction } from "@/modules/core/org/features/value-stream/actions/value-stream";

interface DeleteValueStreamButtonProps {
  id: string;
  name: string;
}

export function DeleteValueStreamButton({ id, name }: DeleteValueStreamButtonProps) {
  const t = useTranslations();
  return (
    <ConfirmMutateForm
      action={deleteValueStreamAction}
      fields={{ id }}
      label={t("org.ui.delete")}
      pendingLabel="Deleting…"
      confirmPrompt={`Delete value stream "${name}"? This cannot be undone.`}
      variant="ghost"
      destructive
      className="text-xs hover:underline"
    />
  );
}
