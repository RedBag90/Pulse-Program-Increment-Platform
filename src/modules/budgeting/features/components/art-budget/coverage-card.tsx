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
import type { JobSizeRate } from "@/modules/budgeting/domain/art-throughput";
import type { StreamKpi } from "@/modules/budgeting/server/views/budget-kpis";
import { SectionCard } from "@/components/ui/section-card";

/**
 * **„Wofür · eingeplant"** — Last gegen Deckung, als Karte.
 *
 * Sie stand bis 2026-09-19 oben im ART-Reiter und schleppte dort ihre ganze
 * Herleitung mit: drei Zahlenzeilen und ein Falter über den €-Satz, auf einer
 * Fläche, auf der man verteilen will. Jetzt wohnt sie im Reiter „Budget-KPIs" —
 * einem Ort zum Nachschlagen —, und im ART-Reiter bleibt davon **eine Zeile**
 * (`CoverageOneLiner`). Das Ergebnis ist keine Detailinformation; die
 * Herleitung schon.
 *
 * Eine **führende** Ampel im Klartext statt zweier gleichrangiger Chips: grün
 * und rot nebeneinander lassen die Leserin ratlos, welche zählt.
 *
 * Der Satz je Job-Size-Punkt trägt seine Herkunft und seine Vorbehalte mit. Er
 * ist eine Beobachtung aus der Historie dieses ARTs, keine Vorgabe — und wo er
 * sich nicht ableiten lässt, sagt die Fläche das, statt eine Zahl zu erfinden.
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

export function CoverageVerdictLine({ coverage }: { coverage: ArtCoverage }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { gap } = coverage;
  const verdict = coverageVerdict(coverage);
  // `gap > 0` steht doppelt, damit der Über-Betrag unten ohne `!` auskommt.
  const over = verdict === "over" && gap != null && gap > 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Dot verdict={verdict} />
      <p className="text-base">
        {verdict === "empty" ? (
          <>
            <strong className="font-semibold">{t("budgeting.art.nichtsZugeteilt")}</strong>{" "}
            {t("budgeting.art.fuerDiesesHalbjahrHat")}
          </>
        ) : verdict === "unknown" ? (
          <>
            <strong className="font-semibold">{t("budgeting.art.deckungNichtBerechenbar")}</strong>{" "}
            {t("budgeting.art.fuerDiesenArtLiegt")}
          </>
        ) : over ? (
          <>
            {t.rich("budgeting.art.ueberbuchtUmProzent", {
              amount: formatEUR(gap, locale),
              percent: coverage.allocated > 0 ? Math.round((gap / coverage.allocated) * 100) : 100,
              b: (c) => <strong className="font-semibold">{c}</strong>,
            })}
          </>
        ) : (
          <>
            {t.rich("budgeting.art.gedecktBleibenUnterBudget", {
              amount: formatEUR(underOf(gap) ?? 0, locale),
              b: (c) => <strong className="font-semibold">{c}</strong>,
            })}
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Die drei Zahlen — dieselbe Form für ART und Wertstrom.
 *
 * **Kein eigener Behälter mehr.** Hier stand eine Karte mit einer inline
 * gefärbten 3-px-Kante — ein Container-Stil, den es genau einmal im ganzen Haus
 * gab. Die Ampelfarbe trägt der Punkt oben und die Lücke unten; eine Farbe
 * braucht keinen Kasten, um zu sprechen.
 */
