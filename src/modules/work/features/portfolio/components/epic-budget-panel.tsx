import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { formatCompactEUR } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import type {
  EpicAllocationStateView,
  EpicBudgetStandingView,
} from "@/modules/work/server/views/epic-detail";

/**
 * **Habe ich Geld — und für wann?**
 *
 * Die Frage stand schon einmal auf dieser Seite und verschwand beim Umbau auf
 * die Bauteil-Bibliothek: die `Stat`-Kachel in „Wirtschaftlichkeit" trägt einen
 * Betrag und **eine** Zeile, und in diese eine Zeile passte der Zeitraum nicht
 * mehr. Übrig blieb „zugeteilt, gilt später" — ein Zeitbezug ohne Zeit.
 *
 * Deshalb ein eigenes Panel. Es steht neben „Zeitfenster", und das ist Absicht:
 * die beiden Zeiträume heißen fast gleich und meinen Verschiedenes — dort das
 * **Liefer**fenster (L4.1 → L4.2, ADR-0019), hier die **Geltung des Budgets**.
 * Nebeneinander lassen sie sich vergleichen; das ist die eigentliche Frage
 * („reicht mein Geld über meine Umsetzung?").
 *
 * Alles, was hier steht, wird längst berechnet: `currentPeriod`, `startsAt`,
 * `span` und `periods` kommen aus `epicBudgetStanding` und reisen durch den
 * Budget-Port. Work importiert nichts aus Budgeting (ADR-0013) — auch die
 * Beschriftung des Zustands reist als Wert mit.
 */
const fmtDay = (d: Date, locale: Locale): string =>
  d.toLocaleDateString(locale === "en" ? "en-GB" : "de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const fmtSpan = (start: Date | null, end: Date | null, locale: Locale): string | null =>
  start && end ? `${fmtDay(start, locale)} – ${fmtDay(end, locale)}` : null;

export function EpicBudgetPanel({
  standing,
  allocationState,
  fundable,
}: {
  standing: EpicBudgetStandingView | null;
  /** „Nicht begonnen" · „Gebunden" · „Verbraucht" — `null` ohne Zuteilung. */
  allocationState: EpicAllocationStateView | null;
  fundable: { may: boolean; firstStep: string };
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  // Kein Geld: erklären statt nur melden. Vor L2 *kann* keines da sein — das
  // ist eine andere Aussage als „es wurde keines zugeteilt".
  if (standing == null || standing.state === "none") {
    return (
      <div className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums text-muted-foreground">—</p>
        <p className="text-sm text-muted-foreground">
          {!fundable.may && fundable.firstStep !== ""
            ? t("work.epic.budgetErstAbStufe", { step: fundable.firstStep })
            : t("work.epic.keinBudgetZugeteilt")}
        </p>
      </div>
    );
  }

  const applies = standing.state === "applies";
  const headline = applies ? standing.currentAmount : standing.totalAmount;
  const currentSpan = fmtSpan(
    standing.currentPeriod?.start ?? null,
    standing.currentPeriod?.end ?? null,
    locale,
  );
  const totalSpan = fmtSpan(standing.span?.start ?? null, standing.span?.end ?? null, locale);

  // Der Geltungssatz — er stand vor dem Umbau schon hier und ist der Kern der
  // Frage. Bei `upcoming` trägt er das Datum, nicht nur das Wort „später".
  const validity =
    standing.state === "applies"
      ? t("work.epic.budgetGiltJetzt")
      : standing.state === "upcoming"
        ? standing.startsAt != null
          ? t("work.epic.budgetZugeteiltGiltAb", { date: fmtDay(standing.startsAt, locale) })
          : t("work.epic.budgetZugeteiltRahmenInArbeit")
        : t("work.epic.budgetRahmenAbgelaufen");

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p className="text-2xl font-semibold tabular-nums">{formatCompactEUR(headline, locale)}</p>
        <p className="text-sm text-muted-foreground">
          {validity}
          {applies && currentSpan != null ? (
            <>
              {" · "}
              <span className="tabular-nums">{currentSpan}</span>
            </>
          ) : null}
          {!applies && totalSpan != null ? (
            <>
              {" · "}
              <span className="tabular-nums">{totalSpan}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {allocationState != null && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-meta font-medium text-muted-foreground">
            {allocationState.label}
          </span>
        )}
        {applies && standing.cycleCount > 1 && (
          <span className="text-meta text-muted-foreground">
            {t("work.epic.budgetGesamtUeberZeitraeume", {
              amount: formatCompactEUR(standing.totalAmount, locale),
              count: standing.cycleCount,
            })}
          </span>
        )}
      </div>

      {standing.periods.length > 0 && (
        <table className="w-full text-sm">
          <caption className="sr-only">{t("work.epic.zuteilungJeBudgetZeitraum")}</caption>
          <thead>
            <tr className="border-b text-label uppercase tracking-[0.1em] text-muted-foreground">
              <th className="py-1 text-left font-semibold">{t("work.epic.zeitraum")}</th>
              <th className="py-1 text-left font-semibold">{t("work.epic.geltung")}</th>
              <th className="py-1 text-right font-semibold">{t("work.epic.betrag")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {standing.periods.map((p) => (
              <tr key={p.cycleKey} className={p.applies ? "font-medium" : undefined}>
                <td className="py-1">{halfYearLabel(p.cycleKey)}</td>
                <td className="py-1 text-meta tabular-nums text-muted-foreground">
                  {fmtSpan(p.start, p.end, locale) ?? "—"}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatCompactEUR(p.amount, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
