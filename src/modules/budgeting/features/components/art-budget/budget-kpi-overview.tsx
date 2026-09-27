import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { formatDate, formatDecimal, formatEUR, formatScaledEUR } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import {
  coverageVerdict,
  type ArtCoverage,
  type CoverageVerdict,
} from "@/modules/budgeting/domain/art-budget-model";
import type { JobSizeRate, RateSource } from "@/modules/budgeting/domain/art-throughput";
import type { JobSizeBurn } from "@/modules/budgeting/domain/job-size-burn";
import {
  burnStatus,
  coverageRatio,
  type BurnStatus,
  type RateSuspicion,
  type StreamKpi,
} from "@/modules/budgeting/server/views/budget-kpis";
import { SectionCard } from "@/components/ui/section-card";
import { Card } from "@/components/ui/card";
import { JobSizeBurnChart } from "@/modules/budgeting/features/components/art-budget/job-size-burn-chart";
import { RateEstimateForm } from "@/modules/budgeting/features/components/art-budget/rate-estimate-form";

/**
 * **Der Reiter „Budget-KPIs" — eine Karte je Kennzahl, nicht je ART.**
 *
 * Bis September 2026 standen drei lange Karten untereinander (Wertstrom, ART 1,
 * ART 2), jede mit Urteil, Zahlen, Diagramm, PI-Tabelle und Herleitung — drei
 * bis vier Bildschirmhöhen, und zwei ARTs verglich man durch Scrollen. Jetzt:
 * zwei gleichrangige Kacheln (Deckung, Lieferung), je eine Karte, die die ARTs
 * nebeneinanderstellt, die Herleitung eingeklappt (`docs/concepts/
 * budget-kpi-tab.md`).
 *
 * Jede Kachel und Karte nennt **ihren Zeitraum**: die Deckung rechnet im
 * gewählten Halbjahr, die Lieferung in der geltenden Budget-Kachel. Vorher
 * standen beide auf einer Karte, ohne dass man es sah.
 */

type Chip = "bad" | "warn" | "good" | "neutral";

const CHIP: Record<Chip, string> = {
  bad: "bg-destructive/10 text-destructive",
  warn: "bg-warning/10 text-warning",
  good: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
};

