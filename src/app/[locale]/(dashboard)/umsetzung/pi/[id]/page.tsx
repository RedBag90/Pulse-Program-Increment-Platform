import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { InitiativeLevel } from "@/domain/types";
import type { ArtId } from "@/domain/types";
import { listArtPlanningPis } from "@/server/services/pi";
import { listFeatures } from "@/server/services/feature";
import { listPiObjectives } from "@/server/services/pi-objective";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { getBlockerWindowsForFeatures } from "@/server/services/dependency";
import { evaluatePiClosure } from "@/server/services/pi";
import type { PiId } from "@/domain/types";
import {
  buildPlanningModel,
  earliestFundedCycle,
  type PlanningModel,
} from "@/server/views/pi-planning";
import { buildPiWorkspaceModel } from "@/server/views/pi-workspace";
import { halfYearKey } from "@/domain/calendar";
import { PiWorkspaceShell } from "@/features/umsetzung/components/pi-workspace-shell";
import type { ObjectiveRow } from "@/features/umsetzung/components/pi-objectives-tab";
import type { ExecutionFeature } from "@/features/umsetzung/components/pi-execution-tab";
import type { PiDependencyEdge } from "@/features/umsetzung/components/pi-dependencies-tab";
import type { PiImpedimentRow } from "@/features/umsetzung/components/pi-impediments-tab";
import type { ClosureOpenImpediment } from "@/features/umsetzung/components/pi-closure-tab";

/**
 * PI-Workspace-Page (Roadmap-P2.A · Skelett + Overview; P2.B · Plan +
 * Objectives + Execution Tabs).
 *
 * Loader laedt die Overview-Daten immer, Tab-spezifische Daten
 * (Planning-Modell, Objectives mit Teams, Execution-Features mit
 * Owner-Labels) nur wenn der aktive Tab das verlangt.
 */
