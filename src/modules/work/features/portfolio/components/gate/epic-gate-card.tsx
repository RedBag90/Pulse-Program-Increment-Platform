"use client";

import { useActionState, useState, startTransition } from "react";
import { ArrowUp, ArrowRight, Check, Circle, CircleDot, LifeBuoy, Undo2, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  requestGateTransitionAction,
  decideGateTransitionAction,
  withdrawGateTransitionAction,
} from "@/modules/work/features/portfolio/actions/stage-gate";
import { setEpicHelpRequestedAction } from "@/modules/work/features/portfolio/actions/epic";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { EpicGateSlice } from "@/modules/work/server/views/epic-detail";
import {
  GatePartyPicker,
  type TenantApprover,
} from "@/modules/work/features/portfolio/components/approver-picker";
import { GateRevertDialog } from "./gate-revert-dialog";

/**
 * Die **eine** Affordanz für den Reifegrad-Wechsel.
 *
 * Vorher gab es vier: ein Vorschlags-Banner, zwei fest verdrahtete Buttons im
 * Timeline-Tab (je einer für L1→L2 und L3→L4) und einen eigenen Impact-Dialog
 * für L4→L5 — jede mit eigener Sichtbarkeitsregel, eine davon mit einer
 * client-seitigen Kopie der Übergangsregeln. Hier ist es ein Vorgang mit drei
 * Zuständen, die sich gegenseitig ausschliessen:
 *
 *   1. kein Antrag offen  → Kriterien-Checkliste + „Push beantragen"
 *   2. Antrag offen       → wer noch fehlt + „Antrag zurückziehen"
 *   3. ich bin Abnehmer   → Freigeben / In Klärung / Ablehnen
 *
 * Welcher Zustand gilt, entscheidet die Slice im Read-Model — nicht diese
 * Komponente.
 */

const PRIMARY =
  "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const GHOST =
  "inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50";
const APPROVE =
  "rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const REJECT =
  "rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";
const CLARIFY =
  "rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50";

function gateLabel(gate: string): string {
  return STAGE_GATE_LABELS[gate] ?? gate;
}

/**
 * Sprungziel je Freigabe-Kriterium: der Ort, an dem man es erfüllt. Nach
 * Kriterium-`key` (SSOT: `gate-readiness.ts`). Tab-Ziele landen auf der
 * Epic-Seite via `?tab=`, zwei Kriterien zeigen in andere Bereiche.
 * Fehlt ein Eintrag (künftiges Kriterium), wird nur der Hilfetext gezeigt.
 */
const CRITERION_TARGET: Record<string, { href: (epicId: string) => string; label: string }> = {
  hypothesis_drafted: {
    href: (id) => `/portfolio/epics/${id}?tab=benefit-hypothesis`,
    label: "Zur Hypothese",
  },
  hypothesis_approved: {
    href: (id) => `/portfolio/epics/${id}?tab=benefit-hypothesis`,
    label: "Zur Hypothese",
  },
  owner_nominated: {
    href: (id) => `/portfolio/epics/${id}?tab=overview`,
    label: "Zum Overview",
  },
  business_case_started: {
    href: (id) => `/portfolio/epics/${id}?tab=business-case`,
    label: "Zum Business Case",
  },
  business_case_drafted: {
    href: (id) => `/portfolio/epics/${id}?tab=business-case`,
    label: "Zum Business Case",
  },
  budget_allocated: {
    href: () => "/budgeting/periods",
    label: "Zum Budgeting",
  },
  feature_started: {
    href: (id) => `/portfolio/epics/${id}?tab=breakdown`,
    label: "Zu den Deliverables",
  },
  features_completed: {
    href: (id) => `/umsetzung?epic=${id}`,
    label: "Zum Delivery-Cockpit",
  },
};

interface Props {
  epicId: string;
  gate: EpicGateSlice;
  /** Personenpool des Mandanten — Quelle des Abnehmer-Pickers am Antrag. */
  approvers: TenantApprover[];
  /** userId → Anzeigename, wie überall auf der Epic-Seite. */
  userLabels: Record<string, string>;
}

