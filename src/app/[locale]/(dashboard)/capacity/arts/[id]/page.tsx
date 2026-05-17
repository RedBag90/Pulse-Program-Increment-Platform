import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { listAuditHistory } from "@/server/services/audit-history";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { ArtOverviewForm } from "@/features/capacity/components/art-overview-form";
import { CreateTeamDialog } from "@/features/team/components/create-team-dialog";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ArtId } from "@/domain/types";

const TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "teams", label: "Teams" },
  { key: "history", label: "Verlauf" },
];

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ArtDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveTab(TABS, tab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const art = await getArt(db, principal.tenantId, id as ArtId);
  if (!art) redirect("/capacity");

  const canEdit =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");

  const history = await listAuditHistory(db, principal.tenantId, "art", art.id);
  const events = history.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));

  return (
    <EntityDetailShell
      backHref={`/capacity/value-streams/${art.valueStreamId}`}
      backLabel={`Zurück zu ${art.valueStream.name}`}
      title={art.name}
      badge={`${art.teams.length} Team${art.teams.length !== 1 ? "s" : ""}`}
      tabs={TABS}
      activeTab={activeTab}
      basePath={`/capacity/arts/${art.id}`}
    >
      {activeTab === "overview" &&
        (canEdit ? (
          <ArtOverviewForm
            id={art.id}
            name={art.name}
            description={art.description ?? ""}
            piCadenceWeeks={art.piCadenceWeeks}
          />
        ) : (
          <dl className="max-w-xl space-y-3 text-sm">
            <Field label="Name">{art.name}</Field>
            <Field label="Beschreibung">{art.description ?? "—"}</Field>
            <Field label="PI-Kadenz">{art.piCadenceWeeks} Wochen</Field>
          </dl>
        ))}

      {activeTab === "teams" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Teams</h2>
            {canEdit && <CreateTeamDialog artId={art.id} />}
          </div>
          {art.teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Teams in diesem ART.</p>
          ) : (
            <ul className="space-y-2">
              {art.teams.map((team) => (
                <li key={team.id}>
                  <Link
                    href={`/capacity/teams/${team.id}`}
                    className="flex items-center gap-3 rounded border p-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{team.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {team.headcount ?? "—"} Mitglieder · Velocity {team.targetVelocity ?? "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
