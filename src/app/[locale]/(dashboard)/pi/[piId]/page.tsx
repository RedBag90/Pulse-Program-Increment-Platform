import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/server/services/pi";
import { listPiObjectives } from "@/server/services/pi-objective";
import { listImpediments } from "@/server/services/impediment";
import { listTeams } from "@/server/services/team";
import { summarizePiOverview } from "@/domain/pi-overview";
import { PiTransitionButton } from "@/features/pi/components/pi-transition-button";
import { DeletePiButton } from "@/features/pi/components/delete-pi-button";
import { PiSubNav } from "@/features/pi/components/pi-sub-nav";
import { PiOverviewSummary } from "@/features/pi/components/pi-overview-summary";
import {
  AssignFeaturesDialog,
  RemoveFromPiButton,
} from "@/features/pi/components/assign-features-dialog";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/domain/types";
import type { PiId, TenantId, ArtId } from "@/domain/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("art_full_editor") ||
    principal.roles.includes("feature_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const [objectives, impedimentPage, teams, candidateRows] = await Promise.all([
    listPiObjectives(db, principal.tenantId, piId as PiId),
    listImpediments(db, principal.tenantId, pi.art.id as ArtId, { piId }),
    listTeams(db, principal.tenantId, pi.art.id as ArtId),
    db.initiative.findMany({
      where: {
        tenantId: principal.tenantId as TenantId,
        artId: pi.art.id,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        OR: [{ piId: null }, { piId: { not: piId } }],
      },
      select: {
        id: true,
        title: true,
        wsjfComputed: true,
        pi: { select: { name: true } },
      },
      orderBy: { wsjfComputed: { sort: "desc", nulls: "last" } },
    }),
  ]);

  const candidates = candidateRows.map((c) => ({
    id: c.id,
    title: c.title,
    wsjfComputed: c.wsjfComputed !== null ? Number(c.wsjfComputed) : null,
    currentPiName: c.pi?.name ?? null,
  }));

  const teamVelocity = new Map(teams.map((t) => [t.id, t.targetVelocity]));
  const summary = summarizePiOverview({
    sprints: pi.sprints.map((s) => ({
      teamTargetVelocity: teamVelocity.get(s.teamId) ?? null,
      stories: s.initiatives.map((st) => ({ storyPoints: st.storyPoints, status: st.status })),
    })),
    features: pi.initiatives.map((f) => ({ status: f.status })),
    objectives: objectives.map((o) => ({ committed: o.committed, confidence: o.confidence })),
    impediments: impedimentPage.items.map((i) => ({ status: i.status })),
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <Breadcrumbs
        items={[
          { label: "ARTs", href: "/art" },
          { label: pi.art.name, href: `/art/${pi.art.id}` },
          { label: pi.name },
        ]}
      />

      <PiSubNav piId={piId} />

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{pi.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(pi.startDate)} – {formatDate(pi.endDate)} ({totalDays} days)
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}
            >
              {pi.status}
            </span>
            <PiTransitionButton piId={piId} currentStatus={pi.status} />
            {canEdit && pi.status === "planned" && (
              <DeletePiButton piId={piId} artId={pi.art.id} name={pi.name} />
            )}
          </div>
        </div>
      </Card>

      {/* Metrics */}
      <PiOverviewSummary summary={summary} piId={piId} artId={pi.art.id} />

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

      {/* Features in this PI */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Features ({pi.initiatives.length})
          </h2>
          {canEdit && pi.status !== "completed" && (
            <AssignFeaturesDialog piId={piId} artId={pi.art.id} candidates={candidates} />
          )}
        </div>
        {pi.initiatives.length === 0 ? (
          <p className="text-sm text-muted-foreground">No features assigned to this PI yet.</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {pi.initiatives.map((feature) => (
                <div
                  key={feature.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <Link
                    href={`/feature/${feature.id}`}
                    className="font-medium transition-colors hover:text-primary"
                  >
                    {feature.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {feature.wsjfComputed !== null && (
                      <Badge className="border-primary/20 bg-primary/10 font-medium text-primary">
                        WSJF {Number(feature.wsjfComputed).toFixed(2)}
                      </Badge>
                    )}
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 ${STATUS_BADGE[feature.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {feature.status}
                    </span>
                    {canEdit && pi.status !== "completed" && (
                      <RemoveFromPiButton featureId={feature.id} artId={pi.art.id} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </main>
  );
}
