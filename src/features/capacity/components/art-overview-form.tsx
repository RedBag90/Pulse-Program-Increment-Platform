"use client";

import { useActionState } from "react";
import { updateArtAction } from "@/features/art/actions/art";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  name: string;
  description: string;
  piCadenceWeeks: number;
}

/** Inline editor for an ART's details — the Overview tab. */
export function ArtOverviewForm({ id, name, description, piCadenceWeeks }: Props) {
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
