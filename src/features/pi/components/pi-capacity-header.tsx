"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { setPiCapacityAction } from "@/features/pi/actions/pi";
import type { PiCapacityOverlay } from "@/server/views/pi-planning";

/** Tailwind tint per utilization band — drives both the badge and the column wash. */
const BAND_TINT = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  over: "bg-red-50 text-red-800 border-red-200",
} as const;

/** Compact € rendering for the column header — shows €k for large numbers. */
function fmtAmount(n: number): string {
  if (n >= 100_000) return `€${Math.round(n / 1000).toLocaleString("de-DE")}k`;
  if (n >= 1000) return `€${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return `€${Math.round(n).toLocaleString("de-DE")}`;
}

/** Job-Size rendering — integer with locale separator. */
function fmtJob(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

interface Props {
  piId: string;
  artId: string;
  /** When null (backlog/no overlay), the editor is hidden and only the count is shown above. */
  overlay: PiCapacityOverlay | null;
  /** Pencil + popover are gated on this. */
  canEdit: boolean;
}

/**
 * Column header for one PI in the PI-Planning board/table — renders demand
 * vs. capacity in WSJF Job Size and (when configured) €, with an Ampel-Tönung
 * for the worse of the two axes. An inline pencil opens a popover form for
 * the per-PI overrides; the €-axis line is hidden when neither demand nor
 * capacity is known.
 */
export function PiCapacityHeader({ piId, artId, overlay, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setPiCapacityAction, {});

  // Backlog column or any column without overlay — render nothing extra.
  if (!overlay) return null;

  const tint = BAND_TINT[overlay.band];

  const jobLine = `Job Size: ${fmtJob(overlay.jobSizeDemand)}${
    overlay.jobSizeCapacity != null ? ` / ${fmtJob(overlay.jobSizeCapacity)}` : ""
  }`;
  const amountVisible = overlay.amountDemand !== null || overlay.amountCapacity !== null;
  const amountLine = amountVisible
    ? `Budget: ${overlay.amountDemand !== null ? fmtAmount(overlay.amountDemand) : "—"}${
        overlay.amountCapacity != null ? ` / ${fmtAmount(overlay.amountCapacity)}` : ""
      }${overlay.amountSource === "prorated" ? " *" : ""}`
    : null;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-start justify-between gap-2 rounded border px-2 py-1.5 text-[11px] ${tint}`}
      >
        <div className="space-y-0.5 leading-tight">
          <p>{jobLine}</p>
          {amountLine && (
            <p title={overlay.amountSource === "prorated" ? "Aus ART-Budget anteilig" : undefined}>
              {amountLine}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded p-0.5 hover:bg-black/5"
            aria-label="Kapazität bearbeiten"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && canEdit && (
        <form
          action={formAction}
          onSubmit={() => {
            // Close optimistically; the page will revalidate.
            setOpen(false);
          }}
          className="space-y-1.5 rounded border bg-background p-2 text-[11px] shadow-sm"
        >
          <input type="hidden" name="id" value={piId} />
          <input type="hidden" name="artId" value={artId} />
          <label className="block">
            <span className="block text-muted-foreground">Job-Size-Kapazität</span>
            <input
              type="number"
              min={0}
              step={1}
              name="capacityJobSize"
              defaultValue={overlay.jobSizeCapacity ?? ""}
              placeholder="leer = unbegrenzt"
              disabled={pending}
              className="mt-0.5 w-full rounded border border-input bg-background px-1.5 py-1"
            />
          </label>
          <label className="block">
            <span className="block text-muted-foreground">Budget-Override (€)</span>
            <input
              type="number"
              min={0}
              step={100}
              name="capacityAmount"
              defaultValue={
                overlay.amountSource === "override" ? (overlay.amountCapacity ?? "") : ""
              }
              placeholder="leer = ART-Budget anteilig"
              disabled={pending}
              className="mt-0.5 w-full rounded border border-input bg-background px-1.5 py-1"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded border border-input px-2 py-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-primary px-2 py-1 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "…" : "Speichern"}
            </button>
          </div>
          {state.error && <p className="text-[10px] text-red-600">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
