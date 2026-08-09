"use client";

import { Trash2 } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteEpicAction } from "@/modules/work/features/portfolio/actions/epic";

interface DeleteEpicButtonProps {
  id: string;
  title: string;
}

export function DeleteEpicButton({ id, title }: DeleteEpicButtonProps) {
  return (
    <ConfirmMutateForm
      action={deleteEpicAction}
      fields={{ id }}
      label={<span className="sr-only">Delete</span>}
      icon={<Trash2 className="size-3.5" />}
      confirmPrompt={`Delete epic "${title}"? All child features and stories will also be deleted.`}
      variant="ghost"
      destructive
      className="h-7 px-2 text-muted-foreground"
    />
  );
}
