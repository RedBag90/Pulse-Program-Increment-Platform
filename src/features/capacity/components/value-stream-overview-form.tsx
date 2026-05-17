"use client";

import { useActionState } from "react";
import { updateValueStreamAction } from "@/features/portfolio/actions/value-stream";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  name: string;
  description: string;
  budgetAmount: string;
  budgetCurrency: string;
}

/** Inline editor for a Value Stream's details — the Overview tab. */
export function ValueStreamOverviewForm({
  id,
  name,
  description,
  budgetAmount,
  budgetCurrency,
}: Props) {
  const [state, action, isPending] = useActionState(updateValueStreamAction, {});

  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="id" value={id} />

      <div className="space-y-1.5">
        <Label htmlFor="vs-name">Name</Label>
        <Input id="vs-name" name="name" defaultValue={name} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vs-description">Beschreibung</Label>
        <Textarea id="vs-description" name="description" defaultValue={description} rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="vs-budget">Budget</Label>
          <Input
            id="vs-budget"
            name="budgetAmount"
            inputMode="decimal"
            defaultValue={budgetAmount}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vs-currency">Währung</Label>
          <Input
            id="vs-currency"
            name="budgetCurrency"
            maxLength={3}
            defaultValue={budgetCurrency}
            placeholder="EUR"
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
