"use client";

import { useActionState, useState, startTransition } from "react";
import { configureApproversAction } from "@/features/portfolio/actions/epic-approval";
import { APPROVAL_PARTIES, type ApprovalParty } from "@/domain/business-case";

const PARTY_LABELS: Record<ApprovalParty, string> = {
  mgmt: "MGMT",
  business_owner: "Business Owner",
  finance: "Finance",
  irt_owner: "IRT-Owner",
  lace_vmo: "LACE/VMO",
};

export interface TenantApprover {
  userId: string;
  roles: string[];
}

interface Props {
  epicId: string;
  approvers: TenantApprover[];
  /** Currently assigned user ids per party (to prefill the selection). */
  current: Record<ApprovalParty, string[]>;
}

/**
 * Lets the Epic Owner pick, per approval party, one or more tenant users whose
 * sign-off is required. Serialises the selection and posts configureApprovers.
 */
export function ApproverPicker({ epicId, approvers, current }: Props) {
  const [state, action, pending] = useActionState(configureApproversAction, {});
  const [selected, setSelected] = useState<Record<ApprovalParty, Set<string>>>(() => {
    const init = {} as Record<ApprovalParty, Set<string>>;
    for (const p of APPROVAL_PARTIES) init[p] = new Set(current[p] ?? []);
    return init;
  });

  function toggle(party: ApprovalParty, userId: string) {
    setSelected((prev) => {
      const next = new Set(prev[party]);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return { ...prev, [party]: next };
    });
  }

  function submit() {
    const assignments = APPROVAL_PARTIES.map((party) => ({
      party,
      userIds: [...selected[party]],
    })).filter((a) => a.userIds.length > 0);
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("assignments", JSON.stringify(assignments));
    startTransition(() => action(fd));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Wähle je Partei die Personen, deren Freigabe du einholen willst (Mehrfachauswahl möglich).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {APPROVAL_PARTIES.map((party) => (
          <fieldset key={party} className="rounded border p-3">
            <legend className="px-1 text-sm font-medium">{PARTY_LABELS[party]}</legend>
            {approvers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Nutzer im Mandanten.</p>
            ) : (
              <ul className="space-y-1">
                {approvers.map((u) => (
                  <li key={u.userId} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      id={`${party}-${u.userId}`}
                      checked={selected[party].has(u.userId)}
                      onChange={() => toggle(party, u.userId)}
                      className="h-3.5 w-3.5"
                    />
                    <label htmlFor={`${party}-${u.userId}`} className="flex-1 truncate">
                      <span className="font-mono">{u.userId.slice(0, 8)}…</span>{" "}
                      <span className="text-muted-foreground">{u.roles.join(", ")}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        ))}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-600">
          Approver gespeichert.
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Speichern…" : "Approver speichern"}
      </button>
    </div>
  );
}
