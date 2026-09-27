import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatDecimal } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { BURN_BAND, type JobSizeBurn } from "@/modules/budgeting/domain/job-size-burn";

/**
 * **Job Size: Plan gegen Ist** — ein kleines Liniendiagramm über das gewählte
 * Halbjahr.
 *
 * - Plan: 0 am Anfang bis zur erwarteten Job Size am Ende (Budget ÷ Satz),
 *   durchgezogen.
 * - Band: +20 % und −20 % um den Plan, gestrichelt, die Fläche dazwischen
 *   leicht getönt — Job-Size-Rechnungen sind keine Wissenschaft.
 * - Ist: die fertig gemeldeten Features als Stufen bis heute, mit Endpunkt.
 * - Heute: eine senkrechte Linie.
 *
 * SVG und serverseitig, wie `Sparkline`: für eine Karte ist eine
 * Chart-Bibliothek Umweg statt Hilfe. Farbe steht nie allein (ADR-0021): die
 * Legende nennt jede Linie, die Kopfzeile sagt die Abweichung in Worten.
 */

const W = 320;
const H = 160;
// Oben Platz für die Beschriftung „heute" über dem höchsten Punkt.
const PAD = { left: 34, right: 10, top: 20, bottom: 22 };

/**
 * Ohne geltende Budget-Kachel gibt es kein Fenster — dann steht das da, statt
 * eines Diagramms über einen erfundenen Zeitraum.
 */
export function JobSizeBurnChart({ burn }: { burn: JobSizeBurn | null }) {
  const t = useTranslations();
  if (burn == null) {
    return (
      <section className="space-y-1 rounded-md border p-3" aria-label={t("budgeting.burn.titel")}>
        <h3 className="text-sm font-medium">{t("budgeting.burn.titel")}</h3>
        <p className="text-sm text-muted-foreground">{t("budgeting.burn.keineKachel")}</p>
      </section>
    );
  }
  return <BurnChart burn={burn} />;
}

