import { TrendingUp, Lock } from "lucide-react";
import { kpiOutcome, type KpiValuationTerms } from "@/modules/core/kpi/domain/kpi-outcome";
import { parseKpiMeasurements } from "@/modules/core/kpi/domain/kpi";
import { benefitKindOrDefault, type BenefitKind } from "@/modules/core/kpi/domain/kpi-benefit-kind";
import { formatCompactEUR } from "@/lib/formatting";

/**
 * Realisierter Mehrwert je Epic — **getrennt nach Benefit-Art**, weil die
 * Einheiten sich unterscheiden: one-time-KPIs realisieren einen einmaligen
 * €-Betrag, recurring-KPIs eine jährliche Run-Rate (€/Jahr). Eine gemeinsame
 * Summe würde Bestand und Fluss vermischen.
 *
 * Die Zahlen kommen aus `kpiOutcome` (Core), damit die Kachel dieselbe Rechnung
 * zeigt wie Dashboard und Review — inklusive der zwei Achsen, auf denen ein Epic
 * abweichen kann: **Menge** (Zielerreichung, friert mit der L4.2-Abnahme) und
 * **Wert** (Umrechnungsfaktor, den Finance bis L5 nachziehen darf). Ohne diese
 * Trennung sähe man nur, *dass* es anders kam, nicht *woran* es lag.
 *
 * Unterschied zum `EpicGoalsBadge`: jener zeigt nur den ueber KR-Bindungen
 * bewerteten Teil; dieser Tile zeigt die volle Epic-Sicht, unabhaengig von einer
 * Strategie-Bindung.
 */
interface KpiLike {
  id: string;
  baseline: unknown;
  target: unknown;
  measurements: unknown;
  valuePerUnit: unknown;
  benefitKind: unknown;
  recurringInterval: unknown;
  /** Plan-Stand zur Business-Case-Freigabe; null = kein Schnappschuss. */
  planSnapshot?: unknown;
}

interface Props {
  kpis: KpiLike[];
  /** L4.2-Abnahme — gesetzt ⇒ die gelieferte Menge steht fest. */
  frozenAt?: Date | null;
}

interface Bucket {
  realized: number;
  planned: number;
  quantityDelta: number;
  valueDelta: number;
  evaluated: number;
  valued: number;
}

const emptyBucket = (): Bucket => ({
  realized: 0,
  planned: 0,
  quantityDelta: 0,
  valueDelta: 0,
  evaluated: 0,
  valued: 0,
});

/** Liest den gespeicherten Plan-Schnappschuss; unbrauchbare Formen → null. */
function parsePlanSnapshot(raw: unknown): KpiValuationTerms | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    baseline: toNum(o.baseline),
    target: toNum(o.target),
    valuePerUnit: toNum(o.valuePerUnit),
    ...(typeof o.benefitKind === "string" ? { benefitKind: o.benefitKind } : {}),
    ...(typeof o.recurringInterval === "string" ? { recurringInterval: o.recurringInterval } : {}),
  };
}

export function EpicRealizedTile({ kpis, frozenAt = null }: Props) {
  const buckets: Record<BenefitKind, Bucket> = {
    one_time: emptyBucket(),
    recurring: emptyBucket(),
  };

  for (const k of kpis) {
    const valuePerUnit = toNum(k.valuePerUnit);
    if (valuePerUnit == null) continue;
    const kind = benefitKindOrDefault(typeof k.benefitKind === "string" ? k.benefitKind : null);
    const b = buckets[kind];
    b.valued += 1;

    const measurements = parseKpiMeasurements(k.measurements);
    // `kpiOutcome` normalisiert monatlich Wiederkehrendes selbst aufs Jahr —
    // „Wiederkehrend p.a." bleibt damit eine konsistente Einheit.
    const o = kpiOutcome({
      baseline: toNum(k.baseline),
      target: toNum(k.target),
      valuePerUnit,
      ...(typeof k.benefitKind === "string" ? { benefitKind: k.benefitKind } : {}),
      ...(typeof k.recurringInterval === "string"
        ? { recurringInterval: k.recurringInterval }
        : {}),
      measurements,
      planSnapshot: parsePlanSnapshot(k.planSnapshot),
      frozenAt,
    });
    b.planned += o.planned;
    b.realized += o.realized;
    b.quantityDelta += o.quantityDelta;
    b.valueDelta += o.valueDelta;
    if (measurements.length > 0) b.evaluated += 1;
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

      {buckets.one_time.valued > 0 && (
        <BucketRow label="Einmalig" bucket={buckets.one_time} frozen={frozenAt != null} />
      )}
      {buckets.recurring.valued > 0 && (
        <BucketRow
          label="Wiederkehrend p.a."
          suffix="/Jahr"
          bucket={buckets.recurring}
          frozen={frozenAt != null}
        />
      )}
    </section>
  );
}

function BucketRow({
  label,
  suffix,
  bucket,
  frozen,
}: {
  label: string;
  suffix?: string;
  bucket: Bucket;
  frozen: boolean;
}) {
  const { realized, planned, quantityDelta, valueDelta, evaluated, valued } = bucket;
  const ratio = planned > 0 ? Math.max(0, Math.min(1, realized / planned)) : 0;
  const hasDelta = Math.round(quantityDelta) !== 0 || Math.round(valueDelta) !== 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          {label}
          {frozen && (
            <span
              className="inline-flex items-center gap-1 text-[10px]"
              title="Die Umsetzung ist abgenommen (L4.2) — die gelieferte Menge steht fest."
            >
              <Lock className="h-3 w-3" aria-hidden />
              festgeschrieben
            </span>
          )}
        </span>
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
            {Math.round(ratio * 100)} % des möglichen Mehrwerts auf Basis der KPI-Messung
          </p>
        </div>
      )}
      {hasDelta && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          <dt>Menge (Zielerreichung)</dt>
          <dd className="text-right tabular-nums">
            <Delta value={quantityDelta} suffix={suffix} />
          </dd>
          <dt>Wert (Umrechnungsfaktor)</dt>
          <dd className="text-right tabular-nums">
            <Delta value={valueDelta} suffix={suffix} />
          </dd>
        </dl>
      )}
    </div>
  );
}

/** Ein Abweichungs-Betrag mit Vorzeichen — grün über Plan, bernstein darunter. */
function Delta({ value, suffix }: { value: number; suffix?: string | undefined }) {
  if (Math.round(value) === 0) return <span>—</span>;
  const over = value > 0;
  return (
    <span className={over ? "text-emerald-700" : "text-amber-700"}>
      {over ? "+" : "−"}
      {formatCompactEUR(Math.abs(value))}
      {suffix}
    </span>
  );
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
