"use client";

import { useActionState, useState, startTransition } from "react";
import {
  decideEpicHypothesisAction,
  decideEpicApprovalAction,
} from "@/modules/work/features/portfolio/actions/epic-approval";
import { decideGateTransitionAction } from "@/modules/work/features/portfolio/actions/stage-gate";
import type { ApprovalKind, MyApprovalRow } from "@/modules/work/server/services/my-approvals";

/**
 * "Meine Freigaben" decision UI — three buttons (Freigeben / In Klärung
 * schicken / Ablehnen) that route to whichever backend service the row's
 * `kind` requires. "Freigeben" is the existing approve path. "Ablehnen" is the
 * existing reject path with a required comment. "In Klärung schicken" reuses
 * the reject path but tags the audit `intent: "clarification"` so the
 * requester's view can show it as a Rückfrage rather than an outright
 * rejection — no schema change, no new state-machine for v1.
 */

const APPROVE =
  "rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const REJECT =
  "rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";
const CLARIFY =
  "rounded border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50";
const CANCEL =
  "rounded border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50";

type Mode = "approve" | "reject" | "clarification";

function makeForm(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

function dispatch(action: (fd: FormData) => void, entries: Record<string, string>) {
  startTransition(() => action(makeForm(entries)));
}

/** The decide-action for a given row kind, picked at render. */
function pickAction(kind: ApprovalKind) {
  switch (kind) {
    case "epic_hypothesis":
      return decideEpicHypothesisAction;
    case "epic_party":
      return decideEpicApprovalAction;
    case "epic_gate":
      return decideGateTransitionAction;
  }
}

/** Builds the form-data entries for the chosen mode, keyed by row kind. */
function buildEntries(row: MyApprovalRow, mode: Mode, comment: string): Record<string, string> {
  const decision = mode === "approve" ? "approve" : "reject";
  const intent = mode === "clarification" ? "clarification" : "decision";
  const base: Record<string, string> = { decision, intent };
  if (comment.trim()) base.comment = comment.trim();

  switch (row.kind) {
    case "epic_hypothesis":
      return { ...base, epicId: row.target.epicId };
    case "epic_party":
      return { ...base, approvalId: row.target.approvalId };
    case "epic_gate":
      // Die Gate-Achse kennt kein `intent` — eine Rückfrage ist dort eine
      // Ablehnung mit Begründung, der Antrag wird neu gestellt.
      return {
        decision,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        transitionId: row.target.transitionId,
      };
  }
}

export function ApprovalActions({ row }: { row: MyApprovalRow }) {
  const action = pickAction(row.kind);
  const [state, dispatchAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState<Mode | null>(null);
  const [comment, setComment] = useState("");

  // "Freigeben" without an inline form — just confirm and go.
  function onApproveClick() {
    dispatch(dispatchAction, buildEntries(row, "approve", comment));
  }

  function onSubmit() {
    if (!open) return;
    if ((open === "reject" || open === "clarification") && !comment.trim()) return; // required
    dispatch(dispatchAction, buildEntries(row, open, comment));
    // Don't reset open immediately — the action triggers a server revalidation
    // and the row will disappear from the list on the next render.
  }

  if (open) {
    const label = open === "reject" ? "Ablehnen" : "In Klärung schicken";
    return (
      <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/40 p-3">
        <p className="text-xs font-medium text-foreground">{label} — bitte begründen</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Begründung (erforderlich)"
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !comment.trim()}
            className={open === "reject" ? REJECT : CLARIFY}
            onClick={onSubmit}
          >
            {pending ? "…" : label}
          </button>
          <button
            type="button"
            disabled={pending}
            className={CANCEL}
            onClick={() => {
              setOpen(null);
              setComment("");
            }}
          >
            Abbrechen
          </button>
        </div>
        {state.error ? (
          <p role="alert" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={APPROVE} onClick={onApproveClick}>
          Freigeben
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
      {state.error ? (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
