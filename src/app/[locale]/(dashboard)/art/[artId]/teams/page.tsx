import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { listTeams } from "@/server/services/team";
import { CreateTeamDialog } from "@/features/team/components/create-team-dialog";
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

  const canEdit =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/art" className="hover:underline">
          ARTs
        </Link>
        {" / "}
        <span className="text-gray-800 font-medium">{art.name}</span>
        {" / Teams"}
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{art.name} — Teams</h1>
        {canEdit && <CreateTeamDialog artId={artId} />}
      </div>

      {teams.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No teams yet. Create one to start assigning sprints.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <div key={team.id} className="border rounded-lg p-5 space-y-2">
              <h2 className="font-semibold">{team.name}</h2>
              <p className="text-xs text-gray-400">
                {team._count.sprints} sprint{team._count.sprints !== 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
