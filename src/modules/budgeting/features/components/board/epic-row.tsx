"use client";

import { numOr0 } from "@/modules/budgeting/features/lib/allocation-payload";
import type { BudgetEpicView } from "@/modules/budgeting/domain/budgeting";
import type { Period } from "@/modules/budgeting/domain/period-window";
import type { BoardRow } from "@/modules/budgeting/server/views/budgeting-board";
import { CELL_INPUT } from "@/modules/budgeting/features/components/board/board-cell";
import { Link } from "@/i18n/navigation";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { formatEUR } from "@/lib/formatting";

interface Props {
  row: BoardRow;
  periods: Period[];
  canManage: boolean;
  onChange: (next: BudgetEpicView) => void;
  /** Editierbare Halbjahre (Rolling-Window); Rest read-only. */
  editableKeys: string[];
  /** Der Anker (aktiver Zyklus) — für die Spalten-Tönung. */
  activeCycleKey: string;
}

/**
 * Eine Epic-Zeile des Boards: Priorität, der (abgeleitete) Bedarfsbeginn, je
 * Periode Bedarf + Zuteilung. Kontrolliert — der Editier-Stand lebt im Workspace,
 * gespeichert wird zentral über die Save-Bar (kein Zeilen-Knopf mehr).
 *
 * „Bedarf ab" ist bewusst ein Label, kein Eingabefeld: der Wert stammt aus
 * `deriveEpicEconomics(...).costStart` und gehört dem Reifegrad-Plan des Epic-
 * Owners.
 */
export function EpicRow({ row, periods, canManage, onChange, editableKeys, activeCycleKey }: Props) {
  const { epic, requested } = row;
  const editable = new Set(editableKeys);

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
        <td
          key={p.key}
          className={`p-2 text-right ${p.key === activeCycleKey ? "bg-primary/5" : ""}`}
        >
          {epic.isHypothesisOnly && p.key === epic.startKey ? (
            <input
              className={CELL_INPUT}
              inputMode="numeric"
              value={epic.hypothesisBudget ? String(epic.hypothesisBudget) : ""}
              disabled={!canManage || !editable.has(p.key)}
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
                disabled={!canManage || !editable.has(p.key)}
                placeholder={requested[p.key] ? String(requested[p.key]) : "0"}
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
    </tr>
  );
}
