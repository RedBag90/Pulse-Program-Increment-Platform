import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { listPis } from "@/server/services/pi";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-muted text-foreground/80",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-700",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * PI-Liste eines ARTs. Read-only: einzelne PIs werden hier nicht mehr
 * angelegt — sie entstehen aus dem Standard, der auf die Timeline des
 * ARTs angewendet wird (`/structure?tab=timeline` → Timeline auswählen
 * → „PI-Standard anwenden").
 */
export default async function PiListPage({ params }: Props) {
  const { artId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [art, { items: pis }] = await Promise.all([
    getArt(db, principal.tenantId, artId as ArtId),
    listPis(db, principal.tenantId, artId as ArtId),
  ]);

  if (!art) notFound();

  return (
    <main className="p-8 space-y-6">
      <ArtSubNav artId={artId} artName={art.name} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Program Increments</h1>
          {art.piCadenceWeeks && (
            <p className="text-sm text-muted-foreground mt-1">
              PI cadence: {art.piCadenceWeeks} weeks
            </p>
          )}
        </div>
      </div>

      {pis.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          <p>Noch keine PIs.</p>
          <p className="mt-2">
            PIs entstehen aus dem Standard, der auf die Timeline dieses ARTs angewendet wird.{" "}
            <Link
              href="/structure?tab=timeline"
              className="text-primary underline hover:no-underline"
            >
              Zur Timeline-Verwaltung →
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pis.map((pi) => {
            const badge = STATUS_BADGE[pi.status] ?? "bg-muted text-foreground/80";
            return (
              <Link
                key={pi.id}
                href={`/pi/${pi.id}`}
                className="block border rounded-lg p-5 hover:shadow-sm hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-semibold">{pi.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(pi.startDate)} – {formatDate(pi.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span>
                      {pi._count.sprints} sprint{pi._count.sprints !== 1 ? "s" : ""}
                    </span>
                    <span>
                      {pi._count.initiatives} feature{pi._count.initiatives !== 1 ? "s" : ""}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 font-medium ${badge}`}
                    >
                      {pi.status}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
