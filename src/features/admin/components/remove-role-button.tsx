"use client";

import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import { removeRoleAction } from "@/features/admin/actions/role-assignment";

interface RemoveRoleButtonProps {
  assignmentId: string;
  targetUserId: string;
  role: string;
}

export function RemoveRoleButton({ assignmentId, targetUserId, role }: RemoveRoleButtonProps) {
  return (
    <ConfirmMutateForm
      action={removeRoleAction}
      fields={{ assignmentId, targetUserId, role }}
      label="Remove"
      pendingLabel="Removing…"
      confirmPrompt={`Remove role "${role}" from this user?`}
      variant="ghost"
      destructive
      className="text-xs hover:underline"
    />
  );
}