function Pill({ tone, children }: { tone: Chip; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-label font-medium ${CHIP[tone]}`}
    >
      {children}
    </span>
  );
}

const VERDICT_TONE: Record<CoverageVerdict, Chip> = {
  over: "bad",
  covered: "good",
  unknown: "neutral",
  empty: "neutral",
};
const VERDICT_KEY: Record<CoverageVerdict, string> = {
  over: "budgeting.kpi.chipUeberbucht",
  covered: "budgeting.kpi.chipGedeckt",
  unknown: "budgeting.kpi.chipNichtBerechenbar",
  empty: "budgeting.kpi.chipLeer",
};
const BURN_TONE: Record<BurnStatus, Chip> = {
  over: "warn",
  under: "warn",
  inBand: "good",
  none: "neutral",
};
const BURN_KEY: Record<BurnStatus, string> = {
  over: "budgeting.kpi.chipUeberPlan",
  under: "budgeting.kpi.chipUnterPlan",
  inBand: "budgeting.kpi.chipImBand",
  none: "budgeting.kpi.chipKeinPlan",
};
const SOURCE_KEY: Record<RateSource, string> = {
  empirical: "budgeting.kpi.quelleEmpirisch",
  artEstimate: "budgeting.kpi.quelleSchaetzung",
  none: "budgeting.kpi.quelleKeiner",
};

/** Die Lücke als Wort statt Vorzeichen: „fehlen X" oder „X frei". */
function GapText({ gap, strong = false }: { gap: number | null; strong?: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (gap == null) return <span className="text-muted-foreground">—</span>;
  const eur = formatScaledEUR(Math.abs(gap), locale);
  return gap > 0 ? (
    <span className={`text-destructive ${strong ? "font-semibold" : "font-medium"}`}>
      {t("budgeting.kpi.fehlen", { amount: eur })}
    </span>
  ) : (
    <span className={strong ? "font-semibold" : undefined}>
      {t("budgeting.kpi.frei", { amount: eur })}
    </span>
  );
}

const pct = (ratio: number, locale: Locale) => `${formatDecimal(ratio * 100, 0, locale)} %`;
const signedPct = (dev: number, locale: Locale) =>
  `${dev > 0 ? "+" : ""}${formatDecimal(dev * 100, 0, locale)} %`;
/** Letzter Tag der Kachel — `end` ist die Grenze danach. */
const lastDay = (end: Date) => new Date(end.getTime() - 86_400_000);

// ---------------------------------------------------------------------------
// Kacheln
// ---------------------------------------------------------------------------

/**
 * **Zwei Kacheln, gleichrangig** — Deckung im gewählten Halbjahr, Lieferung in
 * der geltenden Kachel. Ohne Wertstrom-Recht rechnen beide über die ARTs, die
 * der Betrachter sieht, und sagen das.
 */
export function KpiTiles({
  stream,
  cycleKey,
  artCount,
  isTotal,
}: {
  stream: StreamKpi;
  cycleKey: string;
  artCount: number;
  /** `true`: Σ Wertstrom; `false`: nur die sichtbaren ARTs. */
  isTotal: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const verdict = coverageVerdict(stream);
  const ratio = coverageRatio(stream.loadEuro, stream.allocated);
  const burn = stream.burn;
  const status = burnStatus(burn);
  const umfang = isTotal
    ? t("budgeting.kpi.umfangWertstrom", { count: artCount })
    : t("budgeting.kpi.umfangSichtbar", { count: artCount });

  return (
    <div className="grid gap-4 md:grid-cols-2" data-kpi="tiles">
      <Card className="gap-2 px-5" data-tile="deckung">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
            {t("budgeting.kpi.deckungTitel", { halbjahr: halfYearLabel(cycleKey) })}
          </h2>
          <span className="text-meta text-muted-foreground">{umfang}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={VERDICT_TONE[verdict]}>{t(VERDICT_KEY[verdict])}</Pill>
          <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {verdict === "empty" ? "—" : <GapText gap={stream.gap} strong />}
          </span>
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          {t("budgeting.kpi.lastBudget", {
            load: stream.loadEuro == null ? "—" : formatScaledEUR(stream.loadEuro, locale),
            budget: formatScaledEUR(stream.allocated, locale),
          })}
          {ratio != null && (
            <>
              {" · "}
              <strong className="font-semibold text-foreground">{pct(ratio, locale)}</strong>
            </>
          )}
        </p>
      </Card>

      <Card className="gap-2 px-5" data-tile="lieferung">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
            {burn
              ? t("budgeting.kpi.lieferungTitel", { kachel: halfYearLabel(burn.cycleKey) })
              : t("budgeting.kpi.lieferungOhneKachel")}
          </h2>
          {burn && (
            <span className="text-meta text-muted-foreground">
              {formatDate(burn.start, "date", locale)}–
              {formatDate(lastDay(burn.end), "date", locale)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={BURN_TONE[status]}>{t(BURN_KEY[status])}</Pill>
          {status !== "none" && burn?.deviation != null && (
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              {signedPct(burn.deviation, locale)}
            </span>
          )}
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          <BurnLine burn={burn} />
        </p>
      </Card>
    </div>
  );
}

/** Die eine Zeile unter der Lieferungs-Kachel: Ist, Plan heute, erwartet — oder warum kein Plan. */
function BurnLine({ burn }: { burn: JobSizeBurn | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const js = (n: number) => formatDecimal(n, 0, locale);
  if (burn == null) return <>{t("budgeting.kpi.keinPlanKeineKachel")}</>;
  if (burn.reason === "noRate")
    return <>{t("budgeting.burn.ohneSatz", { actual: js(burn.actualToday) })}</>;
  if (burn.reason === "noBudget" || burn.expected == null) {
    return <>{t("budgeting.burn.ohneBudgetKachel", { actual: js(burn.actualToday) })}</>;
  }
  if (burn.planToday == null || burn.today.getTime() <= burn.start.getTime()) {
    return <>{t("budgeting.burn.nochNichtBegonnen", { expected: js(burn.expected) })}</>;
  }
  return (
    <>
      {t("budgeting.kpi.istPlan", {
        actual: js(burn.actualToday),
        plan: js(burn.planToday),
        expected: js(burn.expected),
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Hinweis „Satz prüfen"
// ---------------------------------------------------------------------------

/**
 * Deckung und Lieferung weichen gegenläufig weit ab — beides hängt am selben
 * €-Satz (`rateSuspicion`). Ein Hinweis statt zweier Alarme ohne Zusammenhang.
 */
export function RateCheckBanner({ suspicions }: { suspicions: readonly RateSuspicion[] }) {
  const t = useTranslations();
  if (suspicions.length === 0) return null;
  return (
    <div
      role="note"
      data-kpi="rate-check"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
    >
      <strong className="font-semibold text-warning">{t("budgeting.kpi.satzPruefen")}</strong>
      <span className="min-w-0 flex-1">
        {t("budgeting.kpi.satzPruefenText", {
          names: suspicions.map((s) => s.name).join(", "),
        })}
      </span>
      <a href="#deckung" className="font-medium text-primary hover:underline">
        {t("budgeting.kpi.zuDenSaetzen")}
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Karte „Deckung"
// ---------------------------------------------------------------------------

/** Die Spalten der Deckungstabelle — Kopf, Zeilen und Σ teilen sie. */
const COVERAGE_COLS =
  "md:grid md:grid-cols-[minmax(9rem,1.3fr)_minmax(6rem,0.8fr)_minmax(10rem,1.5fr)_minmax(5.5rem,0.8fr)_minmax(5rem,0.7fr)_minmax(8rem,1.1fr)_minmax(7.5rem,1fr)_1.25rem] md:items-center md:gap-x-3";

export interface CoverageRow {
  artId: string;
  name: string;
  coverage: ArtCoverage;
  /** Gesetzt, wenn der Betrachter den Satz dieses ARTs schätzen darf. */
  estimate?: { artId: string } | undefined;
}

export function CoverageTable({
  rows,
  stream,
  cycleKey,
  suspicions,
}: {
  rows: readonly CoverageRow[];
  /** `null` ohne Wertstrom-Recht: dann keine Σ-Zeile. */
  stream: StreamKpi | null;
  cycleKey: string;
  suspicions: readonly RateSuspicion[];
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const suspect = new Map(suspicions.map((s) => [s.artId, s]));

  return (
    <SectionCard
      title={t("budgeting.kpi.deckungKarteTitel")}
      description={halfYearLabel(cycleKey)}
      contentClassName="space-y-2"
    >
      <div id="deckung" className="scroll-mt-24 text-sm" data-kpi="deckung">
        <div
          className={`hidden border-b pb-2 text-label font-medium text-muted-foreground ${COVERAGE_COLS}`}
          aria-hidden
        >
          <span>{t("budgeting.kpi.spalteArt")}</span>
          <span className="text-right">{t("budgeting.kpi.spalteFeatureLast")}</span>
          <span>{t("budgeting.kpi.spalteSatz")}</span>
          <span className="text-right">{t("budgeting.kpi.spalteLast")}</span>
          <span className="text-right">{t("budgeting.kpi.spalteBudget")}</span>
          <span>{t("budgeting.kpi.spalteDeckung")}</span>
          <span className="text-right">{t("budgeting.kpi.spalteLuecke")}</span>
          <span />
        </div>

        {rows.map((r) => (
          <CoverageRowItem key={r.artId} row={r} suspicion={suspect.get(r.artId) ?? null} />
        ))}

        {stream && (
          <div className={`border-t-2 py-3 font-semibold ${COVERAGE_COLS}`} data-row="summe">
            <span>{t("budgeting.kpi.summeWertstrom")}</span>
            <Cell label={t("budgeting.kpi.spalteFeatureLast")} right>
              {t("budgeting.art.featureAnzahlUndJobSize", {
                count: stream.featureCount,
                jobSize: stream.plannedJobSize,
              })}
            </Cell>
            <span className="hidden text-muted-foreground md:block">—</span>
            <Cell label={t("budgeting.kpi.spalteLast")} right>
              {stream.loadEuro == null ? "—" : formatScaledEUR(stream.loadEuro, locale)}
            </Cell>
            <Cell label={t("budgeting.kpi.spalteBudget")} right>
              {formatScaledEUR(stream.allocated, locale)}
            </Cell>
            <Cell label={t("budgeting.kpi.spalteDeckung")}>
              <CoverageBar loadEuro={stream.loadEuro} allocated={stream.allocated} />
            </Cell>
            <Cell label={t("budgeting.kpi.spalteLuecke")} right>
              <GapText gap={stream.gap} strong />
            </Cell>
            <span />
          </div>
        )}
      </div>
      <p className="text-meta text-muted-foreground">
        {t("budgeting.kpi.summeHinweis")}
        {stream && stream.withoutRate.length > 0 && (
          <>
            {" "}
            <span className="text-warning">
              {t("budgeting.kpi.ohneSatzInSumme", { names: stream.withoutRate.join(", ") })}
            </span>
          </>
        )}
      </p>
    </SectionCard>
  );
}

/**
 * Eine Zelle der Deckungstabelle. Unter `md` stapeln die Spalten; dann trägt
 * jeder Wert seine Spaltenüberschrift als Etikett, sonst stünden „249 T€" und
 * „0 €" ohne Bedeutung untereinander.
 */
function Cell({
  label,
  right = false,
  children,
}: {
  label: string;
  right?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`flex items-center justify-between gap-3 tabular-nums md:block ${right ? "md:text-right" : ""}`}
    >
      <span className="text-label text-muted-foreground md:hidden">{label}</span>
      <span>{children}</span>
    </span>
  );
}

/** Last ÷ Budget als Balken mit 100-%-Marke; über 100 % gekappt gezeichnet, Zahl ungekappt. */
function CoverageBar({ loadEuro, allocated }: { loadEuro: number | null; allocated: number }) {
  const locale = useLocale() as Locale;
  const ratio = coverageRatio(loadEuro, allocated);
  if (ratio == null) return <span className="text-muted-foreground">—</span>;
  const over = ratio > 1;
  return (
    <span className="flex items-center gap-2">
      <span
        className="relative h-2 w-full max-w-28 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.min(1, ratio) * 100}%` }}
        />
      </span>
      <span
        className={`shrink-0 text-label font-medium tabular-nums ${over ? "text-destructive" : ""}`}
      >
        {pct(ratio, locale)}
      </span>
    </span>
  );
}

