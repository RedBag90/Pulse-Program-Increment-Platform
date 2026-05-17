import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { PiSubNav } from "@/features/pi/components/pi-sub-nav";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { redirect, notFound } from "next/navigation";
import type { PiId, TenantId } from "@/domain/types";
import { ProgramBoard } from "@/features/pi/components/program-board";

interface Props {
  params: Promise<{ piId: string }>;
}

export default async function PiBoardPage({ params }: Props) {
  const { piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pi = await getPi(db, principal.tenantId, piId as PiId);
  if (!pi) notFound();

  const teams = await db.team.findMany({
    where: { artId: pi.art.id, tenantId: principal.tenantId as TenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, targetVelocity: true },
  });

  // wsjfComputed arrives as a Prisma Decimal — coerce to a plain number so the
  // feature objects can cross the server → client component boundary.
  const features = pi.initiatives.map((f) => ({
    id: f.id,
    title: f.title,
    status: f.status,
    wsjfComputed: f.wsjfComputed === null ? null : Number(f.wsjfComputed),
  }));

  return (
    <main className="p-6 max-w-full space-y-6">
      <Breadcrumbs
        items={[
          { label: "ARTs", href: "/art" },
          { label: pi.art.name, href: `/art/${pi.art.id}` },
          { label: pi.name, href: `/pi/${piId}` },
          { label: "Program Board" },
        ]}
      />

      <PiSubNav piId={piId} />

      <h1 className="text-xl font-semibold">Program Board — {pi.name}</h1>

      <ProgramBoard
        artId={pi.art.id}
        piId={piId}
        piName={pi.name}
        teams={teams}
        sprints={pi.sprints}
        features={features}
      />
    </main>
  );
}