export function EpicGateCard({ epicId, gate, approvers, userLabels }: Props) {
  if (gate.disabled) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium">Reifegrad:</span> {gateLabel(gate.current)}
          {gate.next && (
            <span className="text-muted-foreground"> → nächster: {gateLabel(gate.next)}</span>
          )}
        </p>
        {gate.canRevert && <GateRevertDialog epicId={epicId} current={gate.current} />}
      </div>

      {gate.openRequest ? (
        <OpenRequest gate={gate} userLabels={userLabels} />
      ) : (
        <NoRequest epicId={epicId} gate={gate} approvers={approvers} userLabels={userLabels} />
      )}

      {gate.canRequestHelp && <HelpRequestControl epicId={epicId} requested={gate.helpRequested} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// „I need help" — Owner-only
// ---------------------------------------------------------------------------

/**
 * Der Epic-Owner bittet um Unterstützung: ankreuzen stempelt `helpRequestedAt`,
 * und in „Meine Tasks" erscheint bei VMO und Portfolio-Management ein Hinweis.
 * Abhaken nimmt die Bitte zurück.
 */
function HelpRequestControl({ epicId, requested }: { epicId: string; requested: boolean }) {
  const [state, action, pending] = useActionState(setEpicHelpRequestedAction, {});

  function toggle(next: boolean) {
    const fd = new FormData();
    fd.set("id", epicId);
    fd.set("value", next ? "true" : "false");
    startTransition(() => action(fd));
  }

  return (
    <div className="space-y-1.5 border-t border-border pt-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={requested}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
          className="size-4 rounded border-input"
        />
        <span className="inline-flex items-center gap-1.5 font-medium">
          <LifeBuoy className="size-3.5 text-muted-foreground" />I need help
        </span>
      </label>
      {requested && (
        <p className="pl-6 text-[11px] text-muted-foreground">
          VMO und Portfolio-Management sehen dieses Epic jetzt in „Meine Tasks".
        </p>
      )}
      {state.error && <p className="pl-6 text-xs text-destructive">{state.error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zustand 1 — kein Antrag offen
// ---------------------------------------------------------------------------

function NoRequest({
  epicId,
  gate,
  approvers,
  userLabels,
}: {
  epicId: string;
  gate: Extract<EpicGateSlice, { disabled: false }>;
  approvers: TenantApprover[];
  userLabels: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(requestGateTransitionAction, {});
  // Besetzung der Parteien — nur an den Schritten, die eine je Epic zulassen
  // (heute L2 → L3.1). Vorbelegt aus der Wertstrom-Governance.
  const staffing = gate.partyStaffing;
  const [parties, setParties] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const { role } of staffing?.roles ?? []) {
      init[role] = new Set(staffing?.defaults[role] ?? []);
    }
    return init;
  });

  function toggleParty(role: string, userId: string) {
    setParties((prev) => {
      const next = new Set(prev[role] ?? []);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return { ...prev, [role]: next };
    });
  }

  if (!gate.next) {
    return (
      <p className="text-xs text-muted-foreground">Endgate erreicht — kein weiterer Wechsel.</p>
    );
  }

  const blocked = gate.readiness ? !gate.readiness.ready : false;

  function submit() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("toGate", gate.next as string);
    // `<rolle>:<userId>` — die Rolle muss mit, sonst steht auf der
    // Abnahme-Zeile hinterher niemand mehr für „Business Owner".
    for (const [role, userIds] of Object.entries(parties)) {
      for (const userId of userIds) fd.append("approvers", `${role}:${userId}`);
    }
    startTransition(() => action(fd));
  }

  return (
    <div className="space-y-3">
      {gate.readiness && gate.readiness.criteria.length > 0 && (
        <ul className="space-y-1">
          {gate.readiness.criteria.map((c) => (
            <li
              key={c.key}
              className={`flex items-start gap-2 text-xs ${
                c.blocking ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {c.satisfied ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
              )}
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                {c.help ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2" />
                      }
                    >
                      {c.label}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{c.help}</TooltipContent>
                  </Tooltip>
                ) : (
                  c.label
                )}
                {!c.blocking && <span className="text-muted-foreground">(optional)</span>}
                {c.help && (
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50 hover:text-muted-foreground"
                        />
                      }
                    >
                      How to
                    </PopoverTrigger>
                    <PopoverContent side="top" className="w-72 text-xs leading-relaxed">
                      <p>{c.help}</p>
                      {CRITERION_TARGET[c.key] && (
                        <Link
                          href={CRITERION_TARGET[c.key]!.href(epicId)}
                          className="inline-flex items-center gap-1 self-start rounded-md border border-input px-2 py-1 text-xs font-medium text-primary hover:bg-muted/50"
                        >
                          {CRITERION_TARGET[c.key]!.label}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {staffing && gate.canRequest && (
        <GatePartyPicker
          staffing={staffing}
          approvers={approvers}
          selected={parties}
          onToggle={toggleParty}
          userLabels={userLabels}
        />
      )}

      {gate.canRequest && (
        <button
          type="button"
          onClick={submit}
          disabled={pending || blocked}
          title={
            blocked
              ? gate.readiness?.criteria
                  .filter((c) => c.blocking && !c.satisfied)
                  .map((c) => c.label)
                  .join("; ")
              : undefined
          }
          className={PRIMARY}
        >
          <ArrowUp className="size-3.5" />
          {pending ? "…" : `Push nach ${gateLabel(gate.next)} beantragen`}
        </button>
      )}

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zustand 2 + 3 — Antrag offen
// ---------------------------------------------------------------------------

function OpenRequest({
  gate,
  userLabels,
}: {
  gate: Extract<EpicGateSlice, { disabled: false }>;
  userLabels: Record<string, string>;
}) {
  const request = gate.openRequest;
  const [withdrawState, withdraw, withdrawing] = useActionState(withdrawGateTransitionAction, {});
  if (!request) return null;

  const name = (id: string) => userLabels[id] ?? "Unbekannt";

  function onWithdraw() {
    if (!request) return;
    const fd = new FormData();
    fd.set("transitionId", request.id);
    fd.set("reason", "Vom Antragsteller zurückgezogen");
    startTransition(() => withdraw(fd));
  }

  return (
    <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
      <p className="text-xs">
        <span className="font-medium">Push nach {gateLabel(request.toGate)} beantragt</span> von{" "}
        {name(request.requestedBy)}
        {request.quorum === "any" && (
          <span className="text-muted-foreground"> · eine Abnahme genügt</span>
        )}
      </p>
      {request.reason && <p className="text-xs text-muted-foreground">„{request.reason}"</p>}

      <ul className="space-y-1">
        {request.approvers.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-xs">
            {a.status === "approved" ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            ) : a.status === "rejected" ? (
              <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            ) : (
              <CircleDot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
            )}
            <span>
              {name(a.userId)}
              {a.roleLabel && <span className="text-muted-foreground"> ({a.roleLabel})</span>}
              {a.comment && <span className="text-muted-foreground"> — „{a.comment}"</span>}
            </span>
          </li>
        ))}
      </ul>

      {gate.viewerMustDecide && <DecideButtons transitionId={request.id} />}

      {gate.canWithdraw && !gate.viewerMustDecide && (
        <button type="button" onClick={onWithdraw} disabled={withdrawing} className={GHOST}>
          <Undo2 className="size-3.5" />
          {withdrawing ? "…" : "Antrag zurückziehen"}
        </button>
      )}

      {withdrawState.error && <p className="text-xs text-destructive">{withdrawState.error}</p>}
    </div>
  );
}

/**
 * Das Drei-Knopf-Muster aus „Meine Freigaben" — bewusst dieselbe Geste, damit
 * eine Gate-Abnahme sich anfühlt wie jede andere Abnahme im Produkt. Ablehnen
 * und In-Klärung verlangen eine Begründung.
 */
function DecideButtons({ transitionId }: { transitionId: string }) {
  const [state, action, pending] = useActionState(decideGateTransitionAction, {});
  const [open, setOpen] = useState<"reject" | "clarification" | null>(null);
  const [comment, setComment] = useState("");

  function send(decision: "approve" | "reject", text?: string) {
    const fd = new FormData();
    fd.set("transitionId", transitionId);
    fd.set("decision", decision);
    if (text?.trim()) fd.set("comment", text.trim());
    startTransition(() => action(fd));
  }

  if (open) {
    const label = open === "reject" ? "Ablehnen" : "In Klärung schicken";
    return (
      <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/40 p-2.5">
        <p className="text-xs font-medium">{label} — bitte begründen</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Begründung (erforderlich)"
          className="w-full rounded border border-input px-2 py-1 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !comment.trim()}
            className={open === "reject" ? REJECT : CLARIFY}
            onClick={() => send("reject", comment)}
          >
            {pending ? "…" : label}
          </button>
          <button
            type="button"
            disabled={pending}
            className={GHOST}
            onClick={() => {
              setOpen(null);
              setComment("");
            }}
          >
            Abbrechen
          </button>
        </div>
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">Du bist als abnehmende Person benannt.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className={APPROVE}
          onClick={() => send("approve")}
        >
          {pending ? "…" : "Freigeben"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={CLARIFY}
          onClick={() => setOpen("clarification")}
        >
          In Klärung schicken
        </button>
        <button
          type="button"
          disabled={pending}
          className={REJECT}
          onClick={() => setOpen("reject")}
        >
          Ablehnen
        </button>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