function BurnChart({ burn }: { burn: JobSizeBurn }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const js = (n: number) => formatDecimal(n, 0, locale);

  const t0 = burn.start.getTime();
  const t1 = burn.end.getTime();
  const oben = burn.expected == null ? 0 : burn.expected * (1 + BURN_BAND);
  const yMax = Math.max(oben, burn.actualToday, 1);

  const x = (at: Date | number) => {
    const ms = typeof at === "number" ? at : at.getTime();
    const f = Math.min(1, Math.max(0, (ms - t0) / (t1 - t0)));
    return PAD.left + f * (W - PAD.left - PAD.right);
  };
  const y = (v: number) => H - PAD.bottom - (v / yMax) * (H - PAD.top - PAD.bottom);
  const p = (px: number, py: number) => `${px.toFixed(1)},${py.toFixed(1)}`;

  const heuteSichtbar = burn.today.getTime() > t0 && burn.today.getTime() < t1;
  const begonnen = burn.today.getTime() > t0;

  // Ist als Stufen: waagrecht bis zum nächsten Abschluss, dann senkrecht hoch.
  const stufen = burn.actual
    .map((pt, i) => {
      const px = x(pt.at);
      const py = y(pt.cumulative);
      if (i === 0) return `M${p(px, py)}`;
      return `H${px.toFixed(1)} V${py.toFixed(1)}`;
    })
    .join(" ");
  const ende = burn.actual[burn.actual.length - 1];

  const kopf = (() => {
    if (burn.reason === "noRate") {
      return t("budgeting.burn.ohneSatz", { actual: js(burn.actualToday) });
    }
    if (burn.reason === "noBudget" || burn.expected == null) {
      return t("budgeting.burn.ohneBudgetKachel", { actual: js(burn.actualToday) });
    }
    if (!begonnen) {
      return t("budgeting.burn.nochNichtBegonnen", { expected: js(burn.expected) });
    }
    const lage =
      burn.withinBand == null
        ? ""
        : burn.withinBand
          ? t("budgeting.burn.imBand")
          : (burn.deviation ?? 0) < 0
            ? t("budgeting.burn.unterPlan")
            : t("budgeting.burn.ueberPlan");
    return t("budgeting.burn.kopf", {
      actual: js(burn.actualToday),
      plan: js(burn.planToday ?? 0),
      deviation:
        burn.deviation == null
          ? "—"
          : `${burn.deviation > 0 ? "+" : ""}${formatDecimal(burn.deviation * 100, 0, locale)} %`,
      lage,
    });
  })();

  return (
    <section className="space-y-2 rounded-md border p-3" aria-label={t("budgeting.burn.titel")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <h3 className="text-sm font-medium">{t("budgeting.burn.titel")}</h3>
          {/* Die Kachel, nicht das Halbjahr des Umschalters: das Diagramm folgt
              immer der laufenden Budget-Kachel. */}
          <p className="text-meta text-muted-foreground">
            {t("budgeting.burn.kachel", {
              kachel: halfYearLabel(burn.cycleKey),
              von: formatDate(burn.start, "date", locale),
              bis: formatDate(new Date(burn.end.getTime() - 86_400_000), "date", locale),
            })}
            {burn.extended && <> · {t("budgeting.burn.giltFort")}</>}
          </p>
        </div>
        {burn.expected != null && (
          <p className="text-meta text-muted-foreground">
            {t("budgeting.burn.erwartet", { expected: js(burn.expected) })}
          </p>
        )}
      </div>
      <p
        className={`text-sm ${
          burn.withinBand === false ? "font-medium text-warning" : "text-muted-foreground"
        }`}
      >
        {kopf}
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-w-md"
        role="img"
        aria-label={kopf}
      >
        {/* Achsen */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
          className="stroke-border"
          strokeWidth={1}
        />
        <text
          x={PAD.left - 4}
          y={y(0)}
          textAnchor="end"
          dominantBaseline="middle"
          className="fill-muted-foreground text-label"
        >
          0
        </text>

        {burn.expected != null && (
          <>
            {/* Band ±20 % */}
            <polygon
              points={[
                p(x(t0), y(0)),
                p(x(t1), y(burn.expected * (1 + BURN_BAND))),
                p(x(t1), y(burn.expected * (1 - BURN_BAND))),
              ].join(" ")}
              className="fill-primary/10"
            />
            <line
              data-line="band-oben"
              x1={x(t0)}
              y1={y(0)}
              x2={x(t1)}
              y2={y(burn.expected * (1 + BURN_BAND))}
              className="stroke-muted-foreground"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <line
              data-line="band-unten"
              x1={x(t0)}
              y1={y(0)}
              x2={x(t1)}
              y2={y(burn.expected * (1 - BURN_BAND))}
              className="stroke-muted-foreground"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {/* Plan */}
            <line
              data-line="plan"
              x1={x(t0)}
              y1={y(0)}
              x2={x(t1)}
              y2={y(burn.expected)}
              className="stroke-foreground"
              strokeWidth={1.5}
            />
            <text
              x={PAD.left - 4}
              y={y(burn.expected)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-label"
            >
              {js(burn.expected)}
            </text>
          </>
        )}

        {/* Heute */}
        {heuteSichtbar && (
          <>
            <line
              data-line="heute"
              x1={x(burn.today)}
              x2={x(burn.today)}
              y1={PAD.top}
              y2={y(0)}
              className="stroke-muted-foreground"
              strokeWidth={1}
              strokeDasharray="1 2"
            />
            <text
              x={x(burn.today)}
              y={PAD.top - 2}
              textAnchor="middle"
              className="fill-muted-foreground text-label"
            >
              {t("budgeting.burn.heute")}
            </text>
          </>
        )}

        {/* Ist */}
        {begonnen && (
          <>
            <path
              data-line="ist"
              d={stufen}
              fill="none"
              className="stroke-primary"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {ende && (
              <circle cx={x(ende.at)} cy={y(ende.cumulative)} r={3} className="fill-primary" />
            )}
          </>
        )}

        {/* Zeitachse */}
        <text x={x(t0)} y={H - 6} className="fill-muted-foreground text-label">
          {formatDate(burn.start, "date", locale)}
        </text>
        <text x={x(t1)} y={H - 6} textAnchor="end" className="fill-muted-foreground text-label">
          {formatDate(new Date(t1 - 86_400_000), "date", locale)}
        </text>
      </svg>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted-foreground">
        {burn.expected != null && (
          <>
            <li className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line
                  x1="0"
                  y1="3"
                  x2="18"
                  y2="3"
                  className="stroke-foreground"
                  strokeWidth={1.5}
                />
              </svg>
              {t("budgeting.burn.legendePlan")}
            </li>
            <li className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line
                  x1="0"
                  y1="3"
                  x2="18"
                  y2="3"
                  className="stroke-muted-foreground"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              </svg>
              {t("budgeting.burn.legendeBand")}
            </li>
          </>
        )}
        <li className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" y1="3" x2="18" y2="3" className="stroke-primary" strokeWidth={2} />
          </svg>
          {t("budgeting.burn.legendeIst")}
        </li>
      </ul>
    </section>
  );
}
