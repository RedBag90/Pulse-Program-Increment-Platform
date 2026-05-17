"use client";

import { useActionState } from "react";
import { updateTeamAction } from "@/features/team/actions/team";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  artId: string;
  name: string;
  description: string;
  headcount: string;
  targetVelocity: string;
}

/** Inline editor for a Team's details and capacity — the Overview tab. */
export function TeamOverviewForm({
  id,
  artId,
  name,
  description,
  headcount,
  targetVelocity,
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
