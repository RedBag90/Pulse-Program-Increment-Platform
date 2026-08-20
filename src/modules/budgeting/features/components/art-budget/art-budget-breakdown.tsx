"use client";

import { useMemo } from "react";
import { numOr0 } from "@/modules/budgeting/features/lib/allocation-payload";
import type { ArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";
import type { Period } from "@/modules/budgeting/domain/period-window";
import {
  buildArtBudgetModel,
  type ArtBudgetModel,
} from "@/modules/budgeting/server/views/art-budget-breakdown";
import { AllocationBar } from "@/modules/budgeting/features/components/round/allocation-bar";
import { formatEUR } from "@/lib/formatting";

const cellInput =
  "h-8 w-24 rounded-md border border-input bg-transparent px-2 text-right text-sm disabled:opacity-60";

/** ART-Budget-Eingabestand: artId → periodKey → String. */
export type ArtBudgetState = Record<string, Record<string, string>>;

interface Props {
  /** Vorberechnetes Server-Modell — der Ausgangsstand des Grids. */
  model: ArtBudgetModel;
  /** Kontrollierter Editier-Stand (vom Workspace). */
  budgets: ArtBudgetState;
  onChange: (artId: string, key: string, value: string) => void;
  canEdit: boolean;
}

/**
 * ART-Budget-Breakdown — Finance verteilt das (abgeleitete) Wertstrom-Budget je
 * Halbjahr auf die ARTs (editierbares Grid + „Verbleibend"), darunter die
 * read-only Feature-Last als Entscheidungsgrundlage.
 *
 * Kontrolliert: der Editier-Stand lebt im Workspace, gespeichert wird zentral
 * über die Save-Bar. „Verbleibend" rechnet `buildArtBudgetModel` — dieselbe reine
 * Funktion, die der Server benutzt.
 */
export function ArtBudgetBreakdown({ model: initial, budgets, onChange, canEdit }: Props) {
  const { periods } = initial;

  const model = useMemo(
    () =>
      buildArtBudgetModel({
        periods,
        vsByPeriod: initial.vsByPeriod,
        rows: initial.rows.map((r) => ({
          ...r,
          budgetByPeriod: Object.fromEntries(
            periods.map((p) => [p.key, numOr0(budgets[r.artId]?.[p.key] ?? "")]),
          ),
        })),
      }),
    [budgets, periods, initial.vsByPeriod, initial.rows],
  );

  if (model.isEmpty) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium">ART-Budgets</h2>
        <p className="text-sm text-muted-foreground">Noch keine ARTs in diesem Wertstrom.</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {/* (A) Budget-Verteilung */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">ART-Budgets</h2>
        <p className="text-xs text-muted-foreground">
          Verteilung des Wertstrom-Budgets auf die ARTs je Halbjahr.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="p-2 text-left font-medium">ART</th>
                {periods.map((p) => (
                  <th key={p.key} className="p-2 text-right font-medium">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b text-xs text-muted-foreground">
                <td className="p-2">Wertstrom-Budget</td>
                {periods.map((p) => (
                  <td key={p.key} className="p-2 text-right tabular-nums">
                    {formatEUR(model.vsByPeriod[p.key] ?? 0)}
                  </td>
                ))}
              </tr>
              {initial.rows.map((a) => (
                <ArtBudgetRow
                  key={a.artId}
                  artId={a.artId}
                  name={a.name}
                  periods={periods}
                  values={budgets[a.artId] ?? {}}
                  canEdit={canEdit}
                  onChange={(key, value) => onChange(a.artId, key, value)}
                />
              ))}
              <tr className="border-t">
                <td className="p-2 align-top text-xs font-medium text-muted-foreground">
                  Auslastung
                </td>
                {periods.map((p) => {
                  const budget = model.vsByPeriod[p.key] ?? 0;
                  const allocated = budget - (model.remaining[p.key] ?? 0);
                  return (
                    <td key={p.key} className="p-2 align-top">
                      <AllocationBar allocated={allocated} budget={budget} />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* (B) Feature-Last — Entscheidungsgrundlage */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Feature-Last je ART</h2>
        <p className="text-xs text-muted-foreground">
          Anzahl Features · Σ Job-Size, je nach zugewiesener PI; ohne PI im Backlog.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="p-2 text-left font-medium">ART</th>
                {periods.map((p) => (
                  <th key={p.key} className="p-2 text-right font-medium">
                    {p.label}
                  </th>
                ))}
                <th className="p-2 text-right font-medium">Backlog</th>
                <th className="p-2 text-right font-medium">Σ</th>
              </tr>
            </thead>
            <tbody>
              {initial.rows.map((a) => (
                <ArtLoadRow key={a.artId} name={a.name} periods={periods} load={a.load} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ArtLoadRow({
  name,
  periods,
  load,
}: {
  name: string;
  periods: Period[];
  load: ArtFeatureLoad;
}) {
  return (
    <tr className="border-b">
      <td className="p-2 font-medium">{name}</td>
      {periods.map((p) => (
        <td key={p.key} className="p-2 text-right tabular-nums">
          <LoadCellView cell={load.byPeriod[p.key]} />
        </td>
      ))}
      <td className="p-2 text-right tabular-nums">
        <LoadCellView cell={load.backlog} />
      </td>
      <td className="p-2 text-right font-medium tabular-nums">
        <LoadCellView cell={load.total} />
      </td>
    </tr>
  );
}

function LoadCellView({ cell }: { cell?: { count: number; jobSize: number } | undefined }) {
  if (!cell || cell.count === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {cell.count} F · {cell.jobSize} JS
    </span>
  );
}

function ArtBudgetRow({
  name,
  periods,
  values,
  canEdit,
  onChange,
}: {
  artId: string;
  name: string;
  periods: Period[];
  values: Record<string, string>;
  canEdit: boolean;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <tr className="border-b align-top">
      <td className="p-2 font-medium">{name}</td>
      {periods.map((p) => (
        <td key={p.key} className="p-1 text-right">
          <input
            className={cellInput}
            inputMode="numeric"
            value={values[p.key] ?? ""}
            disabled={!canEdit}
            placeholder="0"
            onChange={(e) => onChange(p.key, e.target.value)}
            aria-label={`Budget ${name} ${p.label}`}
          />
        </td>
      ))}
    </tr>
  );
}
