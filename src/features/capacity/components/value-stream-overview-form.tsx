"use client";

import { useActionState } from "react";
import { updateValueStreamAction } from "@/features/portfolio/actions/value-stream";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { userLabel } from "@/components/detail/initiative-labels";

export interface UserOption {
  userId: string;
  roles: string[];
}

interface Props {
  id: string;
  name: string;
  description: string;
  budgetAmount: string;
  budgetCurrency: string;
  financeApproverId: string;
  vmoId: string;
  /** All tenant users — options for the Finance Approver picker. */
  users: UserOption[];
  /** Users holding the `vmo` role — options for the VMO picker. */
  vmoUsers: UserOption[];
  userLabels: Record<string, string>;
}

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Inline editor for a Value Stream's details — the Overview tab. */
export function ValueStreamOverviewForm({
  id,
  name,
  description,
  budgetAmount,
  budgetCurrency,
  financeApproverId,
  vmoId,
  users,
  vmoUsers,
  userLabels,
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

      <div className="space-y-1.5">
        <Label htmlFor="vs-finance">Finance Approver</Label>
        <select
          id="vs-finance"
          name="financeApproverId"
          defaultValue={financeApproverId}
          className={SELECT}
        >
          <option value="">— Niemand —</option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>
              {userLabel(u.userId, userLabels)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Nimmt die Epics dieses Wertstroms als Finance-Partei ab.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vs-vmo">VMO</Label>
        <select id="vs-vmo" name="vmoId" defaultValue={vmoId} className={SELECT}>
          <option value="">— Niemand —</option>
          {vmoUsers.map((u) => (
            <option key={u.userId} value={u.userId}>
              {userLabel(u.userId, userLabels)}
            </option>
          ))}
        </select>
        {vmoUsers.length === 0 ? (
          <p className="text-xs text-amber-700">Keine Nutzer mit VMO-Rolle im Mandanten.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Zuständiges Value Management Office.</p>
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
