import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listImpediments } from "@/server/services/impediment";
import { redirect } from "next/navigation";
import type { TenantId, ArtId } from "@/domain/types";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { CreateImpedimentDialog } from "@/features/impediment/components/create-impediment-dialog";
import { ImpedimentRow } from "@/features/impediment/components/impediment-row";

interface Props {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ piId?: string; status?: string }>;
}

export default async function ImpedimentsPage({ params, searchParams }: Props) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const { artId } = await params;
  const { piId, status } = await searchParams;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [art, { items: impediments }] = await Promise.all([
    db.art.findFirst({ where: { id: artId, tenantId: principal.tenantId } }),
    listImpediments(db, principal.tenantId as TenantId, artId as ArtId, {
      ...(piId !== undefined && { piId }),
      ...(status !== undefined && { status }),
    }),
  ]);

  if (!art) redirect("/structure?tab=arts");

  const open = impediments.filter((i) => i.status === "open");
  const escalated = impediments.filter((i) => i.status === "escalated");
  const resolved = impediments.filter((i) => i.status === "resolved");

  return (
    <div className="space-y-6">
      <ArtSubNav artId={artId} artName={art.name} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Impediments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {open.length} open · {escalated.length} escalated · {resolved.length} resolved
          </p>
        </div>
        <CreateImpedimentDialog artId={artId} />
      </div>

      {impediments.length === 0 && (
        <div className="text-center py-16 bg-white border border-border rounded-xl">
          <p className="text-muted-foreground/60 text-sm">No impediments logged yet.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Use "Log Impediment" to track blockers.
          </p>
        </div>
      )}

      {escalated.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
            Escalated ({escalated.length})
          </h2>
          {escalated.map((imp) => (
            <ImpedimentRow key={imp.id} impediment={imp} artId={artId} />
          ))}
        </section>
      )}

      {open.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">
            Open ({open.length})
          </h2>
          {open.map((imp) => (
            <ImpedimentRow key={imp.id} impediment={imp} artId={artId} />
          ))}
        </section>
      )}

      {resolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Resolved ({resolved.length})
          </h2>
          {resolved.map((imp) => (
            <ImpedimentRow key={imp.id} impediment={imp} artId={artId} />
          ))}
        </section>
      )}
    </div>
  );
}
