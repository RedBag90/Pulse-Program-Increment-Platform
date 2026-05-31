"use client";

import { useActionState } from "react";
import { setEpicPlannedWindowAction } from "@/features/portfolio/actions/epic";

/** ISO yyyy-mm-dd extractor for `<input type="date">` (UTC-safe). */
function toIsoDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

interface Props {
  epicId: string;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  /** The derived "Ist"-Fenster from the Features' PIs, or null when nothing is scheduled. */
  derived: { start: Date; end: Date } | null;
  canEdit: boolean;
}

/**
 * "Geplantes Zeitfenster" form on the Epic Overview tab — the owner's Soll-
 * Fenster. Editable for `canEdit` viewers; everyone else sees a read-only
 * summary. When the derived Ist-Fenster diverges from the Soll, a small note
 * tells the planner so they can decide whether to re-plan or replan-features.
 */
export function EpicPlannedWindowForm({
  epicId,
  plannedStartAt,
  plannedEndAt,
  derived,
  canEdit,
}: Props) {
  const [state, action, pending] = useActionState(setEpicPlannedWindowAction, {});

  const startStr = toIsoDate(plannedStartAt);
  const endStr = toIsoDate(plannedEndAt);
  const hasPlanned = startStr !== "" && endStr !== "";

  // Divergenz > 30 Tage zwischen Soll und Ist → kleiner Hinweis (rein informativ).
  const diverged =
    hasPlanned &&
    derived &&
    (Math.abs(derived.start.getTime() - plannedStartAt!.getTime()) > 30 * 86_400_000 ||
      Math.abs(derived.end.getTime() - plannedEndAt!.getTime()) > 30 * 86_400_000);

  if (!canEdit) {
    return (
      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        {hasPlanned ? (
          <>
            <span className="font-medium">{startStr}</span> →{" "}
            <span className="font-medium">{endStr}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Kein geplantes Zeitfenster.</span>
        )}
        {derived && (
          <p className="mt-1 text-xs text-muted-foreground">
            Ableitung aus Features: {toIsoDate(derived.start)} → {toIsoDate(derived.end)}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={epicId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Von
          </span>
          <input
            type="date"
            name="plannedStartAt"
            defaultValue={startStr}
            disabled={pending}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Bis
          </span>
          <input
            type="date"
            name="plannedEndAt"
            defaultValue={endStr}
            disabled={pending}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "…" : "Speichern"}
        </button>
      </div>
      {derived && (
        <p className="text-xs text-muted-foreground">
          Ableitung aus Features: {toIsoDate(derived.start)} → {toIsoDate(derived.end)}
        </p>
      )}
      {diverged && (
        <p className="text-xs text-amber-700">
          Ist-Fenster weicht vom Soll ab — entweder Soll-Fenster anpassen oder Feature-PIs umplanen.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-xs text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-xs text-emerald-700">
          Gespeichert.
        </p>
      )}
    </form>
  );
}
