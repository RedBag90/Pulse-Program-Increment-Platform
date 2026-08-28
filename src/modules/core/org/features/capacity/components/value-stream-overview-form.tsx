"use client";

import { useActionState } from "react";
import { updateValueStreamAction } from "@/modules/core/org/features/value-stream/actions/value-stream";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/detail/user-picker";
import { userLabel } from "@/components/detail/initiative-labels";
import type { SearchSelectOption } from "@/components/ui/search-select";

export interface UserOption {
  userId: string;
  roles: string[];
}

/** UserOption[] → suchbare Optionen; Rollen werden als `hint` mitgesucht. */
function toUserOptions(
  users: UserOption[],
  userLabels: Record<string, string>,
): SearchSelectOption[] {
  return users.map((u) => ({
    value: u.userId,
    label: userLabel(u.userId, userLabels),
    ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
  }));
}

interface Props {
  id: string;
  name: string;
  description: string;
  financeApproverId: string;
  vmoId: string;
  /** All tenant users — options for the Finance Approver picker. */
  users: UserOption[];
  /** Users holding the `portfolio_manager` role — options for the VS reviewer picker. */
  vmoUsers: UserOption[];
  userLabels: Record<string, string>;
}

/** Inline editor for a Value Stream's details — the Overview tab. */
export function ValueStreamOverviewForm({
  id,
  name,
  description,
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

      <div className="space-y-1.5">
        <Label>Finance Approver</Label>
        <UserPicker
          name="financeApproverId"
          defaultValue={financeApproverId}
          options={toUserOptions(users, userLabels)}
          ariaLabel="Finance Approver"
          placeholder="— Niemand —"
          emptyLabel="— Niemand —"
        />
        <p className="text-xs text-muted-foreground">
          Nimmt die Epics dieses Wertstroms als Finance-Partei ab.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Portfolio Manager</Label>
        <UserPicker
          name="vmoId"
          defaultValue={vmoId}
          options={toUserOptions(vmoUsers, userLabels)}
          ariaLabel="Portfolio Manager"
          placeholder="— Niemand —"
          emptyLabel="— Niemand —"
        />
        {vmoUsers.length === 0 ? (
          <p className="text-xs text-amber-700">
            Keine Nutzer mit Portfolio-Manager-Rolle im Mandanten.
          </p>
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
