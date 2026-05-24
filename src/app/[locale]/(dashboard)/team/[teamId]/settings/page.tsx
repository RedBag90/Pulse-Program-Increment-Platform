import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getTeam } from "@/server/services/team";
import { listTenantApprovers } from "@/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { userLabel } from "@/components/detail/initiative-labels";
import { teamTypeLabel } from "@/domain/team-type";
import { TeamSubNav } from "@/features/team/components/team-sub-nav";
import { TeamOverviewForm } from "@/features/capacity/components/team-overview-form";
import { redirect, notFound } from "next/navigation";
import type { TeamId } from "@/domain/types";

interface Props {
  params: Promise<{ teamId: string }>;
}

export default async function TeamSettingsPage({ params }: Props) {
  const { teamId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const team = await getTeam(db, principal.tenantId, teamId as TeamId);
  if (!team) notFound();

  const canEdit =
    principal.roles.includes("rte") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

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

  const [approvers, userLabels] = await Promise.all([
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  const teamUsers = approvers.filter((u) => u.roles.includes("team_editor"));

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <TeamSubNav teamId={teamId} teamName={team.name} artId={team.artId} artName={team.art.name} />

      <section className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
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
    </main>
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
