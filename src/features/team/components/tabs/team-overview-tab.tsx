import { Link } from "@/i18n/navigation";
import { teamTypeLabel } from "@/domain/team-type";
import { userLabel } from "@/components/detail/initiative-labels";

interface Team {
  id: string;
  name: string;
  description: string | null;
  artId: string;
  art: { name: string };
  teamType: string | null;
  headcount: number | null;
  targetVelocity: number | null;
  scrumMasterId: string | null;
  productOwnerId: string | null;
}

interface Props {
  team: Team;
  userLabels: Record<string, string>;
}

/**
 * Overview-Tab — kompakter, read-only Top-Level-View des Teams. Existiert
 * nur in der neuen Tab-Detail-Variante; die alte Section-Sub-Nav hatte
 * keinen eigenen Overview-Pfad (Root war Redirect auf settings).
 */
export function TeamOverviewTab({ team, userLabels }: Props) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{team.name}</h2>
        {team.description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{team.description}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="ART">
          <Link
            href={`/art/${team.artId}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {team.art.name}
          </Link>
        </Stat>
        <Stat label="Team-Typ">{teamTypeLabel(team.teamType)}</Stat>
        <Stat label="Headcount">{team.headcount ?? "—"}</Stat>
        <Stat label="Ziel-Velocity">
          {team.targetVelocity != null ? `${team.targetVelocity} SP` : "—"}
        </Stat>
        <Stat label="Scrum Master">
          {team.scrumMasterId ? userLabel(team.scrumMasterId, userLabels) : "—"}
        </Stat>
        <Stat label="Product Owner">
          {team.productOwnerId ? userLabel(team.productOwnerId, userLabels) : "—"}
        </Stat>
      </div>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{children}</p>
    </div>
  );
}
