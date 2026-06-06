import type { RteTeamRagRow } from "@/server/views/rte-cockpit";

interface Props {
  teams: RteTeamRagRow[];
}

const RAG_DOT: Record<RteTeamRagRow["rag"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  muted: "bg-muted-foreground/30",
};

const RAG_LABEL: Record<RteTeamRagRow["rag"], string> = {
  green: "Grün",
  amber: "Gelb",
  red: "Rot",
  muted: "—",
};

/**
 * Eine Zeile pro Team — Velocity-Sparkline (letzte ≤5 Sprints,
 * delivered story points), Confidence ⌀, offene Impediments, Blocker,
 * Feature-Burnup (completed / inPi). Aggregier-RAG am Anfang.
 */
export function RteTeamRagGrid({ teams }: Props) {
  if (teams.length === 0) {
    return (
      <section className="rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Keine Teams für diesen ART angelegt.
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Teams · RAG
        </h2>
        <span className="text-xs text-muted-foreground">{teams.length} Teams</span>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pl-4 pr-2">Team</th>
              <th className="py-2 pr-3">RAG</th>
              <th className="py-2 pr-3">Velocity-Trend</th>
              <th className="py-2 pr-3 text-right">Confidence</th>
              <th className="py-2 pr-3 text-right">Burnup</th>
              <th className="py-2 pr-4 text-right">Impediments</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.teamId} className="border-b last:border-b-0 align-middle">
                <td className="py-3 pl-4 pr-2 font-medium">{t.teamName}</td>
                <td className="py-3 pr-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={`size-2 rounded-full ${RAG_DOT[t.rag]}`} />
                    <span className="text-muted-foreground">{RAG_LABEL[t.rag]}</span>
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <VelocitySparkline data={t.velocity} />
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">
                  {t.confidence != null ? t.confidence.toFixed(1) : "—"}
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">
                  {t.featureBurnup.inPi === 0
                    ? "—"
                    : `${t.featureBurnup.completed}/${t.featureBurnup.inPi}`}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{t.openImpediments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VelocitySparkline({ data }: { data: RteTeamRagRow["velocity"] }) {
  if (data.length === 0)
    return <span className="text-xs text-muted-foreground">keine Sprints</span>;
  const max = Math.max(...data.map((d) => d.delivered), ...data.map((d) => d.target ?? 0), 1);
  return (
    <div className="flex h-8 items-end gap-1">
      {data.map((d) => {
        const h = Math.round((d.delivered / max) * 28);
        const tone =
          d.target != null && d.delivered >= d.target
            ? "bg-emerald-500"
            : d.target != null && d.delivered < d.target * 0.5
              ? "bg-red-500"
              : "bg-amber-500";
        return (
          <span
            key={d.sprintIndex}
            title={`Sprint ${d.sprintIndex}: ${d.delivered} SP${d.target != null ? ` / Ziel ${d.target}` : ""}`}
            className={`w-2 rounded-sm ${tone}`}
            style={{ height: `${Math.max(h, 2)}px` }}
          />
        );
      })}
    </div>
  );
}
