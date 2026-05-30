"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ValuePerUnitInput } from "@/features/controlling/components/value-per-unit-input";
import { eurPerPercentagePoint, kpiDelta, percentOfTargetGap } from "@/domain/kpi-valuation";
import type { KpiTree as KpiTreeData } from "@/server/services/controlling";

interface Props {
  tree: KpiTreeData;
  canEdit: boolean;
}

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const fmtEur = (v: number | null) => (v == null ? "—" : eur.format(Math.round(v)));
const fmtNum = (v: number | null, fractionDigits = 1) =>
  v == null ? "—" : v.toLocaleString("de-DE", { maximumFractionDigits: fractionDigits });
const fmtPct = (v: number | null) =>
  v == null ? "—" : `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
const fmtSigned = (v: number) => (v > 0 ? `+${fmtNum(v)}` : fmtNum(v));

/**
 * The KPI tree — one aligned table whose rows are grouped into collapsible
 * sections per Goal (mirrors the Epics overview pattern). Strategic KPIs
 * (`TargetOutcome`) and operational KPIs from linked Epics (`Kpi`) appear as
 * flat rows under each Goal; the "Quelle" column distinguishes them and links
 * operational KPIs to their Epic.
 */
export function KpiTree({ tree, canEdit }: Props) {
  // Open goals that carry any KPI data; collapse empty ones by default. Plus
  // a sticky open state for the unbound-strategic bucket.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const g of tree.goals) {
      map[g.id] = g.strategicKpis.length > 0 || g.epics.some((e) => e.kpis.length > 0);
    }
    map.__unbound__ = tree.unboundStrategicKpis.length > 0;
    return map;
  });
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  if (tree.goals.length === 0 && tree.unboundStrategicKpis.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine Ziele oder strategischen KPIs vorhanden.
      </p>
    );
  }

  const colCount = 7;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <Th>KPI</Th>
          <Th>Quelle</Th>
          <Th right>Baseline → Ist → Ziel</Th>
          <Th right>Δ</Th>
          <Th right>% Ziel</Th>
          <Th right>€ / Einheit</Th>
          <Th right>€ Beitrag</Th>
        </tr>
      </thead>

      {tree.goals.map((goal) => {
        const rows = buildGoalRows(goal);
        const isOpen = open[goal.id] ?? false;
        const sum = sumContributions(rows);
        return (
          <tbody key={goal.id}>
            <SectionHeader
              colCount={colCount}
              isOpen={isOpen}
              onToggle={() => toggle(goal.id)}
              label={goal.title}
              count={rows.length}
              status={goal.status}
              contribution={sum}
            />
            {isOpen && rows.length === 0 && (
              <tr className="border-b">
                <td colSpan={colCount} className="py-2 pl-6 text-muted-foreground">
                  Keine KPIs
                </td>
              </tr>
            )}
            {isOpen && rows.map((row) => <KpiRowEl key={row.id} row={row} canEdit={canEdit} />)}
          </tbody>
        );
      })}

      {tree.unboundStrategicKpis.length > 0 &&
        (() => {
          const rows = tree.unboundStrategicKpis.map((k) => toStrategicRow(k));
          const isOpen = open.__unbound__ ?? false;
          return (
            <tbody>
              <SectionHeader
                colCount={colCount}
                isOpen={isOpen}
                onToggle={() => toggle("__unbound__")}
                label="Ungebundene strategische KPIs"
                count={rows.length}
                contribution={sumContributions(rows)}
              />
              {isOpen && rows.map((row) => <KpiRowEl key={row.id} row={row} canEdit={canEdit} />)}
            </tbody>
          );
        })()}
    </table>
  );
}

// ----- table primitives --------------------------------------------------

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "pb-2 pr-3 text-[10px] font-semibold uppercase tracking-[0.1em]",
        right && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function SectionHeader({
  colCount,
  isOpen,
  onToggle,
  label,
  count,
  status,
  contribution,
}: {
  colCount: number;
  isOpen: boolean;
  onToggle: () => void;
  label: string;
  count: number;
  status?: string;
  contribution: number | null;
}) {
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={colCount} className="py-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
          {status && <span className="text-[10px] text-muted-foreground">· {status}</span>}
          <span className="ml-auto pr-3 font-mono text-xs tabular-nums text-muted-foreground">
            Σ {fmtEur(contribution)}
          </span>
        </button>
      </td>
    </tr>
  );
}

// ----- row model ---------------------------------------------------------

interface KpiRow {
  id: string;
  kind: "kpi" | "outcome";
  name: string;
  unit: string | null;
  /** "Strategisch" or the linked Epic title. */
  source: { label: string; href?: string };
  baseline: number | null;
  target: number | null;
  current: number | null;
  valuePerUnit: number | null;
  contribution: number | null;
}

function buildGoalRows(goal: KpiTreeData["goals"][number]): KpiRow[] {
  const strategic = goal.strategicKpis.map(toStrategicRow);
  const operational = goal.epics
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, "de"))
    .flatMap((epic) =>
      epic.kpis.map<KpiRow>((k) => ({
        id: k.id,
        kind: "kpi",
        name: k.name,
        unit: k.unit,
        source: { label: epic.title, href: `/portfolio/epics/${epic.id}` },
        baseline: k.baseline,
        target: k.target,
        current: k.current,
        valuePerUnit: k.valuePerUnit,
        contribution: k.contribution,
      })),
    );
  return [...strategic, ...operational];
}

function toStrategicRow(k: KpiTreeData["unboundStrategicKpis"][number]): KpiRow {
  return {
    id: k.id,
    kind: "outcome",
    name: k.title,
    unit: k.metricUnit,
    source: { label: "Strategisch" },
    baseline: k.baseline,
    target: k.target,
    current: k.current,
    valuePerUnit: k.valuePerUnit,
    contribution: k.contribution,
  };
}

function KpiRowEl({ row, canEdit }: { row: KpiRow; canEdit: boolean }) {
  const delta = kpiDelta(row);
  const pct = percentOfTargetGap(row);
  const eurPp = eurPerPercentagePoint(row);
  const contribTone =
    row.contribution == null
      ? "text-muted-foreground"
      : row.contribution > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : row.contribution < 0
          ? "text-destructive"
          : "text-muted-foreground";
  const deltaTone =
    delta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta < 0
        ? "text-destructive"
        : "text-muted-foreground";
  const canComputeDelta = row.baseline != null && row.target != null && row.current != null;

  return (
    <tr className="border-b hover:bg-muted/30">
      <td className="py-2 pr-3 pl-6 align-top">
        <div className="text-sm font-medium">{row.name}</div>
        {row.unit && <div className="text-[10px] text-muted-foreground">{row.unit}</div>}
      </td>
      <td className="py-2 pr-3 align-top text-xs text-muted-foreground">
        {row.source.href ? (
          <Link href={row.source.href} className="hover:text-foreground hover:underline">
            {row.source.label}
          </Link>
        ) : (
          row.source.label
        )}
      </td>
      <td className="py-2 pr-3 text-right align-top font-mono tabular-nums">
        {fmtNum(row.baseline)} <span className="text-muted-foreground">→</span>{" "}
        <span className="font-medium">{fmtNum(row.current)}</span>{" "}
        <span className="text-muted-foreground">→</span> {fmtNum(row.target)}
      </td>
      <td className={cn("py-2 pr-3 text-right align-top font-mono tabular-nums", deltaTone)}>
        {canComputeDelta ? fmtSigned(delta) : "—"}
      </td>
      <td className="py-2 pr-3 text-right align-top font-mono tabular-nums text-muted-foreground">
        {fmtPct(pct)}
      </td>
      <td className="py-2 pr-3 text-right align-top">
        <ValuePerUnitInput
          kind={row.kind}
          id={row.id}
          value={row.valuePerUnit}
          canEdit={canEdit}
          unitLabel={row.unit ? `€/${row.unit}` : "€"}
        />
        {eurPp != null && (
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
            ≡ {fmtEur(eurPp)} / 1 pp
          </div>
        )}
      </td>
      <td className={cn("py-2 text-right align-top font-mono tabular-nums", contribTone)}>
        {fmtEur(row.contribution)}
      </td>
    </tr>
  );
}

function sumContributions(items: { contribution: number | null }[]): number | null {
  const vals = items.map((i) => i.contribution).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}
