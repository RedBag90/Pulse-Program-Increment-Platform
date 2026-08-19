"use client";

import { useMemo, useState, useActionState, startTransition } from "react";
import { saveArtBudgetAction } from "@/modules/budgeting/features/actions/budgeting";
import {
  numOr0,
  encodeSaveArtBudgetPayload,
} from "@/modules/budgeting/features/lib/allocation-payload";
import type { ArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";
import type { Period } from "@/modules/budgeting/domain/period-window";
import {
  buildArtBudgetModel,
  type ArtBudgetModel,
} from "@/modules/budgeting/server/views/art-budget-breakdown";
import { Button } from "@/components/ui/button";
import { formatEUR } from "@/lib/formatting";

const cellInput =
  "h-8 w-24 rounded-md border border-input bg-transparent px-2 text-right text-sm disabled:opacity-60";

interface Props {
  /** Vorberechnetes Server-Modell — der Ausgangsstand des Grids. */
  model: ArtBudgetModel;
  canEdit: boolean;
}

/**
 * ART-Budget-Breakdown — Finance verteilt das (abgeleitete) Wertstrom-Budget je
 * Halbjahr auf die ARTs (editierbares Grid + „Verbleibend"), darunter die
 * read-only Feature-Last als Entscheidungsgrundlage.
 *
 * Die Komponente hält nur den Editier-Stand; „Verbleibend" rechnet
 * `buildArtBudgetModel` — dieselbe reine Funktion, die der Server benutzt.
 */
export function ArtBudgetBreakdown({ model: initial, canEdit }: Props) {
  const { periods } = initial;

  // Editier-Stand: artId → periodKey → Eingabe-String.
  const [budgets, setBudgets] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      initial.rows.map((r) => [
        r.artId,
        Object.fromEntries(
          periods.map((p) => [
            p.key,
            r.budgetByPeriod[p.key] ? String(r.budgetByPeriod[p.key]) : "",
          ]),
        ),
      ]),
    ),
  );

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
                {canEdit && <th className="p-2" />}
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
                {canEdit && <td />}
              </tr>
              {initial.rows.map((a) => (
                <ArtBudgetRow
                  key={a.artId}
                  artId={a.artId}
                  name={a.name}
                  periods={periods}
                  values={budgets[a.artId] ?? {}}
                  canEdit={canEdit}
                  onChange={(key, value) =>
                    setBudgets((prev) => ({
                      ...prev,
                      [a.artId]: { ...prev[a.artId], [key]: value },
                    }))
                  }
                />
              ))}
              <tr className="border-t">
                <td className="p-2 text-xs font-medium text-muted-foreground">Verbleibend</td>
                {periods.map((p) => {
                  const r = model.remaining[p.key] ?? 0;
                  return (
                    <td
                      key={p.key}
                      className={`p-2 text-right tabular-nums ${r < 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {formatEUR(r)}
                    </td>
                  );
                })}
                {canEdit && <td />}
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
  artId,
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
  const [state, save, pending] = useActionState(saveArtBudgetAction, {});

  function submit() {
    const byPeriod: Record<string, number> = {};
    for (const p of periods) {
      const n = numOr0(values[p.key] ?? "");
      if (n > 0) byPeriod[p.key] = n;
    }
    startTransition(() => save(encodeSaveArtBudgetPayload({ artId, byPeriod })));
  }

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
      {canEdit && (
        <td className="p-2">
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={submit}>
            {pending ? "…" : "Speichern"}
          </Button>
          {state?.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
        </td>
      )}
    </tr>
  );
}
