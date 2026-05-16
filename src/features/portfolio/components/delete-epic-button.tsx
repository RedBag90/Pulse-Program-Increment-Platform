"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteEpicAction } from "@/features/portfolio/actions/epic";
import { Button } from "@/components/ui/button";

interface DeleteEpicButtonProps {
  id: string;
  title: string;
}

export function DeleteEpicButton({ id, title }: DeleteEpicButtonProps) {
  const [state, action, isPending] = useActionState(deleteEpicAction, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(`Delete epic "${title}"? All child features and stories will also be deleted.`)
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
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
