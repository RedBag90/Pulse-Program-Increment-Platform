import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { formatEUR } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import {
  coverageVerdict,
  type ArtCoverage,
  type CoverageVerdict,
} from "@/modules/budgeting/domain/art-budget-model";

/**
 * **„Wofür · eingeplant" als eine Zeile** — was vom Deckungsbefund auf dem
 * ART-Reiter steht.
 *
 * Die vollständige Rechnung wohnt im Reiter „Budget-KPIs", seit September 2026
 * als Karte je Kennzahl statt je ART (`budget-kpi-overview.tsx`). Bis dahin
 * standen hier auch die ART- und die Wertstrom-Karte samt Herleitung.
 */

/** Die Ampelfarbe eines Befunds — dieselbe Zuordnung für ART und Wertstrom. */
function accentOf(verdict: CoverageVerdict): string {
  return verdict === "over"
    ? "var(--destructive)"
    : verdict === "empty"
      ? "var(--muted-foreground)"
      : "var(--primary)";
}

/** `0 − 0` ist in IEEE 754 die negative Null: `formatEUR(-gap)` schriebe „-0 €". */
function underOf(gap: number | null): number | null {
  return gap == null ? null : gap === 0 ? 0 : -gap;
}

function Dot({ verdict }: { verdict: CoverageVerdict }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: accentOf(verdict) }}
      aria-hidden
    />
  );
}

/**
 * **Was im ART-Reiter von der Karte bleibt: eine Zeile.**
 *
 * Ampelpunkt, Betrag, Prozent, Weg zur Herleitung. Mehr gehört nicht auf eine
 * Fläche, auf der man verteilt — und weniger wäre zu wenig: dass das Geld nicht
 * reicht, ist genau die Auskunft, die eine Verteilentscheidung braucht.
 */
export function CoverageOneLiner({
  coverage,
  kpiHref,
  cycleKey,
}: {
  coverage: ArtCoverage;
  kpiHref: string;
  cycleKey: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const verdict = coverageVerdict(coverage);
  const { gap } = coverage;
  const prozent =
    gap == null || coverage.allocated === 0 ? null : Math.round((gap / coverage.allocated) * 100);

  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <Dot verdict={verdict} />
      {verdict === "empty" ? (
        <span className="text-muted-foreground">
          {t("budgeting.art.fuerHalbjahrWederFeaturesNochBudget", { hj: halfYearLabel(cycleKey) })}
        </span>
      ) : verdict === "unknown" ? (
        <span className="text-muted-foreground">
          {t("budgeting.art.deckungNichtBerechenbarFuer")}
        </span>
      ) : verdict === "over" ? (
        <span>
          <strong className="font-medium">
            {t("budgeting.art.ueberbuchtUm", { amount: formatEUR(gap ?? 0, locale) })}
          </strong>
          {prozent != null && <span className="text-muted-foreground"> · {prozent} %</span>}
        </span>
      ) : (
        <span>
          <strong className="font-medium">{t("budgeting.art.gedeckt")}</strong>
          <span className="text-muted-foreground">
            {" "}
            {t("budgeting.art.unterDemBudgetKurz", {
              amount: formatEUR(underOf(gap) ?? 0, locale),
            })}
          </span>
        </span>
      )}
      <Link href={kpiHref} className="text-primary hover:underline">
        {t("budgeting.art.wofuerEingeplant")}
      </Link>
    </p>
  );
}
