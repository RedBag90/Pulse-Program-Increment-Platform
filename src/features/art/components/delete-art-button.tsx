"use client";

import { useActionState } from "react";
import { deleteArtAction } from "@/features/art/actions/art";

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
      {state?.error && <span className="text-red-600 text-xs block mb-1">{state.error}</span>}
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
