"use client";

import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteValueStreamAction } from "@/features/portfolio/actions/value-stream";

interface DeleteValueStreamButtonProps {
  id: string;
  name: string;
}

export function DeleteValueStreamButton({ id, name }: DeleteValueStreamButtonProps) {
  return (
    <ConfirmMutateForm
      action={deleteValueStreamAction}
      fields={{ id }}
      label="Delete"
      pendingLabel="Deleting…"
      confirmPrompt={`Delete value stream "${name}"? This cannot be undone.`}
      variant="ghost"
      destructive
      className="text-xs hover:underline"
    />
  );
}
