"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { Check, Plus } from "lucide-react";
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
 * **Die Bedienung ist die der Rollenverteilung** (`structure/rollen`,
 * `role-slot.tsx`): der Name ist ein Knopf, ein Klick oeffnet den Picker, die
 * Auswahl **speichert sofort**, und ein Haken bestaetigt kurz. Vorher standen
 * hier Picker und ein „Owner zuweisen"-Knopf dauerhaft untereinander — drei
 * Bedienelemente fuer eine Angabe, und der Knopf war meistens ausgegraut, weil
 * die Auswahl schon stimmte.
 *
 * **„— Niemand —" entfernt die Benennung.** Das ging vorher nicht: der Knopf
 * blieb bei leerer Auswahl aus, und die Action verlangte eine UUID. Wer sich
 * vertat, musste eine falsche Person stehen lassen.
 *
 * **Die erste Benennung stempelt `selectedForDetailingAt`** (set-once, im
 * Service). Das bewegt den Reifegrad **nicht** — es bewegt die Karte im Kanban
 * von „Funnel" nach „Hypothese", denn ab da wird an der Hypothese gearbeitet.
 * Ein spaeteres Entbenennen nimmt den Stempel nicht zurueck: die Erstsichtung
 * hat stattgefunden.
 */
export function EpicOwnerAssign({ epicId, ownerId, canAssignOwner, approvers, userLabels }: Props) {
  const [state, action, pending] = useActionState(assignEpicOwnerAction, {});
  const [open, setOpen] = useState(false);
  const saved = useTransientFlag(state.success === true);
  const ownerName = ownerId ? userLabel(ownerId, userLabels) : null;

  function save(next: string) {
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("ownerId", next);
    startTransition(() => action(fd));
    setOpen(false);
  }

  if (open && canAssignOwner) {
    return (
      <div className="space-y-1">
        <UserPicker
          value={ownerId ?? ""}
          onChange={save}
          options={approvers.map((u) => ({
            value: u.userId,
            label: userLabel(u.userId, userLabels),
            ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
          }))}
          ariaLabel="Epic Owner"
          placeholder="Nicht zugewiesen"
          emptyLabel="— Niemand —"
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-meta text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Abbrechen
        </button>
      </div>
    );
  }

  const person = (
    <span className="flex min-w-0 items-center gap-2">
      {ownerName ? (
        <>
          <Avatar size="sm">
            <AvatarFallback>{initials(ownerName)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm">{ownerName}</span>
        </>
      ) : (
        <>
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed text-muted-foreground">
            <Plus className="size-3" aria-hidden />
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {canAssignOwner ? "Benennen" : "Nicht zugewiesen"}
          </span>
        </>
      )}
      {saved && <Check className="size-3.5 shrink-0 text-success" aria-hidden />}
    </span>
  );

  return (
    <div>
      {canAssignOwner ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          // Ein `aria-label` **ersetzt** den Inhalt des Buttons, statt ihn zu
          // ergaenzen — der Name gehoert also hinein.
          aria-label={ownerName ? `Epic Owner: ${ownerName}. Ändern` : "Epic Owner benennen"}
          className="-mx-1.5 w-full rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {person}
        </button>
      ) : (
        person
      )}
      <span role="status" className="sr-only">
        {saved ? "Epic Owner gespeichert" : ""}
      </span>
      {state.error && (
        <p role="alert" className="pt-1 text-meta text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}

/**
 * Ein Erfolg ist ein **Ereignis**, kein Zustand. `state.success` bleibt bis zum
 * naechsten Laden gesetzt; ohne diesen Haken staende der Haken fuer immer da.
 */
function useTransientFlag(on: boolean, ms = 2500): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) return;
    setShown(true);
    const t = window.setTimeout(() => setShown(false), ms);
    return () => window.clearTimeout(t);
  }, [on, ms]);
  return shown;
}
