import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getTeam } from "@/server/services/team";
import { listAuditHistory } from "@/server/services/audit-history";
import { TeamSubNav } from "@/features/team/components/team-sub-nav";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { redirect, notFound } from "next/navigation";
import type { TeamId } from "@/domain/types";

interface Props {
  params: Promise<{ teamId: string }>;
}

export default async function TeamHistoryPage({ params }: Props) {
  const { teamId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const team = await getTeam(db, principal.tenantId, teamId as TeamId);
  if (!team) notFound();

  const history = await listAuditHistory(db, principal.tenantId, "team", team.id);
  const events = history.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <TeamSubNav teamId={teamId} teamName={team.name} artId={team.artId} artName={team.art.name} />

      <section className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
        <AuditTimeline events={events} />
      </section>
    </main>
  );
}
