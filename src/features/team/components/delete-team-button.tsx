"use client";

import { Trash2 } from "lucide-react";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { deleteTeamAction } from "@/features/team/actions/team";

interface DeleteTeamButtonProps {
  id: string;
  artId: string;
  name: string;
}

export function DeleteTeamButton({ id, artId, name }: DeleteTeamButtonProps) {
  return (
    <ConfirmMutateForm
      action={deleteTeamAction}
      fields={{ id, artId }}
      label={<span className="sr-only">Delete</span>}
      icon={<Trash2 className="size-3.5" />}
      confirmPrompt={`Delete team "${name}"?`}
      variant="ghost"
      destructive
      className="h-7 px-2 text-muted-foreground"
    />
  );
}
