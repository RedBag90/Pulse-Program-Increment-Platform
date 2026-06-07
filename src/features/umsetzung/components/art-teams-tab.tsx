import { Target, Gauge, AlertTriangle, Network, TrendingUp } from "lucide-react";
import type { RteTeamRagRow, RagTier } from "@/server/views/rte-cockpit";

interface Props {
  teams: RteTeamRagRow[];
}

const RAG_LABEL: Record<RagTier, string> = {
  green: "Grün",
  amber: "Gelb",
  red: "Rot",
  muted: "Keine Signale",
};
const RAG_CLASS: Record<RagTier, string> = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  muted: "bg-muted text-muted-foreground",
};

/**
 * Teams-Tab im ART-Hub. Read-only RAG-Grid wie im RTE-Cockpit:
 * Confidence, Velocity-Trend (delivered ueber letzte ≤5 Sprints),
 * offene Impediments, Cross-ART-Blocker und Feature-Burnup pro Team.
 * Die Velocity-Daten kommen heute aus den Sprints am Team — keine
 * Bearbeitung von Sprint-Daten aus Pulse heraus (Out-of-Scope, siehe
 * Konzept-Doc).
 */
export function ArtTeamsTab({ teams }: Props) {
  if (teams.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Keine Teams an diesem ART. Lege im Structure-Hub Teams an.
        </p>
      </section>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {teams.map((team) => (
        <TeamCard key={team.teamId} team={team} />
      ))}
    </div>
  );
}

function TeamCard({ team }: { team: RteTeamRagRow }) {
  const lastVelocity = team.velocity.at(-1);
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-base font-medium">{team.teamName}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${RAG_CLASS[team.rag]}`}>
          {RAG_LABEL[team.rag]}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MetricLine
          icon={Target}
          label="Confidence"
          value={team.confidence != null ? team.confidence.toFixed(1) : "—"}
        />
        <MetricLine
          icon={Gauge}
          label="Velocity (last)"
          value={
            lastVelocity
              ? `${lastVelocity.delivered}${lastVelocity.target != null ? ` / ${lastVelocity.target}` : ""}`
              : "—"
          }
        />
        <MetricLine icon={AlertTriangle} label="Impediments" value={`${team.openImpediments}`} />
        <MetricLine icon={Network} label="Blocker" value={`${team.blockers}`} />
        <MetricLine
          icon={TrendingUp}
          label="Features"
          value={`${team.featureBurnup.completed} / ${team.featureBurnup.inPi}`}
        />
      </div>
      {team.velocity.length > 1 && (
        <p className="text-[11px] text-muted-foreground">
          Trend: {team.velocity.map((v) => v.delivered).join(" · ")}
        </p>
      )}
    </section>
  );
}

function MetricLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-3 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </div>
  );
}
