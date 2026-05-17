import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getTeam } from "@/server/services/team";
import { listAuditHistory } from "@/server/services/audit-history";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { TeamOverviewForm } from "@/features/capacity/components/team-overview-form";
import { redirect } from "next/navigation";
import type { TeamId } from "@/domain/types";

const TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Verlauf" },
];

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function TeamDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveTab(TABS, tab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const team = await getTeam(db, principal.tenantId, id as TeamId);
  if (!team) redirect("/capacity");

  const canEdit =
    principal.roles.includes("rte") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const history = await listAuditHistory(db, principal.tenantId, "team", team.id);
  const events = history.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));

  return (
    <EntityDetailShell
      backHref={`/capacity/arts/${team.artId}`}
      backLabel={`Zurück zu ${team.art.name}`}
      title={team.name}
      badge={team.headcount != null ? `${team.headcount} Mitglieder` : undefined}
      tabs={TABS}
      activeTab={activeTab}
      basePath={`/capacity/teams/${team.id}`}
    >
      {activeTab === "overview" &&
        (canEdit ? (
          <TeamOverviewForm
            id={team.id}
            artId={team.artId}
            name={team.name}
            description={team.description ?? ""}
            headcount={team.headcount?.toString() ?? ""}
            targetVelocity={team.targetVelocity?.toString() ?? ""}
          />
        ) : (
          <dl className="max-w-xl space-y-3 text-sm">
            <Field label="Name">{team.name}</Field>
            <Field label="Beschreibung">{team.description ?? "—"}</Field>
            <Field label="Mitgliederzahl">{team.headcount ?? "—"}</Field>
            <Field label="Ziel-Velocity">{team.targetVelocity ?? "—"}</Field>
          </dl>
        ))}

      {activeTab === "history" && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Verlauf</h2>
          <AuditTimeline events={events} />
        </section>
      )}
    </EntityDetailShell>
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
