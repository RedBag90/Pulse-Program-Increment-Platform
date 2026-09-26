import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import {
  CAPACITY_BUCKET_KEYS,
  type CapacityBucket,
} from "@/modules/work/domain/portfolio-guardrails";
import { statusFor } from "@/modules/work/domain/guardrail-rules";
import {
  maxCapacityDrift,
  noCapacityReason,
  type ValueStreamCapacityPlan,
} from "@/modules/work/server/views/value-stream-capacity-mix";
import { GuardrailStatusBadge } from "./guardrail-status-badge";
import { formatEUR } from "@/lib/formatting";

/**
 * **Guardrail 2 als Kapazitätskarte** — Punkte statt Prozente.
 *
 * Die Schwester-Karte daneben (Investment by Horizon) zeigt einen **Mix**: wie
 * sich eine Menge auf Kübel verteilt. Diese hier zeigt etwas anderes, und das
 * ist der Grund für eine eigene Karte statt eines dritten Kübels in
 * `GuardrailMixCard`: ein **Budget gegen eine Belastung**. „62 %" beantwortet
 * die Frage nicht, die hier zählt — „107 Punkte zu wenig" schon.
 *
 * Der Umschalter Anzahl ↔ € der Seite gilt für sie nicht: die Einheit ist der
 * Job-Size-Punkt, und eine zweite Währung daneben wäre dieselbe Aussage doppelt.
 */
export function CapacityPlanCard({ plan }: { plan: ValueStreamCapacityPlan }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const drift = maxCapacityDrift(plan);
  const status = statusFor(drift ?? 0, drift != null);
  const ohneSatz = plan.artsWithoutRate;
  const ohneKapazitaet = noCapacityReason(plan);

  return (
    <div className="space-y-3 rounded-lg bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-medium">{t("work.guardrails.capacityAllocation")}</h3>
        <span className="text-label uppercase tracking-[0.1em] text-muted-foreground">
          {t("work.guardrails.guardrail2Zyklus", { cycle: plan.cycleLabel })}
        </span>
        <span className="ml-auto">
          <GuardrailStatusBadge status={status} />
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("work.guardrails.kapazitaetEinleitung")}{" "}
        {ohneKapazitaet === "no_rate"
          ? t("work.guardrails.halbjahrOhneSatz")
          : ohneKapazitaet === "no_budget"
            ? t("work.guardrails.halbjahrOhneGeld")
            : t.rich("work.guardrails.kapazitaetPunkteUeberArts", {
                budget: formatEUR(plan.budget, locale),
                capacity: Math.round(plan.capacity ?? 0),
                withRate: plan.artCount - ohneSatz.length,
                total: plan.artCount,
                b: (c) => <strong className="font-medium text-foreground tabular-nums">{c}</strong>,
              })}
      </p>

      <table className="w-full text-sm">
        <tbody>
          {plan.rows.map((row) => (
            <Row
              key={row.bucket}
              bucket={row.bucket}
              planned={row.planned.jobSize}
              available={row.available}
              delta={row.delta}
              capacity={plan.capacity}
            />
          ))}
        </tbody>
      </table>

      {ohneSatz.length > 0 && (
        <p className="rounded-r-md border-l-2 bg-surface-frame px-3 py-2 text-xs text-muted-foreground">
          {t(
            ohneSatz.length === 1
              ? "work.guardrails.artOhneSatzEiner"
              : "work.guardrails.artOhneSatzMehrere",
            {
              count: ohneSatz.length,
              names: ohneSatz.map((a) => a.name).join(", "),
              points: ohneSatz.reduce((s, a) => s + a.jobSize, 0),
            },
          )}
        </p>
      )}

      {/* Immer sichtbar, auch bei 0 — sonst liest man die Aufteilung als
          vollständig. Dieselbe Regel wie auf der Mix-Karte daneben. */}
      <p className="text-xs text-muted-foreground">
        {plan.unclassified.count > 0
          ? t("work.guardrails.featuresOhneArbeitstypMitPunkten", {
              count: plan.unclassified.count,
              total: plan.totalPlanned.count,
              points: plan.unclassified.jobSize,
            })
          : t("work.guardrails.featuresOhneArbeitstyp", {
              count: plan.unclassified.count,
              total: plan.totalPlanned.count,
            })}
      </p>
    </div>
  );
}

function Row({
  bucket,
  planned,
  available,
  delta,
  capacity,
}: {
  bucket: CapacityBucket;
  planned: number;
  available: number | null;
  delta: number | null;
  capacity: number | null;
}) {
  const t = useTranslations();
  const tone =
    delta == null || capacity == null || capacity <= 0
      ? "text-muted-foreground"
      : delta / capacity > 0.05
        ? "text-destructive"
        : delta / capacity < -0.05
          ? "text-amber-600 dark:text-amber-400"
          : "text-muted-foreground";

  return (
    <tr className="border-b last:border-b-0">
      <td className="py-1.5">{t(CAPACITY_BUCKET_KEYS[bucket] ?? bucket)}</td>
      <td className="py-1.5 text-right tabular-nums">
        {t("work.guardrails.punkteKurz", { points: planned })}
      </td>
      <td className="py-1.5 text-right tabular-nums text-muted-foreground">
        {available == null || capacity == null || capacity <= 0
          ? "—"
          : t("work.guardrails.punkteKurz", { points: Math.round(available) })}
      </td>
      <td className={`py-1.5 text-right tabular-nums ${tone}`}>
        {delta == null || capacity == null || capacity <= 0
          ? "—"
          : `${delta > 0 ? "+" : ""}${Math.round(delta)}`}
      </td>
    </tr>
  );
}
