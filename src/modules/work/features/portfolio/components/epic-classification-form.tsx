"use client";

import { useActionState, startTransition } from "react";
import { updateEpicAction } from "@/modules/work/features/portfolio/actions/epic";
import { EPIC_TYPES, EPIC_TYPE_LABEL } from "@/modules/work/domain/portfolio-guardrails";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";

interface Props {
  epicId: string;
  epicType: string | null;
  /** Abgeleiteter Horizont aus der Primär-Solution (read-only). */
  derivedHorizon: string | null;
  canEdit: boolean;
}

/**
 * SAFe-Guardrails-Klassifikation. Der **Epic-Typ** (Capacity: Solution/Epic/Enabler)
 * wird hier gesetzt (Auto-Submit). Der **Horizont** ist read-only und kommt aus der
 * Primär-Solution (s. Solutions-Abschnitt) — kein Horizont-Dropdown mehr am Epic.
 */
export function EpicClassificationForm({ epicId, epicType, derivedHorizon, canEdit }: Props) {
  const [state, submit, busy] = useActionState(updateEpicAction, {});

  function update(value: string) {
    const fd = new FormData();
    fd.set("id", epicId);
    fd.set("epicType", value);
    startTransition(() => submit(fd));
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
          {canEdit ? (
            <select
              id="epic-type-select"
              value={epicType ?? ""}
              disabled={busy}
              onChange={(e) => update(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              <option value="">— ungesetzt</option>
              {EPIC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EPIC_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              {epicType ? (EPIC_TYPE_LABEL[epicType as keyof typeof EPIC_TYPE_LABEL] ?? epicType) : "—"}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Horizont
          </p>
          <div className="flex min-h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <HorizonBadge horizon={derivedHorizon} withHelp />
            <span className="text-xs text-muted-foreground">aus Primär-Solution</span>
          </div>
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
