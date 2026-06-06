"use client";

import { useActionState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { removeRoleAction } from "@/features/admin/actions/role-assignment";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/domain/roles";
import type { RoleAssignmentView, ValueStreamOption } from "@/server/views/admin-users";

interface Props {
  assignment: RoleAssignmentView;
  targetUserId: string;
  valueStreams: ValueStreamOption[];
  canManage: boolean;
  /** Notified after a successful delete so the parent can drop the row early. */
  onDeleted?: (() => void) | undefined;
}

/**
 * One role assignment as a compact read-only summary + Delete button.
 *
 * Why no inline scope edit: the `role-assignment` service exposes
 * `assignRole` (insert) and `removeRole` (delete); changing a scope is
 * remove + re-add. The detail pane's "+ Rolle hinzufügen" form below this
 * list lets the user re-assign with the new scope. Keeping scope edit out
 * of this row keeps the model simple — one assignment is identified by
 * `(userId, role)` and the only mutations are add or remove.
 *
 * Per-row `useActionState` so deleting one assignment doesn't disable any
 * other row.
 */
export function RoleAssignmentRow({
  assignment,
  targetUserId,
  valueStreams,
  canManage,
  onDeleted,
}: Props) {
  const [state, action, pending] = useActionState(removeRoleAction, {});

  useEffect(() => {
    if (state.success && onDeleted) onDeleted();
  }, [state.success, onDeleted]);

  function remove() {
    if (!window.confirm(`Rolle „${ROLE_LABELS[assignment.role]}" entfernen?`)) return;
    const fd = new FormData();
    fd.set("assignmentId", assignment.id);
    fd.set("targetUserId", targetUserId);
    fd.set("role", assignment.role);
    action(fd);
  }

  const vsLabels = lookupNames(assignment.valueStreamIds, valueStreams, "vs");
  const artLabels = lookupNames(assignment.artIds, valueStreams, "art");

  return (
    <div className="space-y-2 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{ROLE_LABELS[assignment.role]}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">seit {assignment.createdAt}</p>
        </div>
        {canManage && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={pending}
            aria-label="Rolle entfernen"
            onClick={remove}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <ScopeChip label="Wertströme">
          {vsLabels.length === 0 ? "Alle" : vsLabels.join(", ")}
        </ScopeChip>
        <ScopeChip label="ARTs">{artLabels.length === 0 ? "Alle" : artLabels.join(", ")}</ScopeChip>
        {assignment.teamIds.length > 0 && (
          <ScopeChip label="Teams">{assignment.teamIds.length} ausgewählt</ScopeChip>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}

function ScopeChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{children}</span>
    </span>
  );
}

function lookupNames(
  ids: string[],
  valueStreams: ValueStreamOption[],
  kind: "vs" | "art",
): string[] {
  if (ids.length === 0) return [];
  const names: string[] = [];
  for (const id of ids) {
    if (kind === "vs") {
      const vs = valueStreams.find((v) => v.id === id);
      if (vs) names.push(vs.name);
    } else {
      for (const vs of valueStreams) {
        const art = vs.arts.find((a) => a.id === id);
        if (art) {
          names.push(art.name);
          break;
        }
      }
    }
  }
  return names;
}
