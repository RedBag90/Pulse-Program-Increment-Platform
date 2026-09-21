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
 * **Der Epic Owner: wer er ist, und — fuer wen es darf — wer er wird.**
 *
 * Sie steht im Reiter **Overview**, Panel „Zuordnung". Bis September 2026 stand
 * sie zusaetzlich im Reifegrad-Reiter, aufgeklappt am Meilenstein Erstsichtung —
 * zwei Stellen fuer dieselbe Benennung, und die Timeline war die aeltere. Das
 * Tor-Kriterium „Epic Owner ist benannt" verlinkte immer schon hierher
 * (`gate-readiness.ts`, `epic-gate-card.tsx`); seit die Timeline die Zuweisung
 * abgegeben hat, stimmt sein Hilfetext.
 *
 * **Die erste Benennung stempelt `selectedForDetailingAt`** (set-once, im
 * Service). Das bewegt den Reifegrad **nicht** — es bewegt die Karte im Kanban
 * von „Funnel" nach „Hypothese", denn ab da wird an der Hypothese gearbeitet.
 *
 * Ein einmal gesetzter Owner laesst sich hier nicht mehr entfernen, nur
 * ersetzen: der Knopf bleibt bei leerer Auswahl aus, und die Action verlangt
 * eine UUID. `FeatureOwnerAssign` kann es — siehe deren Test.
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
        <div className="flex flex-col gap-2">
          <div className="min-w-0">
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
            className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "…" : "Owner zuweisen"}
          </button>
          {state.error && <span className="text-xs text-destructive">{state.error}</span>}
        </div>
      )}
    </div>
  );
}
