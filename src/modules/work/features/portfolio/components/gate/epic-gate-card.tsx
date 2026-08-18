"use client";

import { useActionState, useState, startTransition } from "react";
import { ArrowUp, Check, Circle, CircleDot, Undo2, X } from "lucide-react";
import {
  requestGateTransitionAction,
  decideGateTransitionAction,
  withdrawGateTransitionAction,
} from "@/modules/work/features/portfolio/actions/stage-gate";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import type { EpicGateSlice } from "@/modules/work/server/views/epic-detail";
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

interface Props {
  epicId: string;
  gate: EpicGateSlice;
  /** userId → Anzeigename, wie überall auf der Epic-Seite. */
  userLabels: Record<string, string>;
}

export function EpicGateCard({ epicId, gate, userLabels }: Props) {
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
        <NoRequest epicId={epicId} gate={gate} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zustand 1 — kein Antrag offen
// ---------------------------------------------------------------------------

function NoRequest({
  epicId,
  gate,
}: {
  epicId: string;
  gate: Extract<EpicGateSlice, { disabled: false }>;
}) {
  const [state, action, pending] = useActionState(requestGateTransitionAction, {});

  if (!gate.next) {
    return <p className="text-xs text-muted-foreground">Endgate erreicht — kein weiterer Wechsel.</p>;
  }

  const blocked = gate.readiness ? !gate.readiness.ready : false;

  function submit() {
    const fd = new FormData();
    fd.set("epicId", epicId);
    fd.set("toGate", gate.next as string);
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
              <span>
                {c.label}
                {!c.blocking && <span className="text-muted-foreground"> (optional)</span>}
              </span>
            </li>
          ))}
        </ul>
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
