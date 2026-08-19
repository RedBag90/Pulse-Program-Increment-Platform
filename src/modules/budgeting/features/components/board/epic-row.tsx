"use client";

import { useActionState, startTransition } from "react";
import { saveBudgetAllocationAction } from "@/modules/budgeting/features/actions/budgeting";
import {
  numOr0,
  encodeSaveBudgetAllocationPayload,
} from "@/modules/budgeting/features/lib/allocation-payload";
import type { BudgetEpicView } from "@/modules/budgeting/domain/budgeting";
import type { Period } from "@/modules/budgeting/domain/period-window";
import type { BoardRow } from "@/modules/budgeting/server/views/budgeting-board";
import { CELL_INPUT } from "@/modules/budgeting/features/components/board/board-cell";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { formatEUR } from "@/lib/formatting";

interface Props {
  row: BoardRow;
  periods: Period[];
  canManage: boolean;
  onChange: (next: BudgetEpicView) => void;
}

/**
 * Eine Epic-Zeile des Boards: Priorität, der (abgeleitete) Bedarfsbeginn, je
 * Periode Bedarf + Zuteilung, und ein eigener Speichern-Knopf (REQ-B7).
 *
 * „Bedarf ab" ist bewusst ein Label, kein Eingabefeld: der Wert stammt aus
 * `deriveEpicEconomics(...).costStart` und gehört dem Reifegrad-Plan des Epic-
 * Owners. Vorher stand hier ein `<select>`, das lokalen State änderte, aber nie
 * mitgesendet wurde — eine Bedienung ohne Wirkung.
 */
export function EpicRow({ row, periods, canManage, onChange }: Props) {
  const { epic, requested } = row;
  const [state, save, pending] = useActionState(saveBudgetAllocationAction, {});

  function submit() {
    startTransition(() =>
      save(
        encodeSaveBudgetAllocationPayload({
          epicId: epic.id,
          priority: epic.priority,
          hypothesisBudget: epic.isHypothesisOnly ? epic.hypothesisBudget : null,
          allocations: epic.allocations,
        }),
      ),
    );
  }

  return (
    <tr className="border-b align-top">
      <td className="p-3">
        <p className="font-medium">{epic.title}</p>
        <p className="text-xs text-muted-foreground">
          {epic.valueStream ?? "Ohne Wertstrom"} ·{" "}
          {epic.isHypothesisOnly ? "Hypothese" : "Business Case"}
        </p>
      </td>
      <td className="p-3 text-center">
        <input
          className={`${CELL_INPUT} w-14 text-center`}
          inputMode="numeric"
          value={String(epic.priority)}
          disabled={!canManage}
          onChange={(e) => onChange({ ...epic, priority: Math.trunc(numOr0(e.target.value)) })}
          aria-label="Priorität"
        />
      </td>
      <td className="p-3">
        <p className="text-xs font-medium tabular-nums">{halfYearLabel(epic.startKey)}</p>
        <Link
          href={`/portfolio/epics/${epic.id}?tab=timeline`}
          className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
        >
          aus dem Reifegrad-Plan →
        </Link>
      </td>
      {periods.map((p) => (
        <td key={p.key} className="p-2 text-right">
          {epic.isHypothesisOnly && p.key === epic.startKey ? (
            <input
              className={CELL_INPUT}
              inputMode="numeric"
              value={epic.hypothesisBudget ? String(epic.hypothesisBudget) : ""}
              disabled={!canManage}
              placeholder="Festbudget"
              onChange={(e) => onChange({ ...epic, hypothesisBudget: numOr0(e.target.value) })}
              aria-label={`Festbudget ${p.label}`}
            />
          ) : (
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground">
                Bedarf {formatEUR(requested[p.key] ?? 0)}
              </div>
              <input
                className={CELL_INPUT}
                inputMode="numeric"
                value={epic.allocations[p.key] ? String(epic.allocations[p.key]) : ""}
                disabled={!canManage}
                placeholder="0"
                onChange={(e) =>
                  onChange({
                    ...epic,
                    allocations: { ...epic.allocations, [p.key]: numOr0(e.target.value) },
                  })
                }
                aria-label={`Allokiert ${epic.title} ${p.label}`}
              />
            </div>
          )}
        </td>
      ))}
      {canManage && (
        <td className="p-3">
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={submit}>
            {pending ? "…" : "Speichern"}
          </Button>
          {state?.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
        </td>
      )}
    </tr>
  );
}
