"use client";

import { X } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteStoryAction } from "@/features/story/actions/story";

interface DeleteStoryButtonProps {
  id: string;
  artId: string;
  title: string;
}

export function DeleteStoryButton({ id, artId, title }: DeleteStoryButtonProps) {
  return (
    <ConfirmMutateForm
      action={deleteStoryAction}
      fields={{ id, artId }}
      label={<span className="sr-only">Delete story</span>}
      icon={<X className="size-3.5" />}
      confirmPrompt={`Delete story "${title}"?`}
      variant="ghost"
      destructive
      className="size-6 p-0 text-muted-foreground"
    />
  );
}
