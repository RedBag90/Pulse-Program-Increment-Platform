"use client";

import { useActionState } from "react";
import { X } from "lucide-react";
import { deleteStoryAction } from "@/features/story/actions/story";
import { Button } from "@/components/ui/button";

interface DeleteStoryButtonProps {
  id: string;
  artId: string;
  title: string;
}

export function DeleteStoryButton({ id, artId, title }: DeleteStoryButtonProps) {
  const [state, action, isPending] = useActionState(deleteStoryAction, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete story "${title}"?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="artId" value={artId} />
      {state?.error && <span className="text-destructive text-xs mr-1">{state.error}</span>}
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={isPending}
        className="size-6 p-0 text-muted-foreground hover:text-destructive"
        title="Delete story"
      >
        <X className="size-3.5" />
      </Button>
    </form>
  );
}
