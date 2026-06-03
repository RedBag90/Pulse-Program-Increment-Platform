import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { PiSubNav } from "@/features/pi/components/pi-sub-nav";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import type { PiId, TenantId } from "@/domain/types";
import { ProgramBoard } from "@/features/pi/components/program-board";

interface Props {
  params: Promise<{ piId: string }>;
  searchParams: Promise<{ art?: string }>;
}

export default async function PiBoardPage({ params, searchParams }: Props) {
  const { piId } = await params;
  const { art: artParam } = await searchParams;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pi = await getPi(db, principal.tenantId, piId as PiId);
  if (!pi) notFound();
  const timeline = pi.timeline;
  if (!timeline) notFound();
  const arts = timeline.arts;

  // The Program Board is naturally team×sprint and thus ART-scoped. When the
  // PI lives on a Timeline that has several ARTs, the user picks one via
  // `?art=<id>`. Default to the first; the picker below switches.
  const activeArt = arts.find((a) => a.id === artParam) ?? arts[0];
  if (!activeArt) notFound();

  const teams = await db.team.findMany({
    where: { artId: activeArt.id, tenantId: principal.tenantId as TenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, targetVelocity: true },
  });

  // Sprints are Team-scoped → keep only those whose team belongs to activeArt.
  const teamIdsInArt = new Set(teams.map((t) => t.id));
  const sprintsForArt = pi.sprints.filter((s) => teamIdsInArt.has(s.teamId));

  // Features in this PI that live in the active ART.
  const features = pi.initiatives
    .filter((f) => f.artId === activeArt.id)
    .map((f) => ({
      id: f.id,
      title: f.title,
      status: f.status,
      wsjfComputed: f.wsjfComputed === null ? null : Number(f.wsjfComputed),
    }));

  return (
    <main className="p-6 max-w-full space-y-6">
      <Breadcrumbs
        items={[
          { label: "Struktur", href: "/structure" },
          { label: `Timeline: ${timeline.name}`, href: "/structure?tab=timeline" },
          { label: pi.name, href: `/pi/${piId}` },
          { label: "Program Board" },
        ]}
      />

      <PiSubNav piId={piId} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Program Board — {pi.name}</h1>
        {arts.length > 1 && (
          <nav
            aria-label="ART wählen"
            className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5 text-xs"
          >
            {arts.map((a) => {
              const active = a.id === activeArt.id;
              return (
                <Link
                  key={a.id}
                  href={`/pi/${piId}/board?art=${a.id}`}
                  className={`rounded px-2 py-1 transition-colors ${
                    active
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {a.name}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      <ProgramBoard
        artId={activeArt.id}
        piId={piId}
        piName={pi.name}
        teams={teams}
        sprints={sprintsForArt}
        features={features}
      />
    </main>
  );
}
