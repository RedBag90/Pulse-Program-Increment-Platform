import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { PiId, TenantId } from "@/domain/types";
import { ProgramBoard } from "@/features/pi/components/program-board";

interface Props {
  params: Promise<{ artId: string; piId: string }>;
}

export default async function PiBoardPage({ params }: Props) {
  const { artId, piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [pi, teams] = await Promise.all([
    getPi(db, principal.tenantId, piId as PiId),
    db.team.findMany({
      where: { artId, tenantId: principal.tenantId as TenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!pi) notFound();

  return (
    <main className="p-6 max-w-full space-y-6">
      <nav className="text-sm text-gray-500 flex items-center gap-1">
        <Link href="/art" className="hover:underline">
          ARTs
        </Link>
        <span>/</span>
        <Link href={`/art/${artId}/pi`} className="hover:underline">
          {pi.art.name}
        </Link>
        <span>/</span>
        <Link href={`/art/${artId}/pi/${piId}`} className="hover:underline">
          {pi.name}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Program Board</span>
      </nav>

      <h1 className="text-xl font-semibold">Program Board — {pi.name}</h1>

      <ProgramBoard
        artId={artId}
        piId={piId}
        piName={pi.name}
        teams={teams}
        sprints={pi.sprints}
        features={pi.initiatives}
      />
    </main>
  );
}
