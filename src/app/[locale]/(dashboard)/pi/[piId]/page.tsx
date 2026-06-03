import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { listPiObjectives } from "@/server/services/pi-objective";
import { listImpedimentsForArts } from "@/server/services/impediment";
import { summarizePiOverview } from "@/domain/pi-overview";
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
  const pi = await getPi(db, principal.tenantId, piId as PiId);
  if (!pi) notFound();

  const badgeClass = STATUS_BADGE[pi.status] ?? "bg-muted text-muted-foreground";
  const totalDays = Math.round(
    (pi.endDate.getTime() - pi.startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const canEdit =
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("rte") ||
    principal.roles.includes("feature_owner") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  // The PI lives on a Timeline that may serve several ARTs. The page surfaces
  // aggregate data (objectives, impediments, teams, sprints) across every
  // subscribed ART and groups Features per ART so ownership stays visible.
  const timeline = pi.timeline;
  if (!timeline) notFound();
  const arts = timeline.arts;
  const artIds = arts.map((a) => a.id as ArtId);

  const [objectives, impediments, teams, candidateRows] = await Promise.all([
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

  // Group candidates by ART so each Features sub-card only sees its own pool.
  const candidatesByArt = new Map<
    string,
    Array<{ id: string; title: string; wsjfComputed: number | null; currentPiName: string | null }>
  >();
  for (const c of candidateRows) {
    if (!c.artId) continue;
    const list = candidatesByArt.get(c.artId) ?? [];
    list.push({
      id: c.id,
      title: c.title,
      wsjfComputed: c.wsjfComputed !== null ? Number(c.wsjfComputed) : null,
      currentPiName: c.pi?.name ?? null,
    });
    candidatesByArt.set(c.artId, list);
  }

  // Features in this PI grouped by their owning ART (Feature.artId never null
  // in practice — but we guard anyway).
  const featuresByArt = new Map<string, typeof pi.initiatives>();
  for (const f of pi.initiatives) {
    if (!f.artId) continue;
    const list = featuresByArt.get(f.artId) ?? [];
    list.push(f);
    featuresByArt.set(f.artId, list);
  }

  const teamVelocity = new Map(teams.map((t) => [t.id, t.targetVelocity]));
  const summary = summarizePiOverview({
    sprints: pi.sprints.map((s) => ({
      teamTargetVelocity: teamVelocity.get(s.teamId) ?? null,
      stories: s.initiatives.map((st) => ({ storyPoints: st.storyPoints, status: st.status })),
    })),
    features: pi.initiatives.map((f) => ({ status: f.status })),
    objectives: objectives.map((o) => ({ committed: o.committed, confidence: o.confidence })),
    impediments: impediments.map((i) => ({ status: i.status })),
  });

  return (
    <main className="space-y-6 p-6 md:p-8">
      <Breadcrumbs
        items={[
          { label: "Struktur", href: "/structure" },
          {
            label: `Timeline: ${timeline.name}`,
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
                  {timeline.name}
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
            {canEdit && pi.status === "planned" && arts[0] && (
              <DeletePiButton piId={piId} artId={arts[0].id} name={pi.name} />
            )}
          </div>
        </div>
      </Card>

      {/* Metrics — first ART is used only as an auth scope for the click-throughs. */}
      {arts[0] && <PiOverviewSummary summary={summary} piId={piId} artId={arts[0].id} />}

      {/* Sprints */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Sprints ({pi.sprints.length})
        </h2>
        {pi.sprints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sprints yet.</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {pi.sprints.map((sprint) => (
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
          Features ({pi.initiatives.length})
        </h2>
        {arts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Diese Timeline hat noch keine ARTs zugeordnet.
          </p>
        ) : (
          <div className="space-y-4">
            {arts.map((a) => (
              <PiFeaturesByArt
                key={a.id}
                art={a}
                features={(featuresByArt.get(a.id) ?? []).map((f) => ({
                  id: f.id,
                  title: f.title,
                  status: f.status,
                  wsjfComputed: f.wsjfComputed !== null ? Number(f.wsjfComputed) : null,
                }))}
                candidates={candidatesByArt.get(a.id) ?? []}
                canEdit={canEdit && pi.status !== "completed"}
                piId={piId}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
