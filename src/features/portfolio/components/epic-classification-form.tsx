"use client";

import { useActionState, startTransition } from "react";
import { updateEpicAction } from "@/features/portfolio/actions/epic";
import {
  EPIC_TYPES,
  HORIZONS,
  EPIC_TYPE_LABEL,
  HORIZON_LABEL,
} from "@/domain/portfolio-guardrails";

interface Props {
  epicId: string;
  epicType: string | null;
  investmentHorizon: string | null;
  canEdit: boolean;
}

/**
 * SAFe-Guardrails-Klassifikation (Roadmap-G2). Auto-Submit per Select,
 * leerer String = clearen. Read-Only-Fallback zeigt die Labels.
 */
export function EpicClassificationForm({ epicId, epicType, investmentHorizon, canEdit }: Props) {
  const [state, submit, busy] = useActionState(updateEpicAction, {});

  function update(field: "epicType" | "investmentHorizon", value: string) {
    const fd = new FormData();
    fd.set("id", epicId);
    fd.set(field, value);
    startTransition(() => submit(fd));
  }

  if (!canEdit) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <ReadOnlyField label="Epic-Typ">
          {epicType ? (EPIC_TYPE_LABEL[epicType as keyof typeof EPIC_TYPE_LABEL] ?? epicType) : "—"}
        </ReadOnlyField>
        <ReadOnlyField label="Horizon">
          {investmentHorizon
            ? (HORIZON_LABEL[investmentHorizon as keyof typeof HORIZON_LABEL] ?? investmentHorizon)
            : "—"}
        </ReadOnlyField>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="epic-type-select"
            className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            Epic-Typ
          </label>
          <select
            id="epic-type-select"
            value={epicType ?? ""}
            disabled={busy}
            onChange={(e) => update("epicType", e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="">— ungesetzt</option>
            {EPIC_TYPES.map((t) => (
              <option key={t} value={t}>
                {EPIC_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="epic-horizon-select"
            className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            Horizon
          </label>
          <select
            id="epic-horizon-select"
            value={investmentHorizon ?? ""}
            disabled={busy}
            onChange={(e) => update("investmentHorizon", e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="">— ungesetzt</option>
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {HORIZON_LABEL[h]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        {children}
      </div>
    </div>
  );
}
