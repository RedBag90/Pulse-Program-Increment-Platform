import type { ReactNode } from "react";
import { userLabel } from "@/components/detail/initiative-labels";
import { teamTypeLabel } from "@/domain/team-type";
import { TeamOverviewForm } from "@/features/capacity/components/team-overview-form";

interface Team {
  id: string;
  artId: string;
  name: string;
  description: string | null;
  headcount: number | null;
  targetVelocity: number | null;
  scrumMasterId: string | null;
  productOwnerId: string | null;
  teamType: string | null;
}

interface Approver {
  userId: string;
  roles: string[];
}

interface Props {
  team: Team;
  canEdit: boolean;
  approvers: Approver[];
  userLabels: Record<string, string>;
}

/**
 * Settings-Tab — gleicher Inhalt wie heute `/team/[teamId]/settings/page.tsx`,
 * aber in einer Tab-Komponente, sodass sowohl die alte Sub-Route-Page als
 * auch die neue Tab-Detail-Page (`/team/[teamId]/v2?tab=settings`) sie
 * benutzen koennen. Single source of truth fuer den Inhalt.
 */
export function TeamSettingsTab({ team, canEdit, approvers, userLabels }: Props) {
  // Remounts the uncontrolled edit form whenever the persisted Team data
  // changes (navigation between teams, or a save) so its `defaultValue`s never
  // change on a live instance — and never resets while the user is editing.
  const formKey = [
    team.id,
    team.name,
    team.description ?? "",
    team.headcount ?? "",
    team.targetVelocity ?? "",
    team.scrumMasterId ?? "",
    team.productOwnerId ?? "",
    team.teamType ?? "",
  ].join("|");

  const teamUsers = approvers.filter((u) => u.roles.includes("team_editor"));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
      {canEdit ? (
        <TeamOverviewForm
          key={formKey}
          id={team.id}
          artId={team.artId}
          name={team.name}
          description={team.description ?? ""}
          headcount={team.headcount?.toString() ?? ""}
          targetVelocity={team.targetVelocity?.toString() ?? ""}
          scrumMasterId={team.scrumMasterId ?? ""}
          productOwnerId={team.productOwnerId ?? ""}
          teamType={team.teamType ?? ""}
          teamUsers={teamUsers}
          userLabels={userLabels}
        />
      ) : (
        <dl className="max-w-xl space-y-3 text-sm">
          <Field label="Name">{team.name}</Field>
          <Field label="Beschreibung">{team.description ?? "—"}</Field>
          <Field label="Team-Typ">{teamTypeLabel(team.teamType)}</Field>
          <Field label="Scrum Master">
            {team.scrumMasterId ? userLabel(team.scrumMasterId, userLabels) : "—"}
          </Field>
          <Field label="Product Owner">
            {team.productOwnerId ? userLabel(team.productOwnerId, userLabels) : "—"}
          </Field>
          <Field label="Mitgliederzahl">{team.headcount ?? "—"}</Field>
          <Field label="Ziel-Velocity">{team.targetVelocity ?? "—"}</Field>
        </dl>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
