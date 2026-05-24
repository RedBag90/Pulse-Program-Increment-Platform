"use client";

import { useActionState } from "react";
import { updateArtAction } from "@/features/art/actions/art";
import { userLabel } from "@/components/detail/initiative-labels";
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
  name: string;
  description: string;
  piCadenceWeeks: number;
  rteId: string;
  /** Users holding the `rte` role — options for the RTE picker. */
  rteUsers: UserOption[];
  userLabels: Record<string, string>;
}

const SELECT =
  "flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Inline editor for an ART's details — the Overview tab. */
export function ArtOverviewForm({
  id,
  name,
  description,
  piCadenceWeeks,
  rteId,
  rteUsers,
  userLabels,
}: Props) {
  const [state, action, isPending] = useActionState(updateArtAction, {});

  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="id" value={id} />

      <div className="space-y-1.5">
        <Label htmlFor="art-name">Name</Label>
        <Input id="art-name" name="name" defaultValue={name} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="art-description">Beschreibung</Label>
        <Textarea id="art-description" name="description" defaultValue={description} rows={4} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="art-cadence">PI-Kadenz (Wochen)</Label>
        <Input
          id="art-cadence"
          name="piCadenceWeeks"
          type="number"
          min={8}
          max={12}
          defaultValue={piCadenceWeeks}
          className="w-32"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="art-rte">RTE (Release Train Engineer)</Label>
        <select id="art-rte" name="rteId" defaultValue={rteId} className={SELECT}>
          <option value="">— Niemand —</option>
          {rteUsers.map((u) => (
            <option key={u.userId} value={u.userId}>
              {userLabel(u.userId, userLabels)}
            </option>
          ))}
        </select>
        {rteUsers.length === 0 && (
          <p className="text-xs text-amber-700">Keine Nutzer mit RTE-Rolle im Mandanten.</p>
        )}
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
