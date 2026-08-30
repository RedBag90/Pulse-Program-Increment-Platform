"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { userLabel } from "@/components/detail/initiative-labels";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SectionLabel } from "@/components/ui/section-label";
import type { GatePartyStaffing } from "@/modules/work/server/views/epic-detail";

/** Gemeinsame Basis für die Auswahl-Controls. */
const CONTROL =
  "min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-left text-xs";

export interface TenantApprover {
  userId: string;
  roles: string[];
}

/**
 * A compact dropdown that allows selecting multiple tenant users — the trigger
 * shows the chosen names (or a placeholder), the popover holds a checkbox list.
 * Used per stakeholder party, mirroring the single-select section dropdowns —
 * and reused by the value-stream gate-approver editor.
 */
export function MultiUserSelect({
  options,
  selected,
  onToggle,
  userLabels,
}: {
  options: TenantApprover[];
  selected: Set<string>;
  onToggle: (userId: string) => void;
  userLabels: Record<string, string>;
}) {
  const summary =
    selected.size === 0
      ? "— Personen wählen —"
      : [...selected].map((id) => userLabel(id, userLabels)).join(", ");

  return (
    <Popover>
      <PopoverTrigger className={`flex items-center justify-between gap-2 ${CONTROL}`}>
        <span className={`truncate ${selected.size === 0 ? "text-muted-foreground" : ""}`}>
          {summary}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-72 overflow-y-auto p-1">
        {options.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">Keine Nutzer im Mandanten.</p>
        ) : (
          <ul className="space-y-0.5">
            {options.map((u) => {
              const checked = selected.has(u.userId);
              return (
                <li key={u.userId}>
                  <button
                    type="button"
                    onClick={() => onToggle(u.userId)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted"
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{userLabel(u.userId, userLabels)}</span>{" "}
                      <span className="text-muted-foreground">{u.roles.join(", ")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Die Besetzung der Business-Case-Parteien — **am Reifegrad-Antrag**, nicht mehr
 * in einem eigenen Freigabe-Dialog.
 *
 * Vorher konfigurierte der Epic Owner die Parteien, reichte den Business Case
 * ein und wartete auf fünf Entscheidungen; erst danach war der Schritt L2 → L3.1
 * zu beantragen. Beides ist jetzt ein Vorgang: wer hier ausgewählt wird, nimmt
 * den Schritt ab, und diese Abnahme *ist* die Business-Case-Freigabe.
 *
 * Gesteuert von außen (`selected`/`onToggle`), damit die Auswahl mit dem Antrag
 * in einem Submit rausgeht statt vorher eigens gespeichert zu werden.
 */
export function GatePartyPicker({
  staffing,
  approvers,
  selected,
  onToggle,
  userLabels,
}: {
  staffing: GatePartyStaffing;
  approvers: TenantApprover[];
  /** Rolle → gewählte userIds. */
  selected: Record<string, Set<string>>;
  onToggle: (role: string, userId: string) => void;
  userLabels: Record<string, string>;
}) {
  return (
    <div className="space-y-2">
      <SectionLabel>Abnahme durch</SectionLabel>
      <div className="grid gap-2 sm:grid-cols-2">
        {staffing.roles.map(({ role, label }) => (
          <div key={role} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
            <span className="w-28 shrink-0 text-xs font-medium">{label}</span>
            <MultiUserSelect
              options={approvers}
              selected={selected[role] ?? new Set()}
              onToggle={(userId) => onToggle(role, userId)}
              userLabels={userLabels}
            />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Die gewählten Personen nehmen den Wechsel ab — ihre Zustimmung ist die Freigabe des Business
        Case. Parteien ohne Person bleiben unbesetzt.
      </p>
    </div>
  );
}
