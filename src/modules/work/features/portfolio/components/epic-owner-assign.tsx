"use client";

import { useActionState, useState, startTransition } from "react";
import { assignEpicOwnerAction } from "@/modules/work/features/portfolio/actions/timeline";
import { userLabel, initials } from "@/components/detail/initiative-labels";
import { UserPicker } from "@/components/detail/user-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Approver {
  userId: string;
  roles: string[];
}

interface Props {
  epicId: string;
  ownerId: string | null;
  /** May nominate/replace the Epic owner (`epic.owner.assign`). */
  canAssignOwner: boolean;
  approvers: Approver[];
  userLabels: Record<string, string>;
}

/**
 * Epic owner — current owner plus, for authorised roles, the nomination control
 * (the Portfolio Manager and roles above it). Lives in the Timeline's "Selected for
 * Detailing" phase; assigning the first owner is what advances the Epic out of the Funnel.
 */
export function EpicOwnerAssign({ epicId, ownerId, canAssignOwner, approvers, userLabels }: Props) {
  const [state, action, pending] = useActionState(assignEpicOwnerAction, {});
  const [sel, setSel] = useState(ownerId ?? "");
  const ownerName = ownerId ? userLabel(ownerId, userLabels) : null;

  function assign() {
    if (!sel) return;
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("ownerId", sel);
    startTransition(() => action(fd));
  }

  return (
    <div className="space-y-2">
      {ownerName ? (
        <span className="flex items-center gap-2 text-sm">
          <Avatar size="sm">
            <AvatarFallback>{initials(ownerName)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{ownerName}</span>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Nicht zugewiesen</span>
      )}

      {canAssignOwner && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 max-w-[18rem] flex-1">
            <UserPicker
              value={sel}
              onChange={setSel}
              options={approvers.map((u) => ({
                value: u.userId,
                label: userLabel(u.userId, userLabels),
                ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
              }))}
              ariaLabel="Epic Owner"
              placeholder="— kein Owner —"
              emptyLabel="— kein Owner —"
            />
          </div>
          <button
            type="button"
            onClick={assign}
            disabled={pending || sel === "" || sel === (ownerId ?? "")}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "…" : "Owner zuweisen"}
          </button>
          {state.error && <span className="text-xs text-destructive">{state.error}</span>}
        </div>
      )}
    </div>
  );
}
