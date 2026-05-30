"use client";

import { useActionState, startTransition } from "react";
import {
  setKpiValuePerUnitAction,
  setTargetOutcomeValuePerUnitAction,
} from "@/features/controlling/actions/kpi-value";

type Kind = "kpi" | "outcome";

interface Props {
  kind: Kind;
  /** Epic Kpi id or TargetOutcome id, depending on `kind`. */
  id: string;
  /** Current persisted value (or null). */
  value: number | null;
  /** When false, render a read-only number for the same value. */
  canEdit: boolean;
  /** Optional unit label rendered next to the input (e.g. "€/Tag"). */
  unitLabel?: string;
}

const INPUT =
  "h-7 w-24 rounded-md border border-input bg-transparent px-2 text-right text-sm tabular-nums font-mono focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Inline € per-unit input — submits on blur (when the value changed) and on
 * Enter. Empty string clears the valuation. Used inside the KPI tree rows.
 */
export function ValuePerUnitInput({ kind, id, value, canEdit, unitLabel }: Props) {
  const action = kind === "kpi" ? setKpiValuePerUnitAction : setTargetOutcomeValuePerUnitAction;
  const [state, run, pending] = useActionState(action, {});
  const idField = kind === "kpi" ? "kpiId" : "id";

  if (!canEdit) {
    return (
      <span className="font-mono tabular-nums text-muted-foreground">
        {value == null ? "—" : value.toLocaleString("de-DE")}
        {unitLabel ? ` ${unitLabel}` : ""}
      </span>
    );
  }

  function submit(next: string) {
    const norm = next.trim();
    const previous = value == null ? "" : String(value);
    if (norm === previous) return; // no-op
    const fd = new FormData();
    fd.set(idField, id);
    fd.set("valuePerUnit", norm);
    startTransition(() => run(fd));
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        step="any"
        inputMode="decimal"
        defaultValue={value ?? ""}
        placeholder="—"
        disabled={pending}
        className={INPUT}
        aria-label="€ pro Einheit"
        onBlur={(e) => submit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
      />
      {unitLabel && <span className="text-[10px] text-muted-foreground">{unitLabel}</span>}
      {state?.error && <span className="text-[10px] text-destructive">{state.error}</span>}
    </span>
  );
}
