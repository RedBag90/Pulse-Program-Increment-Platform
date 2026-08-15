import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/modules/drumbeat/server/services/pi";
import { buildPiDetailModel } from "@/modules/drumbeat/server/views/pi-detail";
import { PiTransitionButton } from "@/modules/drumbeat/features/pi/components/pi-transition-button";
import { DeletePiButton } from "@/modules/drumbeat/features/pi/components/delete-pi-button";
import { PiSubNav } from "@/modules/drumbeat/features/pi/components/pi-sub-nav";
import { PiOverviewSummary } from "@/modules/drumbeat/features/pi/components/pi-overview-summary";
import { PiFeaturesByArt } from "@/modules/drumbeat/features/pi/components/pi-features-by-art";
import { PiArtChips } from "@/modules/drumbeat/features/pi/components/pi-art-chips";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { Page, PageSection } from "@/components/layout";
import { Link } from "@/i18n/navigation";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { PiId, TenantId, ArtId } from "@/modules/core/kernel/domain/types";
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

  const [openIssues, candidates] = await Promise.all([
    db.issue.count({
      where: {
        tenantId: principal.tenantId,
        deletedAt: null,
        roamStatus: "open",
        artId: { in: artIds },
      },
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
    openIssues,
    candidates,
  });
  if (!model) notFound();

  const { pi, arts, primaryArt, featuresByArt, candidatesByArt, summary } = model;

  const badgeClass = STATUS_BADGE[pi.status] ?? "bg-muted text-muted-foreground";
  const totalDays = Math.round(
    (pi.endDate.getTime() - pi.startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const canEdit = hasCapability(principal, "feature.update", {
    tenantId: principal.tenantId,
    artId: primaryArt.id,
  });

  return (
    <Page>
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

      <PageSection title={`Features (${piRow.initiatives.length})`}>
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
      </PageSection>
    </Page>
  );
}