/**
 * Eine ART-Zeile mit aufklappbarem „Wie gerechnet?". Offen nur, wenn es keinen
 * Satz gibt **und** der Betrachter schätzen darf — dann ist das Formular die
 * Antwort auf die leere Zeile.
 */
function CoverageRowItem({
  row,
  suspicion,
}: {
  row: CoverageRow;
  suspicion: RateSuspicion | null;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { coverage } = row;
  const rate = coverage.rate;
  const open = rate.source === "none" && row.estimate != null;

  return (
    <details className="group/row border-b" open={open} data-row={row.artId}>
      <summary
        className={`cursor-pointer list-none space-y-1 py-3 marker:content-[''] hover:bg-muted ${COVERAGE_COLS}`}
        aria-label={t("budgeting.kpi.wieGerechnetFuer", { name: row.name })}
      >
        <span className="font-medium">{row.name}</span>
        <Cell label={t("budgeting.kpi.spalteFeatureLast")} right>
          <span className="text-muted-foreground">
            {t("budgeting.art.featureAnzahlUndJobSize", {
              count: coverage.featureCount,
              jobSize: coverage.plannedJobSize,
            })}
          </span>
        </Cell>
        <span className="flex flex-wrap items-center gap-1.5">
          {rate.rate != null && (
            <span className="font-medium tabular-nums">{formatEUR(rate.rate, locale)}</span>
          )}
          <Pill tone={rate.source === "none" ? "bad" : "neutral"}>
            {t(SOURCE_KEY[rate.source])}
          </Pill>
          {rate.caveats.length > 0 && (
            <Pill tone="warn">{t("budgeting.kpi.vorbehalte", { count: rate.caveats.length })}</Pill>
          )}
          {suspicion && <Pill tone="bad">{t("budgeting.kpi.chipPruefen")}</Pill>}
        </span>
        <Cell label={t("budgeting.kpi.spalteLast")} right>
          {coverage.loadEuro == null ? "—" : formatScaledEUR(coverage.loadEuro, locale)}
        </Cell>
        <Cell label={t("budgeting.kpi.spalteBudget")} right>
          {formatScaledEUR(coverage.allocated, locale)}
        </Cell>
        <Cell label={t("budgeting.kpi.spalteDeckung")}>
          <CoverageBar loadEuro={coverage.loadEuro} allocated={coverage.allocated} />
        </Cell>
        <Cell label={t("budgeting.kpi.spalteLuecke")} right>
          <GapText gap={coverage.gap} />
        </Cell>
        <span className="hidden text-muted-foreground md:block" aria-hidden>
          <span className="group-open/row:hidden">▸</span>
          <span className="hidden group-open/row:inline">▾</span>
        </span>
      </summary>
      <HowCalculated row={row} suspicion={suspicion} />
    </details>
  );
}

function HowCalculated({ row, suspicion }: { row: CoverageRow; suspicion: RateSuspicion | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { coverage } = row;
  const rate = coverage.rate;
  const ratio = coverageRatio(coverage.loadEuro, coverage.allocated);
  const dev = coverage.burn?.deviation ?? null;

  return (
    <div className="mb-3 grid gap-6 rounded-md border bg-surface-frame p-4 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t("budgeting.kpi.wieGerechnet")}</h3>
        <RateSentence rate={rate} />
        {rate.cycles.length > 0 && <RateCycles rate={rate} />}
        {row.estimate && rate.source !== "empirical" && (
          <RateEstimateForm artId={row.estimate.artId} current={rate.artEstimate} />
        )}
        {!row.estimate && rate.source === "none" && (
          <p className="text-meta text-muted-foreground">{t("budgeting.art.schaetzenDarf")}</p>
        )}
      </div>
      <div className="space-y-3">
        {rate.caveats.length > 0 && (
          <>
            <h3 className="text-sm font-semibold">
              {t("budgeting.kpi.vorbehalte", { count: rate.caveats.length })}
            </h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-warning">
              {rate.caveats.map((c) => (
                <li key={c.code}>{t(`budgeting.rateCaveat.${c.code}`, c.values)}</li>
              ))}
            </ul>
          </>
        )}
        {suspicion && ratio != null && dev != null && (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            {t(
              suspicion.direction === "high"
                ? "budgeting.kpi.pruefenHoch"
                : "budgeting.kpi.pruefenNiedrig",
              { coverage: pct(ratio, locale), deviation: signedPct(dev, locale) },
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** Woher der Satz kommt — ein Satz, die Texte der bisherigen Herleitung. */
function RateSentence({ rate }: { rate: JobSizeRate }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const kopf =
    rate.rate == null
      ? t("budgeting.art.keinSatzJeJobSize")
      : rate.source === "artEstimate"
        ? t("budgeting.art.geschaetzterSatz", { rate: formatEUR(rate.rate, locale) })
        : t("budgeting.art.satzJeJobSize", { rate: formatEUR(rate.rate, locale) });
  return (
    <p className="text-sm text-muted-foreground">
      <strong className="font-semibold text-foreground">{kopf}</strong>{" "}
      {rate.source === "empirical" ? (
        <>
          {t("budgeting.art.durchschnittBudgetAusHistorie", {
            cycles: new Intl.ListFormat(locale, { type: "conjunction" }).format(
              rate.cycles.map((c) => halfYearLabel(c.cycleKey)),
            ),
            budget: formatEUR(rate.budgetSum, locale),
            jobSize: rate.jobSizeSum,
            count: rate.featureCount,
          })}
          {rate.standaloneFeatureCount > 0 && (
            <>
              {" "}
              {t("budgeting.art.davonPunkteAusEigenstaendigen", {
                points: rate.standaloneJobSizeSum,
                count: rate.standaloneFeatureCount,
              })}
            </>
          )}
          {rate.artEstimate != null && (
            <>
              {" "}
              {t("budgeting.art.schaetzungNichtMehrNoetig", {
                rate: formatEUR(rate.artEstimate, locale),
              })}
            </>
          )}
        </>
      ) : rate.source === "artEstimate" ? (
        t("budgeting.art.schaetzungFuerDiesenArt")
      ) : (
        t("budgeting.art.wederAusDerHistorie")
      )}
    </p>
  );
}

/** Die Halbjahre, aus denen der Satz stammt — ein leeres Halbjahr fällt sofort auf. */
function RateCycles({ rate }: { rate: JobSizeRate }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const cycles = [...rate.cycles].sort((a, b) => a.cycleKey.localeCompare(b.cycleKey));
  return (
    <table className="w-full max-w-md text-sm tabular-nums" data-kpi="rate-cycles">
      <thead className="text-left text-label text-muted-foreground">
        <tr className="border-b">
          <th className="py-1.5 pr-3 font-medium">{t("budgeting.kpi.spalteHalbjahr")}</th>
          <th className="py-1.5 pr-3 text-right font-medium">{t("budgeting.kpi.spalteBudget")}</th>
          <th className="py-1.5 pr-3 text-right font-medium">
            {t("budgeting.kpi.spalteFertigJs")}
          </th>
          <th className="py-1.5 text-right font-medium">{t("budgeting.kpi.spalteFeatures")}</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {cycles.map((c) => (
          <tr key={c.cycleKey}>
            <td className="py-1.5 pr-3">{halfYearLabel(c.cycleKey)}</td>
            <td className="py-1.5 pr-3 text-right">{formatEUR(c.budget, locale)}</td>
            <td
              className={`py-1.5 pr-3 text-right ${c.jobSize === 0 ? "font-semibold text-destructive" : ""}`}
            >
              {c.jobSize}
            </td>
            <td className="py-1.5 text-right">{c.featureCount}</td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td className="py-1.5 pr-3">Σ</td>
          <td className="py-1.5 pr-3 text-right">{formatEUR(rate.budgetSum, locale)}</td>
          <td className="py-1.5 pr-3 text-right">{rate.jobSizeSum}</td>
          <td className="py-1.5 text-right">{rate.featureCount}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Karte „Lieferung"
// ---------------------------------------------------------------------------

export interface DeliveryRow {
  /** `null` = die Σ-Zeile. */
  artId: string | null;
  name: string;
  burn: JobSizeBurn | null;
  href: string;
}

/**
 * **Ein Diagramm, eine Tabelle.** Das Diagramm zeigt die gewählte Zeile
 * (`?kpiArt=`), die Tabelle alle — ein ART ohne Plan steht mit Grund da, statt
 * still zu fehlen.
 */
export function DeliveryCard({
  rows,
  selected,
}: {
  rows: readonly DeliveryRow[];
  /** Die Zeile, deren Verlauf das Diagramm zeigt. */
  selected: DeliveryRow;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const js = (n: number | null) => (n == null ? "—" : formatDecimal(n, 0, locale));
  const kachel = rows.find((r) => r.burn)?.burn ?? null;

  return (
    <SectionCard
      title={t("budgeting.kpi.lieferungKarteTitel")}
      description={
        kachel
          ? t("budgeting.kpi.kachelZeitraum", {
              kachel: halfYearLabel(kachel.cycleKey),
              von: formatDate(kachel.start, "date", locale),
              bis: formatDate(lastDay(kachel.end), "date", locale),
            })
          : t("budgeting.kpi.keinPlanKeineKachel")
      }
      contentClassName="space-y-3"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" data-kpi="lieferung">
        <div className="space-y-1">
          <p className="text-meta font-medium text-muted-foreground">{selected.name}</p>
          <JobSizeBurnChart burn={selected.burn} bare />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-label text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-3 font-medium">{t("budgeting.kpi.spalteArt")}</th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t("budgeting.kpi.spalteErwartet")}
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t("budgeting.kpi.spaltePlanHeute")}
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t("budgeting.kpi.spalteIst")}
                </th>
                <th className="py-1.5 font-medium">{t("budgeting.kpi.spalteAbweichung")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const status = burnStatus(r.burn);
                const aktiv = r.artId === selected.artId;
                const grund =
                  status !== "none"
                    ? null
                    : r.burn == null
                      ? t("budgeting.kpi.chipKeinPlan")
                      : r.burn.reason === "noRate"
                        ? t("budgeting.kpi.quelleKeiner")
                        : r.burn.reason === "noBudget"
                          ? t("budgeting.kpi.grundKeinBudget")
                          : t("budgeting.kpi.chipKeinPlan");
                return (
                  <tr
                    key={r.artId ?? "summe"}
                    className={`${aktiv ? "bg-primary/5" : ""} ${r.artId == null ? "font-semibold" : ""}`}
                    data-row={r.artId ?? "summe"}
                    aria-current={aktiv ? "true" : undefined}
                  >
                    <td className="py-2 pr-3">
                      <Link href={r.href as never} scroll={false} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-right">{js(r.burn?.expected ?? null)}</td>
                    <td className="py-2 pr-3 text-right">{js(r.burn?.planToday ?? null)}</td>
                    <td className="py-2 pr-3 text-right">{js(r.burn?.actualToday ?? null)}</td>
                    <td className="py-2">
                      {grund ? (
                        <Pill tone="neutral">{grund}</Pill>
                      ) : (
                        <Pill tone={BURN_TONE[status]}>
                          {t(BURN_KEY[status])}
                          {r.burn?.deviation != null && <> {signedPct(r.burn.deviation, locale)}</>}
                        </Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-meta text-muted-foreground">{t("budgeting.kpi.zeileWaehlt")}</p>
        </div>
      </div>
    </SectionCard>
  );
}
