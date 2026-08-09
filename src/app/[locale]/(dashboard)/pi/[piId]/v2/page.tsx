import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi } from "@/modules/drumbeat/server/services/pi";
import { listPiObjectives } from "@/modules/drumbeat/server/services/pi-objective";
import { listImpedimentsForArts } from "@/modules/drumbeat/server/services/impediment";
import { buildPiDetailModel } from "@/server/views/pi-detail";
import { buildDependenciesListModel } from "@/server/views/dependencies-list";
import { PiDetailShell, resolvePiTab } from "@/modules/drumbeat/features/pi/components/pi-detail-shell";
import { PiOverviewTab } from "@/modules/drumbeat/features/pi/components/tabs/pi-overview-tab";
import { PiDependenciesTab } from "@/modules/drumbeat/features/pi/components/tabs/pi-dependencies-tab";
import { LayoutToggle } from "@/components/nav/layout-toggle";
import { tabToOldHref } from "@/components/nav/layout-toggle-routes";
import { redirect, notFound } from "next/navigation";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { PiId, TenantId, ArtId } from "@/modules/core/kernel/domain/types";

interface Props {
  params: Promise<{ piId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/**
 * Tab-Detail-Variante von PI — parallel zur klassischen Sub-Route-Welt
 * (`/pi/[piId]` Root + `/pi/[piId]/dependencies`). Per LayoutToggle im
 * Header kann zwischen beiden Varianten umgeschaltet werden.
 */
export default async function PiV2Page({ params, searchParams }: Props) {
  const [{ piId }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab = resolvePiTab(rawTab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const piRow = await getPi(db, principal.tenantId, piId as PiId);
  if (!piRow) notFound();
  const timeline = piRow.timeline;
  if (!timeline) notFound();

  const artIds = timeline.arts.map((a) => a.id as ArtId);

  let tabContent: React.ReactNode = null;

  if (tab === "dependencies") {
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
    const depArtIds = [
      ...new Set(allFeatures.map((f) => f.artId).filter((id): id is string => id != null)),
    ];
    const depPiIds = [
      ...new Set(allFeatures.map((f) => f.piId).filter((id): id is string => id != null)),
    ];

    const [arts, pis] = await Promise.all([
      depArtIds.length === 0
        ? Promise.resolve([])
        : db.art.findMany({
            where: { id: { in: depArtIds }, tenantId: principal.tenantId },
            select: { id: true, name: true },
          }),
      depPiIds.length === 0
        ? Promise.resolve([])
        : db.programIncrement.findMany({
            where: { id: { in: depPiIds }, tenantId: principal.tenantId },
            select: { id: true, name: true },
          }),
    ]);

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

    const scopeArtId = piFeatures[0]?.artId ?? arts[0]?.id ?? "";
    const canEdit =
      scopeArtId !== "" &&
      hasCapability(principal, "dependency.unlink", {
        tenantId: principal.tenantId,
        artId: scopeArtId,
      });

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

    tabContent = (
      <PiDependenciesTab
        piName={piRow.name}
        orphanCount={model.orphanCount}
        nodes={nodes}
        edges={edges}
        model={model}
        artId={scopeArtId}
        canEdit={canEdit}
      />
    );
  } else {
    // overview (default)
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

    const { pi, arts, primaryArt, featuresByArt, candidatesByArt, summary } = model;

    const canEdit = hasCapability(principal, "feature.update", {
      tenantId: principal.tenantId,
      artId: primaryArt.id,
    });

    tabContent = (
      <PiOverviewTab
        piId={piId}
        pi={pi}
        timelineName={model.timeline.name}
        arts={arts}
        primaryArt={primaryArt}
        summary={summary}
        featuresByArt={featuresByArt}
        candidatesByArt={candidatesByArt}
        featuresTotalCount={piRow.initiatives.length}
        canEdit={canEdit}
      />
    );
  }

  return (
    <PiDetailShell
      piId={piId}
      piName={piRow.name}
      timelineName={timeline.name}
      activeTab={tab}
      headerActions={<LayoutToggle current="new" otherHref={tabToOldHref("pi", piId, tab)} />}
    >
      {tabContent}
    </PiDetailShell>
  );
}
