"use client";

import { useActionState } from "react";
import { inviteUserAction } from "@/features/admin/actions/invite-user";
import { ROLES, ROLE_LABELS } from "@/domain/roles";
import type { Role } from "@/domain/roles";

/**
 * Invite-by-email form. Embedded in the master-detail "Einladen"-Pane.
 * `inviteUserAction` returns `{ success: true }` on a successful invite;
 * the parent shell clears the selection back to the list on success.
 */
export function InviteUserForm() {
  const [state, action, isPending] = useActionState(inviteUserAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="kolleg:in@firma.de"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium mb-1">
          Rolle
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
          Einladung erfolgreich versendet.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {isPending ? "Wird versendet…" : "Einladung versenden"}
      </button>
    </form>
  );
}
