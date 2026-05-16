"use client";

import { useActionState } from "react";
import { deleteFeatureAction } from "@/features/art/actions/feature";

interface DeleteFeatureButtonProps {
  id: string;
  artId: string;
  title: string;
}

export function DeleteFeatureButton({ id, artId, title }: DeleteFeatureButtonProps) {
  const [state, action, isPending] = useActionState(deleteFeatureAction, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete feature "${title}"? All child stories will also be deleted.`))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="artId" value={artId} />
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
