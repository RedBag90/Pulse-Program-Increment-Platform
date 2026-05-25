"use client";

import { useMemo, useState, useActionState, startTransition } from "react";
import { saveArtBudgetAction } from "@/features/portfolio/actions/art-budget";
import { artBudgetRemaining, type ArtFeatureLoad } from "@/domain/art-budget";
import { Button } from "@/components/ui/button";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const fmtEur = (v: number) => eur.format(Math.round(v));

const cellInput =
  "h-8 w-24 rounded-md border border-input bg-transparent px-2 text-right text-sm disabled:opacity-60";
const numOr0 = (s: string): number => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

interface Period {
  key: string;
  label: string;
}
interface ArtRow {
  artId: string;
  name: string;
  budgetByPeriod: Record<string, number>;
  load: ArtFeatureLoad;
}

interface Props {
  periods: Period[];
  vsByPeriod: Record<string, number>;
  arts: ArtRow[];
  canEdit: boolean;
}

/**
 * ART budget breakdown — Finance distributes the Value Stream's per-half-year
 * budget to its ARTs (editable grid + "Verbleibend" against the VS budget), plus
 * a read-only Feature-load table (count + Job Size per ART per PI half-year,
 * un-PI'd → Backlog) to support the decision.
 */
export function ArtBudgetBreakdown({ periods, vsByPeriod, arts, canEdit }: Props) {
  // Live edit state: artId → periodKey → input string.
  const [budgets, setBudgets] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      arts.map((a) => [
        a.artId,
        Object.fromEntries(
          periods.map((p) => [
            p.key,
            a.budgetByPeriod[p.key] ? String(a.budgetByPeriod[p.key]) : "",
          ]),
        ),
      ]),
    ),
  );

  const remaining = useMemo(
    () =>
      artBudgetRemaining(
        vsByPeriod,
        arts.map((a) =>
          Object.fromEntries(periods.map((p) => [p.key, numOr0(budgets[a.artId]?.[p.key] ?? "")])),
        ),
        periods.map((p) => p.key),
      ),
    [budgets, vsByPeriod, arts, periods],
  );

  if (arts.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium">ART-Budgets</h2>
        <p className="text-sm text-muted-foreground">Noch keine ARTs in diesem Wertstrom.</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {/* (A) Budget breakdown editor */}
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
                    {fmtEur(vsByPeriod[p.key] ?? 0)}
                  </td>
                ))}
                {canEdit && <td />}
              </tr>
              {arts.map((a) => (
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
                  const r = remaining[p.key] ?? 0;
                  return (
                    <td
                      key={p.key}
                      className={`p-2 text-right tabular-nums ${r < 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {fmtEur(r)}
                    </td>
                  );
                })}
                {canEdit && <td />}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* (B) Feature load — decision support */}
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
              {arts.map((a) => (
                <tr key={a.artId} className="border-b">
                  <td className="p-2 font-medium">{a.name}</td>
                  {periods.map((p) => (
                    <td key={p.key} className="p-2 text-right tabular-nums">
                      <LoadCellView cell={a.load.byPeriod[p.key]} />
                    </td>
                  ))}
                  <td className="p-2 text-right tabular-nums">
                    <LoadCellView cell={a.load.backlog} />
                  </td>
                  <td className="p-2 text-right font-medium tabular-nums">
                    <LoadCellView cell={a.load.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
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
    const fd = new FormData();
    fd.set("payload", JSON.stringify({ artId, byPeriod }));
    startTransition(() => save(fd));
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
