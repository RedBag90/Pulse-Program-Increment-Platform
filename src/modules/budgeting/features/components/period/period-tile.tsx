import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatEUR } from "@/lib/formatting";
import type { Locale } from "@/i18n/routing";
import { periodName } from "@/modules/budgeting/features/components/period/period-name";
import type { PeriodTile } from "@/modules/budgeting/server/views/periods-gallery";

/** Die **Geltung** trägt die Kachel — sie ist die Hauptaussage. */
const VALIDITY_TONE: Record<string, string> = {
  applied: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
  in_preparation: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  expired: "bg-muted text-muted-foreground",
};

/** Der Prozess-Status steht daneben — er sagt, wie weit die Vorbereitung ist. */
const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  running: "Verteilung läuft",
  decided: "entschieden",
  closed: "finalisiert",
};

/**
 * Kachel eines Budgeting-Zeitraums. Zuoberst die **Geltung** („Angewandtes
 * Budget" · „In Ausarbeitung" · „Abgelaufener Budget-Zeitraum"), daneben der
 * Vorbereitungs-Stand. `muted` dämpft abgelaufene Kacheln. Rein präsentational.
 *
 * Die beiden Achsen liefen bis September 2026 zusammen: die Kachel trug nur den
 * Prozess-Status, und „abgeschlossen" hiess sowohl „fertig ausgearbeitet" als
 * auch „vorbei". Es ist aber das Gegenteil — fertig ausgearbeitet ist der
 * Moment, in dem ein Budget zu **gelten** beginnt.
 */
export function PeriodTileCard({ tile, muted }: { tile: PeriodTile; muted?: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const frac = tile.groupCount > 0 ? tile.submittedCount / tile.groupCount : 0;

  return (
    <Link
      href={tile.href}
      className={`block rounded-lg bg-card shadow-card p-4 transition-colors hover:bg-muted/40 ${
        muted ? "opacity-60 hover:opacity-100" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Der Name **ist** der Zeitraum — siehe `periodName`. Die eigene
            „Zeitraum"-Kachel darunter ist damit entfallen: sie hätte die
            Überschrift wortgleich wiederholt. */}
        <h3 className="text-sm font-semibold">
          {periodName(tile.startDate, tile.endDate, tile.label, locale)}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${VALIDITY_TONE[tile.validity] ?? "bg-muted"}`}
          >
            {t(tile.validityLabelKey)}
          </span>
          {tile.extended && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              {t("budgeting.period.verlaengert")}
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {STATUS_LABEL[tile.status] ?? tile.status}
          </span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <Stat label={t("budgeting.period.topf")} value={formatEUR(tile.poolTotal)} />
        <Stat
          label={t("budgeting.period.gruppen")}
          value={`${tile.groupCount} · ${tile.participantCount} Beteiligte`}
        />
        <Stat
          label={t("budgeting.period.abgegeben")}
          value={`${tile.submittedCount} / ${tile.groupCount}`}
        />
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">{tile.phase}</p>

      {tile.groupCount > 0 && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round(frac * 100)}%` }}
          />
        </div>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
