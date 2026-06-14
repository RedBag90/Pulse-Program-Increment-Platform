import { TrendingUp } from "lucide-react";
import { kpiValueContribution } from "@/domain/kpi-valuation";
import { latestKpiValue, parseKpiMeasurements } from "@/domain/kpi";

/**
 * Realisierter Mehrwert je Epic (Konzept-Refactor §E). Aggregierte
 * €-Summe ueber alle Epic-KPIs: Σ (current − baseline) × valuePerUnit
 * je KPI mit gesetztem valuePerUnit.
 *
 * Unterschied zum `EpicGoalsBadge`: jener zeigt nur den ueber KR-
 * Bindungen bewerteten Teil; dieser Tile zeigt die volle Epic-Sicht,
 * unabhaengig davon, ob ein Epic an einen KR gebunden ist. Damit
 * sieht Jonas-Epic-Owner seinen Mehrwert auch ohne Strategie-Bindung.
 */
interface KpiLike {
  id: string;
  baseline: unknown;
  target: unknown;
  measurements: unknown;
  valuePerUnit: unknown;
}

interface Props {
  kpis: KpiLike[];
}

export function EpicRealizedTile({ kpis }: Props) {
  let realized = 0;
  let plannedTotal = 0;
  let evaluatedKpis = 0;
  let valuedKpis = 0;

  for (const k of kpis) {
    const baseline = toNum(k.baseline);
    const target = toNum(k.target);
    const valuePerUnit = toNum(k.valuePerUnit);
    if (valuePerUnit == null) continue;
    valuedKpis += 1;

    if (baseline != null && target != null) {
      plannedTotal += Math.abs(target - baseline) * valuePerUnit;
    }

    const current = latestKpiValue(parseKpiMeasurements(k.measurements));
    const contribution = kpiValueContribution({
      baseline,
      target,
      current,
      valuePerUnit,
    });
    if (contribution != null) {
      realized += contribution;
      evaluatedKpis += 1;
    }
  }

  if (valuedKpis === 0) {
    return null;
  }

  const ratio = plannedTotal > 0 ? Math.max(0, Math.min(1, realized / plannedTotal)) : 0;

  return (
    <section className="rounded-lg border bg-gradient-to-br from-emerald-50/40 to-card p-4">
      <header className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Realisierter Mehrwert
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {evaluatedKpis} von {valuedKpis} KPIs gemessen
        </span>
      </header>

      <div className="mt-2 flex items-baseline gap-3">
        <p className="text-2xl font-semibold tabular-nums text-emerald-700">{eur(realized)}</p>
        {plannedTotal > 0 && (
          <p className="text-sm text-muted-foreground">
            von <span className="font-medium">{eur(plannedTotal)}</span> Soll-Mehrwert
          </p>
        )}
      </div>

      {plannedTotal > 0 && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500/80"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {Math.round(ratio * 100)} % des moeglichen Mehrwerts auf Basis aktueller KPI-Messung
          </p>
        </div>
      )}
    </section>
  );
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function eur(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `€${(n / 1_000).toFixed(1)}K`;
  return `€${Math.round(n).toLocaleString("de-DE")}`;
}
