"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteArtAction } from "@/features/art/actions/art";
import { Button } from "@/components/ui/button";

interface DeleteArtButtonProps {
  id: string;
  name: string;
}

export function DeleteArtButton({ id, name }: DeleteArtButtonProps) {
  const [state, action, isPending] = useActionState(deleteArtAction, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete ART "${name}"?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {state?.error && <span className="text-destructive text-xs block mb-1">{state.error}</span>}
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
