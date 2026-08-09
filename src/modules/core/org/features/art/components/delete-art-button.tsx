"use client";

import { Trash2 } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteArtAction } from "@/modules/core/org/features/art/actions/art";

interface DeleteArtButtonProps {
  id: string;
  name: string;
}

export function DeleteArtButton({ id, name }: DeleteArtButtonProps) {
  return (
    <ConfirmMutateForm
      action={deleteArtAction}
      fields={{ id }}
      label={<span className="sr-only">Delete</span>}
      icon={<Trash2 className="size-3.5" />}
      confirmPrompt={`Delete ART "${name}"?`}
      variant="ghost"
      destructive
      className="h-7 px-2 text-muted-foreground"
    />
  );
}
