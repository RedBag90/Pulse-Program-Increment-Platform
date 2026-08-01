"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { X } from "lucide-react";
import { ROLES, ROLE_LABELS, type Role } from "@/domain/roles";
import {
  addTenantMemberAction,
  removeTenantMemberAction,
  type ActionState,
} from "@/features/platform/actions/tenant-actions";
import type { PlatformTenantMember } from "@/server/views/platform-tenants";

/** Mitglieder-Verwaltung eines Tenants: Liste + Entfernen + Hinzufügen/Einladen. */
export function TenantMembers({
  tenantId,
  members,
}: {
  tenantId: string;
  members: PlatformTenantMember[];
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Nutzer</th>
              <th className="px-3 py-2 font-medium">Rolle</th>
              <th className="px-3 py-2 font-medium">Seit</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m) => (
              <tr key={m.assignmentId} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <span className="truncate">{m.email ?? m.userId}</span>
                </td>
                <td className="px-3 py-2">{ROLE_LABELS[m.role]}</td>
                <td className="px-3 py-2 text-muted-foreground">{m.createdAt}</td>
                <td className="px-3 py-2 text-right">
                  <RemoveMemberButton tenantId={tenantId} assignmentId={m.assignmentId} />
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Keine Mitglieder.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddMemberForm tenantId={tenantId} />
    </div>
  );
}

function RemoveMemberButton({
  tenantId,
  assignmentId,
}: {
  tenantId: string;
  assignmentId: string;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<ActionState, FormData>(
    removeTenantMemberAction,
    {},
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <button
        type="submit"
        disabled={isPending}
        aria-label="Mitglied entfernen"
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </form>
  );
}

function AddMemberForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<ActionState, FormData>(
    addTenantMemberAction,
    {},
  );

  useEffect(() => {
    if (state.success && !state.invited) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="min-w-48 flex-1">
        <label htmlFor="am-email" className="mb-1 block text-xs font-medium">
          E-Mail
        </label>
        <input
          id="am-email"
          name="email"
          type="email"
          required
          placeholder="kolleg:in@firma.de"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="am-role" className="mb-1 block text-xs font-medium">
          Rolle
        </label>
        <select
          id="am-role"
          name="role"
          defaultValue={ROLES.TENANT_ADMIN}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {(Object.values(ROLES) as Role[])
            .filter((r) => r !== ROLES.PLATFORM_ADMIN)
            .map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "…" : "Hinzufügen"}
      </button>
      {state.error && <span className="w-full text-sm text-destructive">{state.error}</span>}
      {state.success && state.invited && (
        <span className="w-full text-sm text-primary">Einladung versendet.</span>
      )}
    </form>
  );
}