function CoverageFigures({
  plannedJobSize,
  featureCount,
  rate,
  loadEuro,
  allocated,
  gap,
}: {
  plannedJobSize: number;
  featureCount: number;
  /** `null` für den Wertstrom: es gibt dort keinen Satz (siehe `budget-kpis.ts`). */
  rate: number | null;
  loadEuro: number | null;
  allocated: number;
  gap: number | null;
}) {
  const t = useTranslations();
  const over = gap != null && gap > 0;
  const under = underOf(gap);

  return (
    <div className="rounded-lg border">
      <dl className="divide-y text-sm">
        <div className="flex justify-between gap-4 px-3 py-2">
          <dt>
            {t("budgeting.art.eingeplanteFeatureLast")}{" "}
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {t("budgeting.art.featureAnzahlUndJobSize", {
                count: featureCount,
                jobSize: plannedJobSize,
              })}
            </span>
            {rate != null && <> × {formatEUR(rate)}</>}
          </dt>
          <dd className="font-semibold tabular-nums">
            {loadEuro == null ? "—" : formatEUR(loadEuro)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 px-3 py-2">
          <dt>{t("budgeting.art.zugeteiltesBudget")}</dt>
          <dd className="font-semibold tabular-nums">{formatEUR(allocated)}</dd>
        </div>
        <div className="flex justify-between gap-4 px-3 py-2">
          <dt className={over ? "font-semibold text-destructive" : "font-semibold"}>
            {t("budgeting.art.luecke")}
          </dt>
          <dd className={`font-semibold tabular-nums ${over ? "text-destructive" : ""}`}>
            {under == null ? "—" : formatEUR(under)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * **Die Herleitung ist zugeklappt, der Satz steht im Deckel.** Drei graue und
 * gelbe Kästen untereinander erklärten eine Zahl, die eine Zeile höher schon
 * stand. Wer wissen will, woher sie kommt, klappt auf.
 */
function RateDetails({ rate }: { rate: JobSizeRate }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return (
    <details className="group/rate rounded-lg border">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm text-muted-foreground marker:content-[''] hover:text-foreground">
        <span className="group-open/rate:hidden">▸ </span>
        <span className="hidden group-open/rate:inline">▾ </span>
        <strong className="font-medium text-foreground">
          {rate.rate == null
            ? t("budgeting.art.keinSatzJeJobSize")
            : t("budgeting.art.satzJeJobSize", { rate: formatEUR(rate.rate, locale) })}
        </strong>
        {rate.caveats.length > 0 && (
          <span className="ml-1.5 text-warning">
            {rate.caveats.length === 1
              ? t("budgeting.art.anzahlVorbehaltEins", { count: rate.caveats.length })
              : t("budgeting.art.anzahlVorbehalte", { count: rate.caveats.length })}
          </span>
        )}
      </summary>
      <p className="border-t px-3 py-2 text-sm text-muted-foreground">
        {rate.source === "empirical" ? (
          <>
            {t("budgeting.art.durchschnittBudgetAusHistorie", {
              cycles: new Intl.ListFormat(locale, { type: "conjunction" }).format(
                rate.cycles.map((c) => c.cycleKey),
              ),
              budget: formatEUR(rate.budgetSum, locale),
              jobSize: rate.jobSizeSum,
              count: rate.featureCount,
            })}
            {/*
              Herkunft, nicht Rechnung: der Satz bleibt unverändert — das
              ART-Budget finanziert alles, was das ART tut. Die Zeile
              beantwortet die andere Frage: wie viel unserer Lieferung hing an
              keinem Vorhaben.
            */}
            {rate.standaloneFeatureCount > 0 && (
              <>
                {" "}
                {t("budgeting.art.davonPunkteAusEigenstaendigen", {
                  points: rate.standaloneJobSizeSum,
                  count: rate.standaloneFeatureCount,
                })}
              </>
            )}
          </>
        ) : rate.source === "tenantDefault" ? (
          <>{t("budgeting.art.derTenantWeiteVorgabewert")}</>
        ) : (
          <>{t("budgeting.art.wederAusDerHistorie")}</>
        )}
      </p>

      {rate.caveats.length > 0 && (
        <ul className="space-y-1 border-t px-3 py-2 text-sm text-warning">
          {rate.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** Die vollständige Karte eines ARTs — Ampel, Zahlen, Herleitung. */
export function ArtCoverageCard({ name, coverage }: { name: string; coverage: ArtCoverage }) {
  return (
    <SectionCard title={name} contentClassName="space-y-3">
      <CoverageVerdictLine coverage={coverage} />
      <CoverageFigures
        plannedJobSize={coverage.plannedJobSize}
        featureCount={coverage.featureCount}
        rate={coverage.rate.rate}
        loadEuro={coverage.loadEuro}
        allocated={coverage.allocated}
        gap={coverage.gap}
      />
      <RateDetails rate={coverage.rate} />
    </SectionCard>
  );
}

/**
 * Dieselbe Karte für den Wertstrom — **ohne Satz und ohne Falter**.
 *
 * Die Last ist die Summe der ART-Rechnungen, jede mit ihrem eigenen Satz. Ein
 * Wertstrom-Satz wäre eine Erfindung; die Karte sagt das, statt die Spalte leer
 * zu lassen und die Frage offen.
 */
export function StreamCoverageCard({ name, stream }: { name: string; stream: StreamKpi }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const verdict: CoverageVerdict =
    stream.plannedJobSize === 0 && stream.allocated === 0
      ? "empty"
      : stream.gap == null
        ? "unknown"
        : stream.gap > 0
          ? "over"
          : "covered";
  const under = underOf(stream.gap);

  return (
    <SectionCard title={name} contentClassName="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Dot verdict={verdict} />
        <p className="text-base">
          {verdict === "empty" ? (
            <>
              <strong className="font-semibold">{t("budgeting.art.nichtsZugeteilt")}</strong>{" "}
              {t("budgeting.art.fuerDiesesHalbjahrHat2")}
            </>
          ) : verdict === "unknown" ? (
            <>
              <strong className="font-semibold">
                {t("budgeting.art.deckungNichtBerechenbar")}
              </strong>{" "}
              {t("budgeting.art.fuerKeinesSeinerArts")}
            </>
          ) : verdict === "over" ? (
            <>
              {t.rich("budgeting.art.ueberbuchtUmProzent", {
                amount: formatEUR(stream.gap ?? 0, locale),
                percent:
                  stream.allocated > 0
                    ? Math.round(((stream.gap ?? 0) / stream.allocated) * 100)
                    : 100,
                b: (c) => <strong className="font-semibold">{c}</strong>,
              })}
            </>
          ) : (
            <>
              {t.rich("budgeting.art.gedecktBleibenUnterBudget", {
                amount: formatEUR(under ?? 0, locale),
                b: (c) => <strong className="font-semibold">{c}</strong>,
              })}
            </>
          )}
        </p>
      </div>

      <CoverageFigures
        plannedJobSize={stream.plannedJobSize}
        featureCount={stream.featureCount}
        rate={null}
        loadEuro={stream.loadEuro}
        allocated={stream.allocated}
        gap={stream.gap}
      />

      <p className="text-sm text-muted-foreground">
        {t.rich("budgeting.art.lastIstSummeDerArtRechnungen", {
          jobSize: stream.plannedJobSize,
          b: (c) => <strong className="font-medium text-foreground">{c}</strong>,
        })}
        {stream.withoutRate.length > 0 && (
          <>
            {" "}
            <span className="text-warning">
              {t("budgeting.art.ohneSatzNichtInSumme", { names: stream.withoutRate.join(", ") })}
            </span>
          </>
        )}
      </p>
    </SectionCard>
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
