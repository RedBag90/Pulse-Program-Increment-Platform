"use client";

import { useMemo, useState, useActionState, startTransition } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  parseHalfYearKey,
  requestedByPeriod,
  rollupByValueStream,
  poolRemaining,
  type HalfYearAxis,
  type BudgetEpicView,
} from "@/domain/budgeting";
import type { BudgetingBoardData } from "@/server/services/budgeting";
import {
  saveBudgetAllocationAction,
  saveBudgetPoolAction,
} from "@/features/budgeting/actions/budgeting";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  data: BudgetingBoardData;
  canManage: boolean;
}

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const fmt = (v: number) => eur.format(Math.round(v));
const VS_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#eab308", "#a78bfa", "#f59e0b", "#6366f1"];
const numOr0 = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const cell = "h-8 w-24 rounded-md border border-input bg-transparent px-2 text-right text-xs";

export function BudgetingBoard({ data, canManage }: Props) {
  const axis: HalfYearAxis = useMemo(
    () => ({
      start: parseHalfYearKey(data.periods[0]?.key ?? "") ?? new Date(),
      count: data.periods.length,
      periods: data.periods,
    }),
    [data.periods],
  );

  // Live pool (period key → string) and per-Epic state.
  const [pool, setPool] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of data.periods)
      init[p.key] = data.pool[p.key] != null ? String(data.pool[p.key]) : "";
    return init;
  });
  const [epics, setEpics] = useState<BudgetEpicView[]>(() =>
    [...data.epics].sort((a, b) => a.priority - b.priority),
  );

  const poolNumbers = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(pool)) out[k] = numOr0(v);
    return out;
  }, [pool]);

  const remaining = useMemo(
    () => poolRemaining(poolNumbers, epics, axis),
    [poolNumbers, epics, axis],
  );
  const rollup = useMemo(() => rollupByValueStream(epics, axis), [epics, axis]);

  const chartRows = useMemo(
    () =>
      data.periods.map((p) => {
        const row: Record<string, number | string> = { label: p.label };
        for (const r of rollup) row[r.valueStream ?? "Ohne Wertstrom"] = r.byPeriod[p.key] ?? 0;
        return row;
      }),
    [data.periods, rollup],
  );

  return (
    <div className="space-y-6">
      <PoolRow
        periods={data.periods}
        pool={pool}
        setPool={setPool}
        remaining={remaining}
        canManage={canManage}
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Epic</th>
              <th className="p-3 text-center font-medium">Prio</th>
              <th className="p-3 font-medium">Bedarf ab</th>
              {data.periods.map((p) => (
                <th key={p.key} className="p-3 text-right font-medium">
                  {p.label}
                </th>
              ))}
              {canManage && <th className="p-3" />}
            </tr>
          </thead>
          <tbody>
            {epics.map((epic) => (
              <EpicRow
                key={epic.id}
                epic={epic}
                axis={axis}
                periods={data.periods}
                canManage={canManage}
                onChange={(next) =>
                  setEpics((prev) => prev.map((e) => (e.id === epic.id ? next : e)))
                }
              />
            ))}
            {epics.length === 0 && (
              <tr>
                <td
                  colSpan={data.periods.length + 4}
                  className="p-6 text-center text-muted-foreground"
                >
                  Keine vorgemerkten Epics mit freigegebener Hypothese oder freigegebenem Business
                  Case.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {rollup.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 font-heading text-sm font-medium">
            Budget je Wertstrom &amp; Periode
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartRows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) =>
                  Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                }
              />
              <Tooltip
                formatter={(v: number | string | readonly (number | string)[] | undefined) =>
                  fmt(Number(Array.isArray(v) ? v[0] : (v ?? 0)))
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {rollup.map((r, i) => (
                <Bar
                  key={r.valueStreamId ?? "none"}
                  dataKey={r.valueStream ?? "Ohne Wertstrom"}
                  stackId="vs"
                  fill={VS_COLORS[i % VS_COLORS.length]}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

function PoolRow({
  periods,
  pool,
  setPool,
  remaining,
  canManage,
}: {
  periods: { key: string; label: string }[];
  pool: Record<string, string>;
  setPool: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  remaining: Record<string, number>;
  canManage: boolean;
}) {
  const [state, save, pending] = useActionState(saveBudgetPoolAction, {});

  function submit() {
    const byPeriod: Record<string, number> = {};
    for (const p of periods) {
      const n = numOr0(pool[p.key] ?? "");
      if (n > 0) byPeriod[p.key] = n;
    }
    const fd = new FormData();
    fd.set("payload", JSON.stringify({ byPeriod }));
    startTransition(() => save(fd));
  }

  return (
    <Card className="overflow-x-auto p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-medium">Budget-Topf je Halbjahr</h2>
        {canManage && (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={submit}>
            {pending ? "Speichert…" : "Topf speichern"}
          </Button>
        )}
      </div>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="w-40 py-1 pr-3 text-muted-foreground">Budget</td>
            {periods.map((p) => (
              <td key={p.key} className="px-1 py-1 text-right">
                <input
                  className={cell}
                  inputMode="numeric"
                  value={pool[p.key] ?? ""}
                  disabled={!canManage}
                  onChange={(e) => setPool((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  aria-label={`Budget ${p.label}`}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1 pr-3 text-muted-foreground">Verbleibend</td>
            {periods.map((p) => {
              const r = remaining[p.key] ?? 0;
              return (
                <td
                  key={p.key}
                  className={`px-2 py-1 text-right tabular-nums ${r < 0 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {fmt(r)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
    </Card>
  );
}

function EpicRow({
  epic,
  axis,
  periods,
  canManage,
  onChange,
}: {
  epic: BudgetEpicView;
  axis: HalfYearAxis;
  periods: { key: string; label: string }[];
  canManage: boolean;
  onChange: (next: BudgetEpicView) => void;
}) {
  const [state, save, pending] = useActionState(saveBudgetAllocationAction, {});
  const requested = requestedByPeriod(epic, axis);

  function setAllocation(key: string, value: string) {
    onChange({ ...epic, allocations: { ...epic.allocations, [key]: numOr0(value) } });
  }

  function submit() {
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        epicId: epic.id,
        priority: epic.priority,
        hypothesisBudget: epic.isHypothesisOnly ? epic.hypothesisBudget : null,
        allocations: epic.allocations,
      }),
    );
    startTransition(() => save(fd));
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
          className={`${cell} w-14 text-center`}
          inputMode="numeric"
          value={String(epic.priority)}
          disabled={!canManage}
          onChange={(e) => onChange({ ...epic, priority: Math.trunc(numOr0(e.target.value)) })}
          aria-label="Priorität"
        />
      </td>
      <td className="p-3">
        <select
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          value={epic.startKey}
          disabled={!canManage}
          onChange={(e) => onChange({ ...epic, startKey: e.target.value })}
          aria-label="Bedarf-Anker (Halbjahr)"
        >
          {periods.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </td>
      {periods.map((p) => (
        <td key={p.key} className="p-2 text-right">
          {epic.isHypothesisOnly && p.key === epic.startKey ? (
            <input
              className={cell}
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
                Bedarf {fmt(requested[p.key] ?? 0)}
              </div>
              <input
                className={cell}
                inputMode="numeric"
                value={epic.allocations[p.key] ? String(epic.allocations[p.key]) : ""}
                disabled={!canManage}
                placeholder="0"
                onChange={(e) => setAllocation(p.key, e.target.value)}
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
