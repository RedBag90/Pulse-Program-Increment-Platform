import { Link } from "@/i18n/navigation";
import { formatEUR } from "@/lib/formatting";
import type { PeriodTile } from "@/modules/budgeting/server/views/periods-gallery";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  decided: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  running: "läuft",
  decided: "entschieden",
  closed: "abgeschlossen",
};

const day = (d: Date | null): string =>
  d ? d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/**
 * Kachel eines Budgeting-Zeitraums: Status-Pill (+ „geplant" für Zukunfts-
 * Zeiträume), Kennzahlen, die **Phase** und ein Abgabe-Fortschrittsbalken.
 * `muted` dämpft abgeschlossene Kacheln. Rein präsentational.
 *
 * Die Phase steht neben dem Status, weil „läuft" nicht sagt, ob gerade verteilt
 * oder schon finalisiert wird.
 */
export function PeriodTileCard({ tile, muted }: { tile: PeriodTile; muted?: boolean }) {
  const frac = tile.groupCount > 0 ? tile.submittedCount / tile.groupCount : 0;

  return (
    <Link
      href={tile.href}
      className={`block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40 ${
        muted ? "opacity-60 hover:opacity-100" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{tile.label}</h3>
        <div className="flex items-center gap-1.5">
          {tile.upcoming && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/60 dark:text-violet-200">
              geplant
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[tile.status] ?? "bg-muted"}`}
          >
            {STATUS_LABEL[tile.status] ?? tile.status}
          </span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <Stat label="Topf" value={formatEUR(tile.poolTotal)} />
        <Stat label="Zeitraum" value={`${day(tile.startDate)} – ${day(tile.endDate)}`} />
        <Stat label="Gruppen" value={`${tile.groupCount} · ${tile.participantCount} Beteiligte`} />
        <Stat label="Abgegeben" value={`${tile.submittedCount} / ${tile.groupCount}`} />
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
