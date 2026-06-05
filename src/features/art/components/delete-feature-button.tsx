"use client";

import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteFeatureAction } from "@/features/art/actions/feature";

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
      label="Delete"
      pendingLabel="Deleting…"
      confirmPrompt={`Delete feature "${title}"? All child stories will also be deleted.`}
      variant="ghost"
      destructive
      className="text-xs hover:underline"
    />
  );
}
