import { Link } from "@/i18n/navigation";
import { ArrowRight, TrendingUp, Target } from "lucide-react";
import type { ArtHistoryPi } from "@/server/views/art-hub";

interface Props {
  history: ArtHistoryPi[];
}

/**
 * PI-Historie-Tab im ART-Hub. Listet abgeschlossene PIs neueste zuerst,
 * mit Predictability (Features completed / total) und
 * Confidence-Avg ueber die committed Objectives. Jede Zeile springt
 * zum PI-Workspace (Closure-Tab als Default-Ankerpunkt).
 */
export function ArtHistoryTab({ history }: Props) {
  if (history.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Noch keine abgeschlossenen PIs an diesem ART. Sobald ein PI ueber den Closure-Wizard auf
          „completed" gesetzt wird, erscheint hier sein Predictability-Snapshot.
        </p>
      </section>
    );
  }
  // Sortiert: neueste (= spaetes Enddatum) zuerst.
  const sorted = [...history].sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
  const trendValues = sorted.map((p) => p.predictability).filter((v): v is number => v != null);
  const trend =
    trendValues.length > 0 ? trendValues.reduce((s, v) => s + v, 0) / trendValues.length : null;
  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-muted/20 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="mr-1 inline-block size-3.5 align-text-bottom" />
          Trend ueber {trendValues.length} PIs
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {trend != null ? `${Math.round(trend * 100)} %` : "—"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Mittel der Predictability — completed/total Features pro PI.
        </p>
      </section>

      <ul className="space-y-2">
        {sorted.map((pi) => (
          <li key={pi.id}>
            <Link
              href={`/umsetzung/pi/${pi.id}` as never}
              className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/40"
            >
              <span className="font-medium">{pi.name}</span>
              <span className="text-xs text-muted-foreground">
                {pi.startDate.toLocaleDateString("de-DE")} –{" "}
                {pi.endDate.toLocaleDateString("de-DE")}
              </span>
              {pi.predictability != null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                  <TrendingUp className="size-3" />
                  {Math.round(pi.predictability * 100)} %
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  Predictability —
                </span>
              )}
              {pi.confidenceAvg != null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">
                  <Target className="size-3" />
                  Confidence {pi.confidenceAvg.toFixed(1)}
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  Confidence —
                </span>
              )}
              <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
