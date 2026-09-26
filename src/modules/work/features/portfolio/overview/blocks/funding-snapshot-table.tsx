import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { formatScaledEUR } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import type {
  PortfolioOverview,
  ValueStreamChangeRow,
} from "@/modules/work/server/views/portfolio-overview";

/**
 * **Funding-Snapshot — das Veränderungsgeld je Wertstrom in der geltenden
 * Budget-Kachel.**
 *
 * Bis September 2026 stand hier eine einzige Zahl je Wertstrom: die
 * Portfolio-Epic-Finals, summiert über **alle** Halbjahre. Der ART-Rahmen
 * fehlte ganz. Jetzt ist die Summe Portfolio-Epics **plus** ART-Rahmen, und
 * der Rahmen ist so aufgeteilt wie die Gruppe „Veränderung" der
 * ART-Budget-Übersicht: an ART-Epics, für ART-eigene Arbeit, noch nicht
 * vergeben. Der offene Teil ist hell und gestreift — Geld, über das der RTE
 * noch entscheidet.
 *
 * Betrieb gehört nicht hinein (REQ-10). Farbe steht nie allein (ADR-0021):
 * die Legende nennt jedes Segment, die Zeile darunter die Beträge.
 */

type Segment = "portfolio" | "toEpics" | "toOwnWork" | "open";

const SEGMENTS: { key: Segment; labelKey: string; className: string }[] = [
  { key: "portfolio", labelKey: "work.overview.snapshotPortfolio", className: "bg-primary" },
  { key: "toEpics", labelKey: "work.overview.snapshotArtEpics", className: "bg-primary/60" },
  { key: "toOwnWork", labelKey: "work.overview.snapshotArtEigen", className: "bg-primary/35" },
  {
    key: "open",
    labelKey: "work.overview.snapshotArtOffen",
    className: "bg-[repeating-linear-gradient(135deg,var(--muted)_0_4px,var(--border)_4px_8px)]",
  },
];

/** Die vier Beträge eines Wertstroms — die Form des Snapshots. */
export type FundingRow = Pick<ValueStreamChangeRow, "portfolio" | "toEpics" | "toOwnWork" | "open">;

export const summe = (r: FundingRow) => r.portfolio + r.toEpics + r.toOwnWork + r.open;

/** Die Legende der vier Segmente — einmal über der Liste. */
export function FundingLegend() {
  const t = useTranslations();
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-meta text-muted-foreground">
      {SEGMENTS.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block size-2.5 rounded-sm ${s.className}`} />
          {t(s.labelKey)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Der gestapelte Balken eines Wertstroms und darunter die Zeile mit den
 * Beträgen. Die Breite ist relativ zu `max`, dem größten Wertstrom der Liste.
 * Auch die Wertstrom-Liste des Budgetings zeigt ihn (über den App-Baum).
 */
export function FundingBar({ row, max }: { row: FundingRow; max: number }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const eur = (n: number) => formatScaledEUR(n, locale);
  const gesamt = summe(row);
  const rahmen = row.toEpics + row.toOwnWork + row.open;
  return (
    <div className="space-y-1">
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        style={{ width: `${(Math.max(gesamt, 0) / Math.max(max, 1)) * 100}%` }}
      >
        {SEGMENTS.map((s) => {
          // Ein negativer Rest (gekürzter Rahmen) hat keine Breite;
          // er steht in der Zeile darunter als Zahl.
          const wert = Math.max(0, row[s.key]);
          if (wert === 0) return null;
          return (
            <div
              key={s.key}
              data-segment={s.key}
              className={`h-full ${s.className}`}
              style={{ width: `${(wert / Math.max(gesamt, 1)) * 100}%` }}
            />
          );
        })}
      </div>
      <p className="text-meta text-muted-foreground">
        {t("work.overview.snapshotZeile", {
          portfolio: eur(row.portfolio),
          rahmen: eur(rahmen),
          offen: eur(row.open),
        })}
      </p>
    </div>
  );
}

export function FundingSnapshotTable({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const eur = (n: number) => formatScaledEUR(n, locale);
  const kachel = data.budgetCycleKey ? halfYearLabel(data.budgetCycleKey) : null;
  const titel = kachel
    ? t("work.overview.fundingSnapshotKachel", { kachel })
    : t("work.overview.fundingSnapshot");

  if (data.changeBudgets.length === 0) {
    return (
      <Card className="h-full space-y-2 p-4">
        <SectionLabel>{titel}</SectionLabel>
        <p className="text-sm text-muted-foreground">
          {t("work.overview.noBudgetsDistributed")}{" "}
          <Link href="/budgeting/periods" className="text-primary hover:underline">
            {t("work.overview.budgetingOeffnen")}
          </Link>
        </p>
      </Card>
    );
  }

  const ranked = [...data.changeBudgets].sort((a, b) => summe(b) - summe(a));
  const max = Math.max(...ranked.map(summe), 1);

  return (
    <Card className="h-full space-y-3 p-4">
      <SectionLabel>{titel}</SectionLabel>
      <FundingLegend />
      <ul className="space-y-3">
        {ranked.map((r) => (
          <li key={r.valueStreamId} className="space-y-1" data-vs={r.valueStreamId}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium">{r.name}</span>
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {eur(summe(r))}
              </span>
            </div>
            <FundingBar row={r} max={max} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
