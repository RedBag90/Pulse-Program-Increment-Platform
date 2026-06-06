import { Link } from "@/i18n/navigation";
import type { RteEpicRollupRow } from "@/server/views/rte-cockpit";

interface Props {
  rows: RteEpicRollupRow[];
}

const SIGNAL_DOT: Record<RteEpicRollupRow["hypothesisSignal"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  muted: "bg-muted-foreground/30",
};

const SIGNAL_LABEL: Record<RteEpicRollupRow["hypothesisSignal"], string> = {
  green: "Hypothese OK",
  amber: "Hypothese in Klärung",
  red: "Hypothese rot / Blocker",
  muted: "—",
};

const FEATURE_STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_review: "bg-blue-400",
  approved: "bg-emerald-400",
  in_progress: "bg-primary",
  blocked: "bg-red-400",
  completed: "bg-emerald-500",
  cancelled: "bg-muted-foreground/20",
};

/**
 * Epic→Feature Rollup für die aktive PI. Eine Karte pro Epic mit
 * Hypothesen-Signal und einer kompakten Feature-Liste (Status-Dot ·
 * Titel).
 */
export function RteEpicRollup({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Keine Epics in der aktiven PI.
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Epics in der aktiven PI
        </h2>
        <span className="text-xs text-muted-foreground">{rows.length} Epics</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((e) => (
          <article key={e.epicId} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={e.href}
                className="font-medium text-primary hover:underline"
                title={e.title}
              >
                {e.title}
              </Link>
              <span
                title={SIGNAL_LABEL[e.hypothesisSignal]}
                className={`size-2.5 shrink-0 rounded-full ${SIGNAL_DOT[e.hypothesisSignal]}`}
              />
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              {e.features.length} Feature(s) in der PI
            </p>
            <ul className="mt-2 space-y-1">
              {e.features.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`size-1.5 rounded-full ${FEATURE_STATUS_DOT[f.status] ?? "bg-muted-foreground/40"}`}
                  />
                  <span className="truncate" title={f.title}>
                    {f.title}
                  </span>
                </li>
              ))}
              {e.features.length > 5 && (
                <li className="text-[11px] text-muted-foreground">
                  + {e.features.length - 5} weitere
                </li>
              )}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
