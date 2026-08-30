"use client";

import { useActionState, useState, startTransition } from "react";
import { decideGateTransitionAction } from "@/modules/work/features/portfolio/actions/stage-gate";
import type { MyApprovalRow } from "@/modules/work/server/services/my-approvals";

/**
 * „Meine Freigaben" — die Entscheidung zu einer offenen Reifegrad-Abnahme:
 * freigeben oder begründet ablehnen.
 *
 * Die dritte Taste „In Klärung schicken" ist mit der Mehrparteien-Achse
 * weggefallen. Die Gate-Achse kennt zwei Voten; wer nachfragen will, lehnt mit
 * Begründung ab — das Epic bleibt stehen, der Text wird wieder frei, der Antrag
 * kann neu gestellt werden.
 */

const APPROVE =
  "rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const REJECT =
  "rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";
const CANCEL =
  "rounded border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50";

type Mode = "approve" | "reject";

function makeForm(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

function dispatch(action: (fd: FormData) => void, entries: Record<string, string>) {
  startTransition(() => action(makeForm(entries)));
}

/** Die Formularfelder der Entscheidung. */
function buildEntries(row: MyApprovalRow, mode: Mode, comment: string): Record<string, string> {
  return {
    decision: mode,
    ...(comment.trim() ? { comment: comment.trim() } : {}),
    transitionId: row.target.transitionId,
  };
}

export function ApprovalActions({ row }: { row: MyApprovalRow }) {
  const [state, dispatchAction, pending] = useActionState(decideGateTransitionAction, {});
  const [open, setOpen] = useState<Mode | null>(null);
  const [comment, setComment] = useState("");

  // "Freigeben" without an inline form — just confirm and go.
  function onApproveClick() {
    dispatch(dispatchAction, buildEntries(row, "approve", comment));
  }

  function onSubmit() {
    if (!open) return;
    if (open === "reject" && !comment.trim()) return; // Begründung ist Pflicht
    dispatch(dispatchAction, buildEntries(row, open, comment));
    // Don't reset open immediately — the action triggers a server revalidation
    // and the row will disappear from the list on the next render.
  }

  if (open) {
    const label = "Ablehnen";
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
            className={REJECT}
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