export default async function PiWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; view?: string; art?: string }>;
}) {
  const { id } = await params;
  const { tab, view, art: selectedArtParam } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const pi = await db.programIncrement.findFirst({
    where: { id, tenantId: principal.tenantId },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      artId: true,
      systemDemoAt: true,
      inspectAdaptAt: true,
      retrospectiveNotes: true,
      art: { select: { id: true, name: true } },
      timeline: {
        select: { id: true, name: true, arts: { select: { id: true, name: true } } },
      },
    },
  });

  if (!pi) notFound();

  // Overview-Daten — immer geladen.
  const [piFeatures, objectives, impediments] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId: principal.tenantId,
        level: InitiativeLevel.FEATURE,
        piId: pi.id,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        wsjfJobSize: true,
        wsjfComputed: true,
        ownerId: true,
      },
    }),
    db.piObjective.findMany({
      where: { tenantId: principal.tenantId, piId: pi.id },
      select: { committed: true, confidence: true },
    }),
    db.impediment.findMany({
      where: { tenantId: principal.tenantId, piId: pi.id },
      select: { status: true, roamStatus: true },
    }),
  ]);

  const overview = buildPiWorkspaceModel({
    id: pi.id,
    name: pi.name,
    status: pi.status,
    startDate: pi.startDate,
    endDate: pi.endDate,
    artId: pi.artId ?? null,
    artName: pi.art?.name ?? null,
    timelineName: pi.timeline?.name ?? null,
    features: piFeatures.map((f) => ({ status: f.status, wsjfJobSize: f.wsjfJobSize })),
    objectives,
    impediments,
  });

  // Tab-spezifische Daten lazy laden.
  const activeTab = tab ?? "overview";

  // Plan-Tab — effective ART ableiten:
  //  1. direkter pi.artId (legacy)
  //  2. URL-Param ?art=<id> (User-Auswahl bei Multi-ART-Timeline)
  //  3. erster ART der Timeline (Default)
  const availableArts = pi.timeline?.arts ?? [];
  const effectiveArtId =
    pi.artId ??
    (selectedArtParam && availableArts.some((a) => a.id === selectedArtParam)
      ? selectedArtParam
      : (availableArts[0]?.id ?? null));

  let planningModel: PlanningModel | null = null;
  const planView: "board" | "table" = view === "table" ? "table" : "board";
  let canEditPlan = false;
  if (activeTab === "plan" && effectiveArtId) {
    canEditPlan = hasCapability(principal, "feature.update", {
      tenantId: principal.tenantId,
      artId: effectiveArtId,
    });

    const [pisRaw, featurePage, artBudget, tenant] = await Promise.all([
      listArtPlanningPis(db, principal.tenantId, effectiveArtId as ArtId),
      listFeatures(db, principal.tenantId, effectiveArtId as ArtId),
      db.artBudget.findFirst({
        where: { tenantId: principal.tenantId, artId: effectiveArtId },
        select: { byPeriod: true },
      }),
      db.tenant.findUnique({
        where: { id: principal.tenantId },
        select: { costPerJobSizePoint: true },
      }),
    ]);

    const artBudgetByPeriod: Record<string, number> | null = (() => {
      const raw = artBudget?.byPeriod;
      if (!raw || typeof raw !== "object") return null;
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      }
      return Object.keys(out).length > 0 ? out : null;
    })();
    const costPerJobSizePoint =
      tenant?.costPerJobSizePoint != null ? Number(tenant.costPerJobSizePoint) : null;

    const featureIds = featurePage.items.map((f) => f.id);
    const blockerWindowsByFeature = await getBlockerWindowsForFeatures(
      db,
      principal.tenantId,
      featureIds,
    );

    const epicIds = Array.from(
      new Set(
        featurePage.items
          .map((f) => f.parent?.id)
          .filter((eid): eid is string => typeof eid === "string"),
      ),
    );
    const epicAllocs =
      epicIds.length === 0
        ? []
        : await db.budgetAllocation.findMany({
            where: { tenantId: principal.tenantId, epicId: { in: epicIds } },
            select: { epicId: true, allocations: true },
          });
    const epicCycleByEpicId: Record<string, string | null> = Object.fromEntries(
      epicAllocs.map((a) => {
        const raw = a.allocations;
        const map: Record<string, number> = {};
        if (raw && typeof raw === "object") {
          for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof v === "number" && Number.isFinite(v)) map[k] = v;
          }
        }
        return [a.epicId, earliestFundedCycle(map)];
      }),
    );

    planningModel = buildPlanningModel({
      pis: pisRaw,
      features: featurePage.items,
      artBudgetByPeriod,
      costPerJobSizePoint,
      blockerWindowsByFeature,
      epicCycleByEpicId,
    });
  }

  // Objectives-Tab
  let objectiveRows: ObjectiveRow[] = [];
  let teamOptions: { id: string; name: string; artId: string }[] = [];
  let canCreateObjective = false;
  let canVoteObjective = false;
  if (activeTab === "objectives") {
    const [withTeam, teams] = await Promise.all([
      listPiObjectives(db, principal.tenantId, pi.id as never),
      // Teams aus allen ARTs der Timeline (oder einzeln aus dem PI-ART, wenn
      // kein Timeline-Verbund). Picker zeigt nur Teams, die der Principal lesen
      // darf — heute reicht der Tenant-Filter, der Service-Layer prueft den Rest.
      pi.timeline?.arts && pi.timeline.arts.length > 0
        ? db.team.findMany({
            where: {
              tenantId: principal.tenantId,
              artId: { in: pi.timeline.arts.map((a) => a.id) },
            },
            select: { id: true, name: true, artId: true },
            orderBy: { name: "asc" },
          })
        : pi.artId
          ? db.team.findMany({
              where: { tenantId: principal.tenantId, artId: pi.artId },
              select: { id: true, name: true, artId: true },
              orderBy: { name: "asc" },
            })
          : Promise.resolve([] as { id: string; name: string; artId: string }[]),
    ]);
    objectiveRows = withTeam.map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description ?? null,
      businessValue: o.businessValue ?? null,
      committed: o.committed,
      confidence: o.confidence ?? null,
      teamId: o.teamId,
      teamName: o.team?.name ?? "Unbekanntes Team",
      artId: o.team?.id != null ? (teams.find((t) => t.id === o.teamId)?.artId ?? null) : null,
    }));
    teamOptions = teams;
    // Capabilities: pi_objective.create und pi_objective.update sind beide
    // typischerweise im RTE/TEAM_EDITOR-Set. Hier prufen wir grob mit dem
    // PI-ART; der Service-Seam pruft pro Team granular.
    if (pi.artId) {
      canCreateObjective = hasCapability(principal, "pi_objective.create", {
        tenantId: principal.tenantId,
        artId: pi.artId,
      });
      canVoteObjective = hasCapability(principal, "pi_objective.update", {
        tenantId: principal.tenantId,
        artId: pi.artId,
      });
    }
  }

  // Dependencies-Tab — PI-scoped Dependency-Kanten.
  let dependencyEdges: PiDependencyEdge[] = [];
  if (activeTab === "dependencies") {
    const featureIdSet = new Set(piFeatures.map((f) => f.id));
    if (featureIdSet.size > 0) {
      const featureIds = [...featureIdSet];
      const [outRows, inRows] = await Promise.all([
        db.dependency.findMany({
          where: { tenantId: principal.tenantId, fromId: { in: featureIds } },
          select: {
            id: true,
            type: true,
            from: { select: { id: true, title: true } },
            to: { select: { id: true, title: true, pi: { select: { id: true, name: true } } } },
          },
        }),
        db.dependency.findMany({
          where: { tenantId: principal.tenantId, toId: { in: featureIds } },
          select: {
            id: true,
            type: true,
            to: { select: { id: true, title: true } },
            from: {
              select: { id: true, title: true, pi: { select: { id: true, name: true } } },
            },
          },
        }),
      ]);
      dependencyEdges = [
        ...outRows.map(
          (d): PiDependencyEdge => ({
            id: d.id,
            type: d.type as PiDependencyEdge["type"],
            direction: "out",
            here: { id: d.from.id, title: d.from.title },
            other: {
              id: d.to.id,
              title: d.to.title,
              piId: d.to.pi?.id ?? null,
              piName: d.to.pi?.name ?? null,
            },
          }),
        ),
        ...inRows.map(
          (d): PiDependencyEdge => ({
            id: d.id,
            type: d.type as PiDependencyEdge["type"],
            direction: "in",
            here: { id: d.to.id, title: d.to.title },
            other: {
              id: d.from.id,
              title: d.from.title,
              piId: d.from.pi?.id ?? null,
              piName: d.from.pi?.name ?? null,
            },
          }),
        ),
      ];
    }
  }

  // Impediments-Tab
  let impedimentRows: PiImpedimentRow[] = [];
  let canCreateImpediment = false;
  let canEscalateImp = false;
  let canResolveImp = false;
  if (activeTab === "impediments" && pi.artId) {
    const userLabels = await listTenantUserLabels(db, principal.tenantId);
    const rows = await db.impediment.findMany({
      where: { tenantId: principal.tenantId, piId: pi.id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        severity: true,
        roamStatus: true,
        raisedBy: true,
        createdAt: true,
        artId: true,
      },
    });
    impedimentRows = rows.map(
      (r): PiImpedimentRow => ({
        id: r.id,
        artId: r.artId,
        title: r.title,
        description: r.description ?? null,
        status: r.status as PiImpedimentRow["status"],
        severity: r.severity as PiImpedimentRow["severity"],
        roamStatus: r.roamStatus as PiImpedimentRow["roamStatus"],
        raisedByLabel: r.raisedBy ? (userLabels[r.raisedBy] ?? null) : null,
        createdAtIso: r.createdAt.toISOString(),
      }),
    );
    const scopeRes = { tenantId: principal.tenantId, artId: pi.artId };
    canCreateImpediment = hasCapability(principal, "impediment.create", scopeRes);
    canEscalateImp = hasCapability(principal, "impediment.escalate", scopeRes);
    canResolveImp = hasCapability(principal, "impediment.resolve", scopeRes);
  }

  // Closure-Tab — Pre-Checks + ROAM-Blocker.
  let closureIssues: string[] = [];
  let closureOpen: ClosureOpenImpediment[] = [];
  if (activeTab === "closure") {
    const evalRes = await evaluatePiClosure(db, principal.tenantId, pi.id as PiId);
    closureIssues = evalRes.issues;
    const openImps = await db.impediment.findMany({
      where: {
        tenantId: principal.tenantId,
        piId: pi.id,
        status: { in: ["open", "escalated"] },
        roamStatus: "open",
      },
      select: { id: true, title: true, severity: true, roamStatus: true, artId: true },
    });
    closureOpen = openImps.map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      roamStatus: i.roamStatus,
      artId: i.artId,
    }));
  }

  // Execution-Tab
  let executionFeatures: ExecutionFeature[] = [];
  let canTransitionExecution = false;
  if (activeTab === "execution") {
    const userLabels = await listTenantUserLabels(db, principal.tenantId);
    executionFeatures = piFeatures.map((f) => ({
      id: f.id,
      title: f.title,
      status: f.status,
      wsjfJobSize: f.wsjfJobSize,
      wsjfComputed: f.wsjfComputed != null ? Number(f.wsjfComputed) : null,
      ownerLabel: f.ownerId ? (userLabels[f.ownerId] ?? null) : null,
    }));
    if (pi.artId) {
      canTransitionExecution = hasCapability(principal, "feature.delivery.set", {
        tenantId: principal.tenantId,
        artId: pi.artId,
      });
    }
  }

  return (
    <Suspense fallback={null}>
      <PiWorkspaceShell
        model={overview}
        {...(tab !== undefined ? { activeTab: tab } : {})}
        planTab={
          planningModel && effectiveArtId
            ? {
                artId: effectiveArtId,
                canEdit: canEditPlan,
                view: planView,
                model: planningModel,
                currentCycleKey: halfYearKey(new Date()),
                availableArts,
              }
            : null
        }
        objectivesTab={{
          rows: objectiveRows,
          teams: teamOptions,
          canVote: canVoteObjective,
          canCreate: canCreateObjective,
        }}
        executionTab={{
          features: executionFeatures,
          canTransition: canTransitionExecution,
        }}
        dependenciesTab={{ edges: dependencyEdges }}
        impedimentsTab={{
          artId: pi.artId,
          rows: impedimentRows,
          canCreate: canCreateImpediment,
          canEscalate: canEscalateImp,
          canResolve: canResolveImp,
        }}
        closureTab={{
          status: pi.status,
          systemDemoAt:
            pi.systemDemoAt instanceof Date ? pi.systemDemoAt.toISOString().slice(0, 10) : null,
          inspectAdaptAt:
            pi.inspectAdaptAt instanceof Date ? pi.inspectAdaptAt.toISOString().slice(0, 10) : null,
          retrospectiveNotes: pi.retrospectiveNotes ?? null,
          issues: closureIssues,
          openImpediments: closureOpen,
        }}
      />
    </Suspense>
  );
}
