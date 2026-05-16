"use client";

import { useActionState } from "react";
import { deleteTeamAction } from "@/features/team/actions/team";

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
