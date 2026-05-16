"use client";

import { useActionState } from "react";
import { deleteStoryAction } from "@/features/story/actions/story";

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
      {state?.error && <span className="text-red-600 text-xs mr-2">{state.error}</span>}
      <button
        type="submit"
        disabled={isPending}
        className="text-red-600 text-xs hover:underline disabled:opacity-50"
        title="Delete story"
      >
        {isPending ? "…" : "✕"}
      </button>
    </form>
  );
}
