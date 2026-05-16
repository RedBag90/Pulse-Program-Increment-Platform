"use client";

import { useActionState } from "react";
import { deleteValueStreamAction } from "@/features/portfolio/actions/value-stream";

interface DeleteValueStreamButtonProps {
  id: string;
  name: string;
}

export function DeleteValueStreamButton({ id, name }: DeleteValueStreamButtonProps) {
  const [state, action, isPending] = useActionState(deleteValueStreamAction, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete value stream "${name}"? This cannot be undone.`)) e.preventDefault();
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
