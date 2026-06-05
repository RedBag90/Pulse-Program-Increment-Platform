import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { listPiObjectives } from "@/server/services/pi-objective";
import { listImpedimentsForArts } from "@/server/services/impediment";
import { buildPiDetailModel } from "@/server/views/pi-detail";
import { PiTransitionButton } from "@/features/pi/components/pi-transition-button";
import { DeletePiButton } from "@/features/pi/components/delete-pi-button";
import { PiSubNav } from "@/features/pi/components/pi-sub-nav";
import { PiOverviewSummary } from "@/features/pi/components/pi-overview-summary";
import { PiFeaturesByArt } from "@/features/pi/components/pi-features-by-art";
import { PiArtChips } from "@/features/pi/components/pi-art-chips";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { PiId, TenantId, ArtId } from "@/domain/types";
import { Card } from "@/components/ui/card";

interface Props {
  params: Promise<{ piId: string }>;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

export default async function PiDetailPage({ params }: Props) {
  const { piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const piRow = await getPi(db, principal.tenantId, piId as PiId);
  if (!piRow) notFound();

  // The PI lives on a Timeline that may serve several ARTs. The page-model
  // owns the per-ART grouping; the page is load → build → render.
  const timeline = piRow.timeline;
  if (!timeline) notFound();
  const artIds = timeline.arts.map((a) => a.id as ArtId);

  const [objectives, impediments, teams, candidates] = await Promise.all([
    listPiObjectives(db, principal.tenantId, piId as PiId),
    listImpedimentsForArts(db, principal.tenantId, artIds, { piId }),
    db.team.findMany({
      where: { tenantId: principal.tenantId as TenantId, artId: { in: artIds } },
      orderBy: { name: "asc" },
    }),
    db.initiative.findMany({
      where: {
        tenantId: principal.tenantId as TenantId,
        artId: { in: artIds },
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        OR: [{ piId: null }, { piId: { not: piId } }],
      },
      select: {
        id: true,
        title: true,
        wsjfComputed: true,
        artId: true,
        pi: { select: { name: true } },
      },
      orderBy: { wsjfComputed: { sort: "desc", nulls: "last" } },
    }),
  ]);

  const model = buildPiDetailModel({
    pi: piRow,
    teams,
    objectives,
    impediments,
    candidates,
  });
  if (!model) notFound();

  const { pi, sprints, arts, primaryArt, featuresByArt, candidatesByArt, summary } = model;

  const badgeClass = STATUS_BADGE[pi.status] ?? "bg-muted text-muted-foreground";
  const totalDays = Math.round(
    (pi.endDate.getTime() - pi.startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const canEdit = hasCapability(principal, "feature.update", {
    tenantId: principal.tenantId,
    artId: primaryArt.id,
  });

  return (
    <main className="space-y-6 p-6 md:p-8">
      <Breadcrumbs
        items={[
          { label: "Struktur", href: "/structure" },
          {
            label: `Timeline: ${model.timeline.name}`,
            href: "/structure?tab=timeline",
          },
          { label: pi.name },
        ]}
      />

      <PiSubNav piId={piId} />

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{pi.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(pi.startDate)} – {formatDate(pi.endDate)} ({totalDays} days)
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Timeline:{" "}
                <Link href={`/structure?tab=timeline`} className="font-medium hover:underline">
                  {model.timeline.name}
                </Link>
                {" · "}
                {arts.length} ART{arts.length === 1 ? "" : "s"}:
              </span>
              <PiArtChips arts={arts} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}
            >
              {pi.status}
            </span>
            <PiTransitionButton piId={piId} currentStatus={pi.status} />
            {canEdit && pi.status === "planned" && (
              <DeletePiButton piId={piId} artId={primaryArt.id} name={pi.name} />
            )}
          </div>
        </div>
      </Card>

      {/* Metrics — first ART is used only as an auth scope for the click-throughs. */}
      <PiOverviewSummary summary={summary} piId={piId} artId={primaryArt.id} />

      {/* Sprints */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Sprints ({sprints.length})
        </h2>
        {sprints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sprints yet.</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {sprints.map((sprint) => (
                <div
                  key={sprint.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium">Sprint {sprint.indexInPi}</span>
                    {sprint.team && (
                      <span className="ml-2 text-xs text-muted-foreground">{sprint.team.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                    </span>
                    <Link
                      href={`/sprint/${sprint.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      Board →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Features grouped per ART */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Features ({piRow.initiatives.length})
        </h2>
        <div className="space-y-4">
          {arts.map((a) => (
            <PiFeaturesByArt
              key={a.id}
              art={a}
              features={featuresByArt.get(a.id) ?? []}
              candidates={candidatesByArt.get(a.id) ?? []}
              canEdit={canEdit && pi.status !== "completed"}
              piId={piId}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
