"use client";

import { useActionState } from "react";
import { updateTeamAction } from "@/features/team/actions/team";
import { userLabel } from "@/components/detail/initiative-labels";
import { TEAM_TYPES, TEAM_TYPE_LABELS } from "@/domain/team-type";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface UserOption {
  userId: string;
  roles: string[];
}

interface Props {
  id: string;
  artId: string;
  name: string;
  description: string;
  headcount: string;
  targetVelocity: string;
  scrumMasterId: string;
  productOwnerId: string;
  teamType: string;
  /** Users holding the `team_editor` role — options for SM/PO pickers. */
  teamUsers: UserOption[];
  userLabels: Record<string, string>;
}

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Inline editor for a Team's details, roles and capacity — the Overview tab. */
export function TeamOverviewForm({
  id,
  artId,
  name,
  description,
  headcount,
  targetVelocity,
  scrumMasterId,
  productOwnerId,
  teamType,
  teamUsers,
  userLabels,
}: Props) {
  const [state, action, isPending] = useActionState(updateTeamAction, {});

  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="artId" value={artId} />

      <div className="space-y-1.5">
        <Label htmlFor="team-name">Name</Label>
        <Input id="team-name" name="name" defaultValue={name} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="team-description">Beschreibung</Label>
        <Textarea id="team-description" name="description" defaultValue={description} rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="team-headcount">Mitgliederzahl</Label>
          <Input
            id="team-headcount"
            name="headcount"
            type="number"
            min={0}
            max={1000}
            defaultValue={headcount}
            placeholder="—"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-velocity">Ziel-Velocity (Punkte/Sprint)</Label>
          <Input
            id="team-velocity"
            name="targetVelocity"
            type="number"
            min={0}
            max={1000}
            defaultValue={targetVelocity}
            placeholder="—"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="team-type">Team-Typ</Label>
        <select id="team-type" name="teamType" defaultValue={teamType} className={SELECT}>
          <option value="">— Kein Typ —</option>
          {TEAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {TEAM_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="team-sm">Scrum Master</Label>
          <select id="team-sm" name="scrumMasterId" defaultValue={scrumMasterId} className={SELECT}>
            <option value="">— Niemand —</option>
            {teamUsers.map((u) => (
              <option key={u.userId} value={u.userId}>
                {userLabel(u.userId, userLabels)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-po">Product Owner</Label>
          <select
            id="team-po"
            name="productOwnerId"
            defaultValue={productOwnerId}
            className={SELECT}
          >
            <option value="">— Niemand —</option>
            {teamUsers.map((u) => (
              <option key={u.userId} value={u.userId}>
                {userLabel(u.userId, userLabels)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {teamUsers.length === 0 && (
        <p className="text-xs text-amber-700">Keine Nutzer mit Team-Rolle im Mandanten.</p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-600">
          Gespeichert.
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Speichert…" : "Änderungen speichern"}
      </Button>
    </form>
  );
}
