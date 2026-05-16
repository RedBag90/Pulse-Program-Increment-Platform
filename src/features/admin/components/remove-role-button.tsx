"use client";

import { useActionState } from "react";
import { removeRoleAction } from "@/features/admin/actions/role-assignment";

interface RemoveRoleButtonProps {
  assignmentId: string;
  targetUserId: string;
  role: string;
}

export function RemoveRoleButton({ assignmentId, targetUserId, role }: RemoveRoleButtonProps) {
  const [state, action, isPending] = useActionState(removeRoleAction, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Remove role "${role}" from this user?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="targetUserId" value={targetUserId} />
      <input type="hidden" name="role" value={role} />
      {state.error && <span className="text-destructive text-xs mr-2">{state.error}</span>}
      <button
        type="submit"
        disabled={isPending}
        className="text-destructive text-xs hover:underline disabled:opacity-50"
      >
        {isPending ? "Removing…" : "Remove"}
      </button>
    </form>
  );
}
