"use client";

import { useActionState } from "react";
import { assignRoleAction } from "@/features/admin/actions/role-assignment";
import { ROLES } from "@/domain/roles";
import { ScopePicker } from "@/features/admin/components/scope-picker";
import type { Role } from "@/domain/roles";

const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Platform Admin",
  tenant_admin: "Tenant Admin",
  portfolio_editor: "Portfolio Editor",
  architect_viewer: "Architect Viewer",
  art_full_editor: "ART Full Editor",
  feature_editor: "Feature Editor",
  art_arch_viewer: "ART Architect Viewer",
  team_editor: "Team Editor",
  story_owner: "Story Owner",
  task_owner: "Task Owner",
  portfolio_viewer: "Portfolio Viewer",
};

interface ValueStream {
  id: string;
  name: string;
  arts: { id: string; name: string }[];
}

interface AddRoleFormProps {
  targetUserId: string;
  valueStreams: ValueStream[];
}

export function AddRoleForm({ targetUserId, valueStreams }: AddRoleFormProps) {
  const [state, action, isPending] = useActionState(assignRoleAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="targetUserId" value={targetUserId} />

      <div>
        <label htmlFor="role" className="block text-sm font-medium mb-1">
          Role
        </label>
        <select
          id="role"
          name="role"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {(Object.values(ROLES) as Role[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      <ScopePicker valueStreams={valueStreams} />

      {state.error && (
        <p role="alert" className="text-red-600 text-sm">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-green-600 text-sm">
          Role assigned successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {isPending ? "Assigning…" : "Assign role"}
      </button>
    </form>
  );
}
