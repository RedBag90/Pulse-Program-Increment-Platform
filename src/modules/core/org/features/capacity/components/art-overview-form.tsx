"use client";

import { useActionState } from "react";
import { updateArtAction } from "@/modules/core/org/features/art/actions/art";
import { userLabel } from "@/components/detail/initiative-labels";
import { UserPicker } from "@/components/detail/user-picker";
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
  rteId: string;
  /** Users holding the `rte` role — options for the RTE picker. */
  rteUsers: UserOption[];
  userLabels: Record<string, string>;
}

/** Inline editor for an ART's details — the Overview tab. */
export function ArtOverviewForm({ id, name, description, rteId, rteUsers, userLabels }: Props) {
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

      <div className="space-y-1.5 max-w-xs">
        <Label>RTE (Release Train Engineer)</Label>
        <UserPicker
          name="rteId"
          defaultValue={rteId}
          options={rteUsers.map((u) => ({
            value: u.userId,
            label: userLabel(u.userId, userLabels),
            ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
          }))}
          ariaLabel="RTE (Release Train Engineer)"
          placeholder="— Niemand —"
          emptyLabel="— Niemand —"
        />
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
