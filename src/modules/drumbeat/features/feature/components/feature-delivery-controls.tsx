"use client";

import { useActionState, useState, startTransition } from "react";
import {
  startFeatureAction,
  setFeatureDeliveryStatusAction,
} from "@/modules/work/features/feature/actions/feature";

/**
 * Delivery-lifecycle controls on the Feature detail header. Renders the
 * available outgoing transitions for the current status; `in_progress → blocked`
 * and any `→ cancelled` open a small inline form for a required reason
 * (mirrors the "Meine Freigaben" comment pattern). Pre-disables "Umsetzung
 * starten" when the operational preconditions are missing (PI not assigned,
 * Epic not in L4/L5) — the server enforces the same rules, so this is just to
 * make the cause visible without a round-trip.
 */

const PRIMARY =
  "rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";
const OUTLINE =
  "rounded border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50";
const DANGER =
  "rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";

function makeForm(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

function dispatch(action: (fd: FormData) => void, entries: Record<string, string>) {
  startTransition(() => action(makeForm(entries)));
}

interface Props {
  featureId: string;
  status: string;
  /** Pre-disables "Umsetzung starten" when missing (PI not assigned). */
  piAssigned: boolean;
  /** Pre-disables "Umsetzung starten" when the parent Epic isn't L4/L5. */
  parentEpicReady: boolean;
}

/** Available outgoing transitions, in the order they should render. */
type Transition = "start" | "block" | "complete" | "resume" | "cancel";

function transitionsFor(status: string): Transition[] {
  switch (status) {
    case "approved":
      return ["start", "cancel"];
    case "in_progress":
      return ["block", "complete", "cancel"];
    case "blocked":
      return ["resume", "cancel"];
    default:
      return []; // draft/in_review live in QS; completed/cancelled are terminal
  }
}

export function FeatureDeliveryControls({ featureId, status, piAssigned, parentEpicReady }: Props) {
  const [startState, startAction, startPending] = useActionState(startFeatureAction, {});
  const [statusState, statusAction, statusPending] = useActionState(
    setFeatureDeliveryStatusAction,
    {},
  );

  const [reasonOpen, setReasonOpen] = useState<null | {
    to: "blocked" | "cancelled";
    label: string;
  }>(null);
  const [reason, setReason] = useState("");

  const ts = transitionsFor(status);
  if (ts.length === 0) return null;

  const startBlocked = !piAssigned || !parentEpicReady;
  const startTitle = !piAssigned
    ? "Feature ist keinem PI zugewiesen"
    : !parentEpicReady
      ? "Parent-Epic noch nicht in Implementation (L4)"
      : undefined;

  // Reason-required popover (shown for block/cancel).
  if (reasonOpen) {
    const ok = reason.trim().length > 0;
    return (
      <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/40 p-3 text-sm">
        <p className="font-medium">{reasonOpen.label} — bitte begründen</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Begründung (erforderlich)"
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={statusPending}
            className={OUTLINE}
            onClick={() => {
              setReasonOpen(null);
              setReason("");
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!ok || statusPending}
            className={DANGER}
            onClick={() =>
              dispatch(statusAction, { id: featureId, to: reasonOpen.to, reason: reason.trim() })
            }
          >
            {statusPending ? "…" : reasonOpen.label}
          </button>
        </div>
        {statusState.error && (
          <p role="alert" className="text-xs text-red-600">
            {statusState.error}
          </p>
        )}
      </div>
    );
  }

  const buttons: Array<{ key: Transition; node: React.ReactNode }> = [];
  for (const t of ts) {
    if (t === "start") {
      buttons.push({
        key: "start",
        node: (
          <button
            type="button"
            disabled={startPending || startBlocked}
            title={startTitle}
            className={PRIMARY}
            onClick={() => dispatch(startAction, { id: featureId })}
          >
            {startPending ? "…" : "Umsetzung starten"}
          </button>
        ),
      });
    } else if (t === "resume") {
      buttons.push({
        key: "resume",
        node: (
          <button
            type="button"
            disabled={statusPending}
            className={PRIMARY}
            onClick={() => dispatch(statusAction, { id: featureId, to: "in_progress" })}
          >
            Fortsetzen
          </button>
        ),
      });
    } else if (t === "complete") {
      buttons.push({
        key: "complete",
        node: (
          <button
            type="button"
            disabled={statusPending}
            className={OUTLINE}
            onClick={() => dispatch(statusAction, { id: featureId, to: "completed" })}
          >
            Abschließen
          </button>
        ),
      });
    } else if (t === "block") {
      buttons.push({
        key: "block",
        node: (
          <button
            type="button"
            disabled={statusPending}
            className={OUTLINE}
            onClick={() => setReasonOpen({ to: "blocked", label: "Pausieren" })}
          >
            Pausieren
          </button>
        ),
      });
    } else if (t === "cancel") {
      buttons.push({
        key: "cancel",
        node: (
          <button
            type="button"
            disabled={statusPending}
            className={DANGER}
            onClick={() => setReasonOpen({ to: "cancelled", label: "Abbrechen" })}
          >
            Abbrechen
          </button>
        ),
      });
    }
  }

  const visibleError = startState.error ?? statusState.error;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <span key={b.key}>{b.node}</span>
        ))}
      </div>
      {visibleError && (
        <p role="alert" className="text-xs text-red-600">
          {visibleError}
        </p>
      )}
    </div>
  );
}
