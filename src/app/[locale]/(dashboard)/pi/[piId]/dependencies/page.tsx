import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { Page, PageHeader, PageSection } from "@/components/layout";
import { PiSubNav } from "@/features/pi/components/pi-sub-nav";
import { DependencyGraph } from "@/features/pi/components/dependency-graph";
import { buildDependenciesListModel } from "@/server/views/dependencies-list";
import { DependenciesListShell } from "@/features/dependencies/components/dependencies-list-shell";

interface Props {
  params: Promise<{ piId: string }>;
}

/**
 * PI dependency map — rich filterable list with a type funnel + multi-facet
 * filter bar + bulk unlink. The existing force-directed graph stays above
 * the list as a collapsible <details> card so the visual exploration view
 * is one click away when the list grows.
 */
export default async function PiDependenciesPage({ params }: Props) {
  const { piId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pi = await db.programIncrement.findFirst({
    where: { id: piId, tenantId: principal.tenantId as TenantId },
    include: { timeline: { select: { id: true, name: true } } },
  });
  if (!pi) notFound();
  const timeline = pi.timeline;
  if (!timeline) notFound();

  const piFeatures = await db.initiative.findMany({
    where: {
      tenantId: principal.tenantId as TenantId,
      piId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
    },
    select: { id: true, title: true, status: true, artId: true, parentId: true, piId: true },
  });
  const piFeatureIds = piFeatures.map((f) => f.id);

  // Pull all dependencies touching a Feature in this PI.
  const deps =
    piFeatureIds.length === 0
      ? []
      : await db.dependency.findMany({
          where: {
            tenantId: principal.tenantId as TenantId,
            OR: [{ fromId: { in: piFeatureIds } }, { toId: { in: piFeatureIds } }],
          },
          include: {
            from: { select: { id: true, title: true, level: true, status: true } },
            to: { select: { id: true, title: true, level: true, status: true } },
          },
          orderBy: { createdAt: "asc" },
        });

  // Resolve the "other ends" of cross-PI deps so the row can render their
  // titles + parent ART. One additional query keeps this cheap.
  const externalIds = new Set<string>();
  for (const d of deps) {
    if (!piFeatures.some((f) => f.id === d.fromId)) externalIds.add(d.fromId);
    if (!piFeatures.some((f) => f.id === d.toId)) externalIds.add(d.toId);
  }
  const externalFeatures =
    externalIds.size === 0
      ? []
      : await db.initiative.findMany({
          where: { tenantId: principal.tenantId as TenantId, id: { in: [...externalIds] } },
          select: {
            id: true,
            title: true,
            status: true,
            artId: true,
            parentId: true,
            piId: true,
          },
        });

  const allFeatures = [...piFeatures, ...externalFeatures];
  const artIds = [
    ...new Set(allFeatures.map((f) => f.artId).filter((id): id is string => id != null)),
  ];
  const piIds = [
    ...new Set(allFeatures.map((f) => f.piId).filter((id): id is string => id != null)),
  ];

  const [arts, pis] = await Promise.all([
    artIds.length === 0
      ? Promise.resolve([])
      : db.art.findMany({
          where: { id: { in: artIds }, tenantId: principal.tenantId },
          select: { id: true, name: true },
        }),
    piIds.length === 0
      ? Promise.resolve([])
      : db.programIncrement.findMany({
          where: { id: { in: piIds }, tenantId: principal.tenantId },
          select: { id: true, name: true },
        }),
  ]);

  // Orphan features = PI features that have no incident dependency.
  const featuresWithDeps = new Set<string>();
  for (const d of deps) {
    featuresWithDeps.add(d.fromId);
    featuresWithDeps.add(d.toId);
  }
  const orphanCount = piFeatures.filter((f) => !featuresWithDeps.has(f.id)).length;

  const model = buildDependenciesListModel({
    dependencies: deps.map((d) => ({
      id: d.id,
      type: d.type,
      fromId: d.fromId,
      toId: d.toId,
      createdAt: d.createdAt,
    })),
    features: allFeatures,
    arts,
    pis,
    piIdInScope: piId,
    orphanCount,
  });

  // The bulk-unlink action expects an artId — the PI's owning ART (via the
  // first PI Feature) is the closest match; fall back to the first known
  // ART. This is a coarse gate, sufficient because dependency.unlink is
  // checked at the resource level (tenant + artId).
  const scopeArtId = piFeatures[0]?.artId ?? arts[0]?.id ?? "";
  const canEdit =
    scopeArtId !== "" &&
    hasCapability(principal, "dependency.unlink", {
      tenantId: principal.tenantId,
      artId: scopeArtId,
    });

  // Build the graph nodes/edges from the same data the table uses.
  const nodeMap = new Map<string, { id: string; title: string; status: string; inPi: boolean }>();
  for (const f of piFeatures) {
    nodeMap.set(f.id, { id: f.id, title: f.title, status: f.status, inPi: true });
  }
  for (const d of deps) {
    if (!nodeMap.has(d.from.id)) {
      nodeMap.set(d.from.id, {
        id: d.from.id,
        title: d.from.title,
        status: d.from.status,
        inPi: false,
      });
    }
    if (!nodeMap.has(d.to.id)) {
      nodeMap.set(d.to.id, {
        id: d.to.id,
        title: d.to.title,
        status: d.to.status,
        inPi: false,
      });
    }
  }
  const nodes = [...nodeMap.values()];
  const edges = deps.map((d) => ({ id: d.id, fromId: d.fromId, toId: d.toId, type: d.type }));

  return (
    <Page>
      <Breadcrumbs
        items={[
          { label: "Struktur", href: "/structure" },
          { label: `Timeline: ${timeline.name}`, href: "/structure?tab=timeline" },
          { label: pi.name, href: `/pi/${piId}` },
          { label: "Dependencies" },
        ]}
      />

      <PiSubNav piId={piId} />

      <PageHeader
        title={`Abhängigkeiten — ${pi.name}`}
        subtitle={
          model.orphanCount > 0
            ? `${model.orphanCount} Feature${model.orphanCount === 1 ? "" : "s"} im PI ohne Abhängigkeit.`
            : undefined
        }
      />

      {nodes.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium hover:bg-muted/30">
            Graph anzeigen
          </summary>
          <div className="border-t p-4">
            <DependencyGraph nodes={nodes} edges={edges} />
          </div>
        </details>
      )}

      <PageSection>
        <Suspense fallback={null}>
          <DependenciesListShell model={model} artId={scopeArtId} canEdit={canEdit} />
        </Suspense>
      </PageSection>
    </Page>
  );
}
