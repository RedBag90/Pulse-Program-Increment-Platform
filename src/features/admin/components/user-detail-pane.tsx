"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { assignRoleAction } from "@/features/admin/actions/role-assignment";
import { ROLES, ROLE_LABELS } from "@/modules/core/kernel/domain/roles";
import type { Role } from "@/modules/core/kernel/domain/roles";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScopePicker } from "@/features/admin/components/scope-picker";
import { RoleAssignmentRow } from "@/features/admin/components/role-assignment-row";
import { EraseUserButton } from "@/features/admin/components/erase-user-button";
import type { UserListItem, ValueStreamOption } from "@/server/views/admin-users";

interface Props {
  user: UserListItem;
  valueStreams: ValueStreamOption[];
  canManage: boolean;
  canErase: boolean;
}

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Right-pane editor for the selected user. Three cards:
 *
 * - **Header card** — avatar + email + role count.
 * - **Roles card** — list of `<RoleAssignmentRow>` (read-only summary + Delete
 *   per row) + an inline "+ Rolle hinzufügen" draft form that submits via
 *   `assignRoleAction`. Each row owns its own `useActionState` so deleting
 *   one role doesn't block the rest.
 * - **GDPR card** — Export link + `<EraseUserButton>`, gated separately on
 *   `gdpr.user.erase`.
 *
 * Mirrors `goal-detail-pane.tsx` structure.
 */
export function UserDetailPane({ user, valueStreams, canManage, canErase }: Props) {
  const [draftVisible, setDraftVisible] = useState(false);
  const assignedRoles = new Set<Role>(user.assignments.map((a) => a.role));

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Benutzer</p>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
            aria-hidden
          >
            {user.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium">{user.email ?? user.label}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{user.id}</p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {user.roleCount} {user.roleCount === 1 ? "Rolle" : "Rollen"}
          </span>
        </div>
      </section>

      {/* Roles card */}
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-medium">Rollen</h2>
          {canManage && !draftVisible && (
            <Button type="button" size="sm" variant="outline" onClick={() => setDraftVisible(true)}>
              <Plus className="size-3.5" /> Rolle hinzufügen
            </Button>
          )}
        </div>

        {user.assignments.length === 0 && !draftVisible ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Rollen — mit „Rolle hinzufügen“ die erste zuweisen.
          </p>
        ) : (
          <ul className="space-y-3">
            {user.assignments.map((a) => (
              <li key={a.id}>
                <RoleAssignmentRow
                  assignment={a}
                  targetUserId={user.id}
                  valueStreams={valueStreams}
                  canManage={canManage}
                />
              </li>
            ))}
            {draftVisible && (
              <li>
                <AddRoleDraft
                  targetUserId={user.id}
                  valueStreams={valueStreams}
                  assignedRoles={assignedRoles}
                  onCreated={() => setDraftVisible(false)}
                  onCancel={() => setDraftVisible(false)}
                />
              </li>
            )}
          </ul>
        )}
      </section>

      {/* GDPR card */}
      {canErase && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="font-heading text-sm font-medium">Datenschutz (DSGVO)</h2>
          <p className="text-xs text-muted-foreground">
            Exportiere alles, was Pulse über diese Nutzer:in speichert, oder lösche das Konto
            unwiderruflich.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`/api/v1/admin/users/${user.id}/export`}
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted/50"
            >
              JSON-Export
            </a>
            <EraseUserButton userId={user.id} />
          </div>
        </section>
      )}
    </div>
  );
}

function AddRoleDraft({
  targetUserId,
  valueStreams,
  assignedRoles,
  onCreated,
  onCancel,
}: {
  targetUserId: string;
  valueStreams: ValueStreamOption[];
  assignedRoles: Set<Role>;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(assignRoleAction, {});

  useEffect(() => {
    if (state.success) onCreated();
  }, [state.success, onCreated]);

  // Roles the user doesn't already hold — keeps the picker honest.
  const candidates = (Object.values(ROLES) as Role[]).filter((r) => !assignedRoles.has(r));

  if (candidates.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Alle verfügbaren Rollen sind bereits zugewiesen.
        <button type="button" onClick={onCancel} className="ml-2 text-primary hover:underline">
          Schließen
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-md border bg-card p-3">
      <input type="hidden" name="targetUserId" value={targetUserId} />

      <div className="space-y-1.5">
        <Label htmlFor="new-role" className="text-xs text-muted-foreground">
          Rolle
        </Label>
        <select id="new-role" name="role" required defaultValue="" className={SELECT_CLASS}>
          <option value="" disabled>
            — wählen —
          </option>
          {candidates.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <ScopePicker valueStreams={valueStreams} />

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Speichert…" : "Zuweisen"}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:underline"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
