import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatDecimal } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { Sparkline } from "@/components/charts/sparkline";
import { Card } from "@/components/ui/card";
import {
  windowKeysOf,
  type VelocityRow,
  type VelocityWindow,
} from "@/modules/drumbeat/domain/pi-velocity";

/**
 * **PI-Velocity als Tabelle mit Trendlinie** — für den Reiter „Budget-KPIs",
 * je ART und für den Wertstrom.
 *
 * Die Zeilen sind die PIs, die im Fenster endeten (zwei Halbjahre vor dem
 * gewählten, wie beim €-Satz). Ein PI, der nicht zählt, bleibt stehen —
 * gedämpft und mit Grund: verschwände er, sähe das Fenster voller aus, als
 * es ist.
 *
 * Die Kopfzahl ist beim ART der **Ø der PI-Quoten** (wie das Cockpit-Ziel),
 * beim Wertstrom **Σ geliefert ÷ Σ Kapazität**. Das Wort daneben sagt, welche
 * — dieselbe Zahl mit zwei Rechenwegen darf nicht gleich heissen.
 *
 * Σ Business Value und Σ WSJF stehen auf derselben Menge wie „Geliefert":
 * den abgeschlossenen Features des PIs. Sie sind Auskunft, keine Quote.
 */
export function PiVelocityTable({
  rows,
  summary,
  kind,
  window,
}: {
  rows: readonly VelocityRow[];
  /** ART: Ø der Quoten; Wertstrom: Σ ÷ Σ. `null`, wenn kein PI zählt. */
  summary: number | null;
  kind: "art" | "stream";
  /** Das Fenster — für Kopf und leeren Zustand. */
  window: VelocityWindow;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  // Das laufende Halbjahr sagt dazu, dass nur seine abgeschlossenen PIs zählen.
  const fenster = windowKeysOf(window)
    .map((k) =>
      k === window.runningKey
        ? t("drumbeat.velocity.laufend", { halbjahr: halfYearLabel(k) })
        : halfYearLabel(k),
    )
    .join(" · ");
  const zahl = (n: number | null) => (n == null ? "—" : formatDecimal(n, 1, locale));
  const quoten = rows.flatMap((r) => (r.skip == null && r.ratio != null ? [r.ratio] : []));

  return (
    <section className="space-y-2 rounded-md border p-3" aria-label={t("drumbeat.velocity.titel")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{t("drumbeat.velocity.titel")}</h3>
          <p className="text-meta text-muted-foreground">
            {t("drumbeat.velocity.fenster", { fenster })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Sparkline points={quoten} className="h-8 w-28" label={t("drumbeat.velocity.verlauf")} />
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{zahl(summary)}</p>
            <p className="text-label text-muted-foreground">
              {kind === "art"
                ? t("drumbeat.velocity.mittelDerPis")
                : t("drumbeat.velocity.summeDurchSumme")}
            </p>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("drumbeat.velocity.keinePis", { fenster })}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-meta text-muted-foreground">
              <tr className="border-b">
                <th className="py-1.5 pr-3 font-medium">{t("drumbeat.velocity.pi")}</th>
                <th className="py-1.5 pr-3 font-medium">{t("drumbeat.velocity.ende")}</th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t("drumbeat.velocity.geliefert")}
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t("drumbeat.velocity.businessValue")}
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t("drumbeat.velocity.wsjf")}
                </th>
                <th className="py-1.5 pr-3 text-right font-medium">
                  {t("drumbeat.velocity.kapazitaet")}
                </th>
                <th className="py-1.5 text-right font-medium">
                  {t("drumbeat.velocity.jsJeKapazitaet")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.piId} className={r.skip ? "text-muted-foreground" : undefined}>
                  <td className="py-1.5 pr-3">
                    {r.name}
                    {r.skip && (
                      <span className="ml-2 text-label">
                        {r.skip === "noCapacity"
                          ? t("drumbeat.velocity.ohneKapazitaet")
                          : t("drumbeat.velocity.nichtAbgeschlossen")}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">{formatDate(r.endDate, "date", locale)}</td>
                  <td className="py-1.5 pr-3 text-right">{r.delivered}</td>
                  <td className="py-1.5 pr-3 text-right">{r.businessValue}</td>
                  <td className="py-1.5 pr-3 text-right">{zahl(r.wsjf)}</td>
                  <td className="py-1.5 pr-3 text-right">{zahl(r.capacity)}</td>
                  <td className="py-1.5 text-right">{zahl(r.ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {kind === "stream" && (
        <p className="text-meta text-muted-foreground">{t("drumbeat.velocity.gleicheEinheit")}</p>
      )}
    </section>
  );
}

/**
 * **Die Velocity-Karte der Budget-KPIs** — eine Zeile je ART (und Σ), die
 * PI-Tabelle aufklappbar.
 *
 * Bis September 2026 stand je ART und für den Wertstrom eine volle Tabelle
 * untereinander. Die eine Zahl je ART ist das, was man vergleicht; die PIs
 * dahinter braucht man nur, wenn die Zahl überrascht. „n von m PIs gezählt"
 * sagt, wie belastbar sie ist — ein ART ohne erfasste Kapazität hat keine
 * Velocity, und das steht da, statt einer leeren Tabelle.
 */
export function PiVelocityRows({
  arts,
  stream,
  window,
}: {
  arts: readonly {
    artId: string;
    name: string;
    rows: readonly VelocityRow[];
    mean: number | null;
    countedCount: number;
  }[];
  /** `null` ohne Wertstrom-Recht: dann keine Σ-Zeile. */
  stream: { rows: readonly VelocityRow[]; ratio: number | null; countedCount: number } | null;
  window: VelocityWindow;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const fenster = windowKeysOf(window)
    .map((k) =>
      k === window.runningKey
        ? t("drumbeat.velocity.laufend", { halbjahr: halfYearLabel(k) })
        : halfYearLabel(k),
    )
    .join(" · ");
  const zahl = (n: number | null) => (n == null ? "—" : formatDecimal(n, 1, locale));

  const zeile = (
    key: string,
    name: string,
    rows: readonly VelocityRow[],
    value: number | null,
    counted: number,
    kind: "art" | "stream",
  ) => {
    const quoten = rows.flatMap((r) => (r.skip == null && r.ratio != null ? [r.ratio] : []));
    const ohneKapazitaet = rows.filter((r) => r.skip === "noCapacity").length;
    return (
      <details key={key} className="group/vel border-b last:border-b-0" data-row={key}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 py-2.5 marker:content-[''] hover:bg-muted">
          <span
            className={`min-w-40 flex-1 ${kind === "stream" ? "font-semibold" : "font-medium"}`}
          >
            {name}
          </span>
          <span
            className={`w-14 text-right text-lg tabular-nums ${value == null ? "text-muted-foreground" : "font-semibold"}`}
          >
            {zahl(value)}
          </span>
          <span className="w-28">
            {quoten.length >= 2 ? (
              <Sparkline
                points={quoten}
                className="h-7 w-28"
                label={t("drumbeat.velocity.verlauf")}
              />
            ) : (
              <span className="text-label text-muted-foreground">
                {t("drumbeat.velocity.verlaufAbZwei")}
              </span>
            )}
          </span>
          <span
            className={`min-w-48 flex-1 text-meta ${counted === 0 ? "text-warning" : "text-muted-foreground"}`}
          >
            {t("drumbeat.velocity.gezaehlt", { counted, total: rows.length })}
            {ohneKapazitaet > 0 && (
              <> · {t("drumbeat.velocity.ohneKapazitaetAnzahl", { count: ohneKapazitaet })}</>
            )}
            {kind === "stream" && <> · {t("drumbeat.velocity.gleicheEinheit")}</>}
          </span>
          <span className="text-muted-foreground" aria-hidden>
            <span className="group-open/vel:hidden">▸</span>
            <span className="hidden group-open/vel:inline">▾</span>
          </span>
        </summary>
        <div className="pb-3">
          <PiVelocityTable rows={rows} summary={value} kind={kind} window={window} />
        </div>
      </details>
    );
  };

  return (
    <Card className="gap-2 px-5" aria-label={t("drumbeat.velocity.karteTitel")} data-kpi="velocity">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{t("drumbeat.velocity.karteTitel")}</h2>
        <p className="text-meta text-muted-foreground">
          {t("drumbeat.velocity.fenster", { fenster })}
        </p>
      </div>
      <div className="text-sm">
        {arts.map((a) => zeile(a.artId, a.name, a.rows, a.mean, a.countedCount, "art"))}
        {stream &&
          zeile(
            "summe",
            t("drumbeat.velocity.summeWertstrom"),
            stream.rows,
            stream.ratio,
            stream.countedCount,
            "stream",
          )}
      </div>
    </Card>
  );
}
