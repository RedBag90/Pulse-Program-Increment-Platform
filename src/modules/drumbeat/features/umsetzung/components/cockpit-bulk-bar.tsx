"use client";

import { useState } from "react";
import type { CockpitPiSlot, FeatureStatus } from "@/server/views/umsetzung-cockpit-view";

/**
 * Sticky-Bar am unteren Page-Rand — erscheint, sobald ≥1 Zeile in der
 * Tabelle gewaehlt ist. Setzt PI / Status auf alle gewaehlten Features.
 * Ein „Apply"-Klick dispatcht entweder PI ODER Status ODER beides (per
 * Entscheidung #6: kein Limit auf die Anzahl).
 */
interface Props {
  selectedCount: number;
  pis: CockpitPiSlot[];
  statusOptions: ReadonlyArray<{ value: FeatureStatus; label: string }>;
  canUpdate: boolean;
  canSetDelivery: boolean;
  onApply: (patch: { piId?: string; status?: FeatureStatus }) => void;
  onClear: () => void;
}

const NO_PI = "__no_pi__";
const NO_STATUS = "__no_status__";

export function CockpitBulkBar({
  selectedCount,
  pis,
  statusOptions,
  canUpdate,
  canSetDelivery,
  onApply,
  onClear,
}: Props) {
  const [piChoice, setPiChoice] = useState<string>(NO_PI);
  const [statusChoice, setStatusChoice] = useState<string>(NO_STATUS);

  if (selectedCount === 0) return null;

  const hasPiChange = piChoice !== NO_PI;
  const hasStatusChange = statusChoice !== NO_STATUS;
  const canApply = hasPiChange || hasStatusChange;

  function apply() {
    const patch: { piId?: string; status?: FeatureStatus } = {};
    if (hasPiChange) patch.piId = piChoice === "__backlog__" ? "" : piChoice;
    if (hasStatusChange) patch.status = statusChoice as FeatureStatus;
    onApply(patch);
    setPiChoice(NO_PI);
    setStatusChoice(NO_STATUS);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-6 py-3 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">{selectedCount} ausgewaehlt</span>

        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">PI</span>
          <select
            disabled={!canUpdate}
            value={piChoice}
            onChange={(e) => setPiChoice(e.target.value)}
            className="rounded border bg-background px-2 py-1 text-xs disabled:opacity-50"
          >
            <option value={NO_PI}>— keine Aenderung —</option>
            <option value="__backlog__">Backlog</option>
            {pis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">Status</span>
          <select
            disabled={!canSetDelivery}
            value={statusChoice}
            onChange={(e) => setStatusChoice(e.target.value)}
            className="rounded border bg-background px-2 py-1 text-xs disabled:opacity-50"
          >
            <option value={NO_STATUS}>— keine Aenderung —</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={!canApply}
            onClick={apply}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Anwenden
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted/40"
          >
            Auswahl loeschen
          </button>
        </div>
      </div>
    </div>
  );
}
