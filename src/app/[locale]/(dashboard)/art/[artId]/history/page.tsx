import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { listAuditHistory } from "@/server/services/audit-history";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

export default async function ArtHistoryPage({ params }: Props) {
  const { artId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const art = await getArt(db, principal.tenantId, artId as ArtId);
  if (!art) notFound();

  const history = await listAuditHistory(db, principal.tenantId, "art", art.id);
  const events = history.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <ArtSubNav artId={artId} artName={art.name} />

      <section className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
        <AuditTimeline events={events} />
      </section>
    </main>
  );
}
