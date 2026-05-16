"use client";

import { useActionState } from "react";
import { deleteEpicAction } from "@/features/portfolio/actions/epic";

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
      {state?.error && <span className="text-red-600 text-xs mr-2">{state.error}</span>}
      <button
        type="submit"
        disabled={isPending}
        className="text-red-600 text-xs hover:underline disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
    </form>
  );
}
