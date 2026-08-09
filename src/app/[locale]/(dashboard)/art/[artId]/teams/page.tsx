import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/modules/core/org/server/services/art";
import { listTeams } from "@/modules/core/org/server/services/team";
import { CreateTeamDialog } from "@/features/team/components/create-team-dialog";
import { EditTeamDialog } from "@/features/team/components/edit-team-dialog";
import { DeleteTeamButton } from "@/features/team/components/delete-team-button";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { Page, PageHeader, PageSection } from "@/components/layout";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

export default async function TeamsPage({ params }: Props) {
  const { artId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [art, teams] = await Promise.all([
    getArt(db, principal.tenantId, artId as ArtId),
    listTeams(db, principal.tenantId, artId as ArtId),
  ]);

  if (!art) notFound();

  const canEdit = hasCapability(principal, "team.create", {
    tenantId: principal.tenantId,
    artId,
  });

  return (
    <Page>
      <ArtSubNav artId={artId} artName={art.name} />

      <PageHeader
        title="Teams"
        actions={canEdit ? <CreateTeamDialog artId={artId} /> : undefined}
      />

      <PageSection>
        {teams.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No teams yet. Create one to start assigning sprints.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="border rounded-lg p-5 space-y-3 hover:shadow-sm transition-shadow"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold">{team.name}</h3>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href={`/team/${team.id}/settings`}
                    className="inline-block text-xs font-medium text-primary hover:underline"
                  >
                    Einstellungen →
                  </Link>
                  {canEdit && (
                    <>
                      <EditTeamDialog id={team.id} artId={artId} name={team.name} />
                      <DeleteTeamButton id={team.id} artId={artId} name={team.name} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageSection>
    </Page>
  );
}
