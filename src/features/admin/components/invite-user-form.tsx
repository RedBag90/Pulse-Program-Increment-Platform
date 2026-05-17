"use client";

import { useActionState } from "react";
import { inviteUserAction } from "@/features/admin/actions/invite-user";
import { ROLES } from "@/domain/roles";
import type { Role } from "@/domain/roles";

const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Platform Admin",
  tenant_admin: "Tenant Admin",
  portfolio_manager: "Portfolio Manager",
  value_stream_owner: "Value Stream Owner",
  epic_owner: "Epic Owner",
  vmo: "VMO (Epic-QS)",
  rte: "RTE (Feature-QS)",
  feature_owner: "Feature Owner",
  team_editor: "Team Editor",
  story_owner: "Story Owner",
  task_owner: "Task Owner",
  viewer: "Viewer",
};

export function InviteUserForm() {
  const [state, action, isPending] = useActionState(inviteUserAction, {});

  return (
    <form action={action} className="space-y-4 max-w-md">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="colleague@company.com"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium mb-1">
          Role
        </label>
        <select
          id="role"
          name="role"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {(Object.values(ROLES) as Role[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p role="alert" className="text-red-600 text-sm">
          {state.error}
        </p>
      )}

      {state.success && (
        <p role="status" className="text-green-600 text-sm">
          Invitation sent successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {isPending ? "Sending…" : "Send invitation"}
      </button>
    </form>
  );
}
