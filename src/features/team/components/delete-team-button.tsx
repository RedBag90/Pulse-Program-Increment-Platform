"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteTeamAction } from "@/features/team/actions/team";
import { Button } from "@/components/ui/button";

interface DeleteTeamButtonProps {
  id: string;
  artId: string;
  name: string;
}

export function DeleteTeamButton({ id, artId, name }: DeleteTeamButtonProps) {
  const [state, action, isPending] = useActionState(deleteTeamAction, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete team "${name}"?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="artId" value={artId} />
      {state?.error && <span className="text-destructive text-xs mr-2">{state.error}</span>}
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={isPending}
        className="h-7 px-2 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Delete</span>
      </Button>
    </form>
  );
}
