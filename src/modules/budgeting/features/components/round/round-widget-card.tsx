import { Link } from "@/i18n/navigation";
import { formatEUR } from "@/lib/formatting";
import type { RoundWidget } from "@/modules/budgeting/server/views/round-widget";

const STATUS_TONE: Record<RoundWidget["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  decided: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
};

/**
 * Controlling-Karte der aktiven PB-Runde: Status, Gruppen, Ballot- und
 * Entscheidungs-Fortschritt und (nach dem Schließen) die Reserve — plus ein
 * Deep-Link in die geführte Runde. Rein präsentational.
 */
export function RoundWidgetCard({ widget }: { widget: RoundWidget }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Budget-Runde {widget.cycleKey}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[widget.status]}`}>
            {widget.statusLabel}
          </span>
        </div>
        <Link href={widget.href} className="text-sm font-medium text-primary hover:underline">
          Zur Runde →
        </Link>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
        <Stat label="Topf" value={formatEUR(widget.poolTotal)} />
        <Stat label="Gruppen" value={String(widget.groupCount)} />
        <Stat
          label="Entscheidungen"
          value={`${widget.decidedCount} / ${widget.ballotCount}`}
        />
        <Stat
          label="Reserve"
          value={widget.reserve != null ? formatEUR(widget.reserve) : "—"}
        />
      </dl>

      {widget.ballotCount > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(widget.decidedFraction * 100)}%` }}
          />
        </div>
      )}
    </div>
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
