import { TrendingUp } from "lucide-react";
import { kpiValueContribution } from "@/domain/kpi-valuation";
import { latestKpiValue, parseKpiMeasurements } from "@/domain/kpi";
import { benefitKindOrDefault, type BenefitKind } from "@/domain/kpi-benefit-kind";
import { formatCompactEUR } from "@/lib/formatting";

/**
 * Realisierter Mehrwert je Epic (Konzept-Refactor §E). Σ (current − baseline) ×
 * valuePerUnit je KPI mit gesetztem valuePerUnit — **getrennt nach Benefit-Art**,
 * weil die Einheiten sich unterscheiden: one-time-KPIs realisieren einen einmaligen
 * €-Betrag, recurring-KPIs eine jährliche Run-Rate (€/Jahr). Eine gemeinsame Summe
 * würde Bestand und Fluss vermischen.
 *
 * Unterschied zum `EpicGoalsBadge`: jener zeigt nur den ueber KR-Bindungen
 * bewerteten Teil; dieser Tile zeigt die volle Epic-Sicht, unabhaengig von einer
 * Strategie-Bindung. Damit sieht Jonas-Epic-Owner seinen Mehrwert auch ohne KR.
 */
interface KpiLike {
  id: string;
  baseline: unknown;
  target: unknown;
  measurements: unknown;
  valuePerUnit: unknown;
  benefitKind: unknown;
}

interface Props {
  kpis: KpiLike[];
}

interface Bucket {
  realized: number;
  planned: number;
  evaluated: number;
  valued: number;
}

const emptyBucket = (): Bucket => ({ realized: 0, planned: 0, evaluated: 0, valued: 0 });

export function EpicRealizedTile({ kpis }: Props) {
  const buckets: Record<BenefitKind, Bucket> = {
    one_time: emptyBucket(),
    recurring: emptyBucket(),
  };

  for (const k of kpis) {
    const valuePerUnit = toNum(k.valuePerUnit);
    if (valuePerUnit == null) continue;
    const baseline = toNum(k.baseline);
    const target = toNum(k.target);
    const b =
      buckets[benefitKindOrDefault(typeof k.benefitKind === "string" ? k.benefitKind : null)];
    b.valued += 1;

    if (baseline != null && target != null) {
      b.planned += Math.abs(target - baseline) * valuePerUnit;
    }

    const current = latestKpiValue(parseKpiMeasurements(k.measurements));
    const contribution = kpiValueContribution({ baseline, target, current, valuePerUnit });
    if (contribution != null) {
      b.realized += contribution;
      b.evaluated += 1;
    }
  }

  if (buckets.one_time.valued === 0 && buckets.recurring.valued === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border bg-gradient-to-br from-emerald-50/40 to-card p-4">
      <header className="flex items-baseline gap-2">
        <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Realisierter Mehrwert
        </h3>
      </header>

      {buckets.one_time.valued > 0 && <BucketRow label="Einmalig" bucket={buckets.one_time} />}
      {buckets.recurring.valued > 0 && (
        <BucketRow label="Wiederkehrend p.a." suffix="/Jahr" bucket={buckets.recurring} />
      )}
    </section>
  );
}

function BucketRow({ label, suffix, bucket }: { label: string; suffix?: string; bucket: Bucket }) {
  const { realized, planned, evaluated, valued } = bucket;
  const ratio = planned > 0 ? Math.max(0, Math.min(1, realized / planned)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">
          {evaluated} von {valued} KPIs gemessen
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="text-2xl font-semibold tabular-nums text-emerald-700">
          {formatCompactEUR(realized)}
          {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
        </p>
        {planned > 0 && (
          <p className="text-sm text-muted-foreground">
            von <span className="font-medium">{formatCompactEUR(planned)}</span> Soll
          </p>
        )}
      </div>
      {planned > 0 && (
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
    </div>
  );
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
