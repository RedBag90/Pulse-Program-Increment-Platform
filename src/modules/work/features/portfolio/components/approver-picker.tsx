"use client";

import { useActionState, useState, startTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { configureApproversAction } from "@/modules/work/features/portfolio/actions/epic-approval";
import { APPROVAL_PARTIES, type ApprovalParty } from "@/modules/work/domain/business-case";
import { APPROVAL_SECTIONS, type ApprovalSection } from "@/modules/work/domain/epic-approval";
import { userLabel } from "@/components/detail/initiative-labels";
import { UserPicker } from "@/components/detail/user-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SectionLabel } from "@/components/ui/section-label";

/** Gemeinsame Basis für alle Auswahl-Controls (Parteien-Trigger + Sektions-Select). */
const CONTROL =
  "min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-left text-xs";

const PARTY_LABELS: Record<ApprovalParty, string> = {
  mgmt: "MGMT",
  business_owner: "Business Owner",
  finance: "Finance",
  irt_owner: "IRT-Owner",
  lace_vmo: "LACE/VMO",
};

const SECTION_LABELS: Record<ApprovalSection, string> = {
  breakdown: "Deliverables",
  kpis: "KPIs",
};

/**
 * Roles that may sign off a content section (mirrors the `epic.section.signoff`
 * policy grant; admins pass via `authorize()`). The owner can only pick from
 * users who hold one of these, so the assignment can't be blocked downstream.
 */
const SECTION_REVIEWER_ROLES = new Set([
  "value_stream_owner",
  "portfolio_manager",
  "tenant_admin",
  "platform_admin",
]);

export interface TenantApprover {
  userId: string;
  roles: string[];
}

interface Props {
  epicId: string;
  approvers: TenantApprover[];
  /** Currently assigned user ids per party (to prefill the selection). */
  current: Record<ApprovalParty, string[]>;
  /** Currently assigned owner per section (to prefill the selection). */
  currentSections: Record<ApprovalSection, string>;
  /** Resolved user-id → display label (email) map. */
  userLabels: Record<string, string>;
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
 * Lets the Epic Owner pick the approvers for an Epic's Business Case: one or
 * more tenant users per stakeholder party, plus one responsible reviewer for
 * each content section (Breakdown, KPIs). Serialises both and posts
 * configureApprovers.
 */
export function ApproverPicker({ epicId, approvers, current, currentSections, userLabels }: Props) {
  const [state, action, pending] = useActionState(configureApproversAction, {});
  const [selected, setSelected] = useState<Record<ApprovalParty, Set<string>>>(() => {
    const init = {} as Record<ApprovalParty, Set<string>>;
    for (const p of APPROVAL_PARTIES) init[p] = new Set(current[p] ?? []);
    return init;
  });
  const [sectionOwners, setSectionOwners] = useState<Record<ApprovalSection, string>>(() => {
    const init = {} as Record<ApprovalSection, string>;
    for (const s of APPROVAL_SECTIONS) init[s] = currentSections[s] ?? "";
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
    const sections = APPROVAL_SECTIONS.map((section) => ({
      section,
      userId: sectionOwners[section],
    })).filter((s) => s.userId !== "");
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("assignments", JSON.stringify(assignments));
    fd.set("sections", JSON.stringify(sections));
    startTransition(() => action(fd));
  }

  const sectionEligible = approvers.filter((u) =>
    u.roles.some((r) => SECTION_REVIEWER_ROLES.has(r)),
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Wähle je Partei die Personen, deren Freigabe du einholen willst (Mehrfachauswahl möglich).
      </p>
      <div className="space-y-2">
        <SectionLabel>Stakeholder-Parteien</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {APPROVAL_PARTIES.map((party) => (
            <div
              key={party}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
            >
              <span className="w-28 shrink-0 text-xs font-medium">{PARTY_LABELS[party]}</span>
              <MultiUserSelect
                options={approvers}
                selected={selected[party]}
                onToggle={(userId) => toggle(party, userId)}
                userLabels={userLabels}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <SectionLabel>Inhaltliche Abnahmen</SectionLabel>
        <p className="text-xs text-muted-foreground">
          Deliverables und KPIs sind Teil des Business Case — lege je einen Verantwortlichen fest,
          der den Abschnitt für die Freigabe abnimmt.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {APPROVAL_SECTIONS.map((section) => (
            <div
              key={section}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
            >
              <label htmlFor={`section-${section}`} className="w-28 shrink-0 text-xs font-medium">
                {SECTION_LABELS[section]}
              </label>
              <div className="min-w-0 flex-1">
                <UserPicker
                  value={sectionOwners[section] ?? ""}
                  onChange={(v) => setSectionOwners((prev) => ({ ...prev, [section]: v }))}
                  options={sectionEligible.map((u) => ({
                    value: u.userId,
                    label: userLabel(u.userId, userLabels),
                    ...(u.roles.length ? { hint: u.roles.join(", ") } : {}),
                  }))}
                  ariaLabel={`${SECTION_LABELS[section]} — Verantwortliche/r`}
                  placeholder="— Verantwortlichen wählen —"
                  emptyLabel="— Verantwortlichen wählen —"
                />
              </div>
            </div>
          ))}
        </div>
        {sectionEligible.length === 0 && (
          <p className="text-xs text-amber-700">
            Im Mandanten gibt es keine Nutzer mit Abnahme-Rolle (Value-Stream-Owner oder
            Portfolio-Manager).
          </p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-xs text-emerald-600">
          Approver gespeichert.
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Speichern…" : "Approver speichern"}
      </button>
    </div>
  );
}
