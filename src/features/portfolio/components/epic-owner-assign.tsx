"use client";

import { useActionState, useState, startTransition } from "react";
import { ChevronsUpDown } from "lucide-react";
import { assignEpicOwnerAction } from "@/features/portfolio/actions/timeline";
import { userLabel, initials } from "@/components/detail/initiative-labels";
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

// Einheitliche Control-Sprache wie im ApproverPicker (natives Select + Overlay-Chevron).
const SELECT =
  "w-full max-w-[18rem] appearance-none rounded-md border border-input bg-background px-2 py-1.5 pr-7 text-xs shadow-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

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
          <div className="relative min-w-0">
            <select
              aria-label="Epic Owner"
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              className={SELECT}
            >
              <option value="">— kein Owner —</option>
              {approvers.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {userLabel(u.userId, userLabels)} ({u.roles.join(", ")})
                </option>
              ))}
            </select>
            <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
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
