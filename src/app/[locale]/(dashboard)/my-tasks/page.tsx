import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { listMyTasks } from "@/server/services/my-tasks";
import {
  listEpicsForPortfolioList,
  countEpicChildFeatures,
  countEpicCompletedChildFeatures,
} from "@/modules/work/server/services/epic";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { getTenantPractices } from "@/server/services/target-model";
import { buildEpicsListModel } from "@/modules/work/server/views/portfolio-epics-list";
import { buildFeaturesListModel } from "@/server/views/features-list";
import { buildMyTasksListModel } from "@/modules/work/server/views/my-tasks-list";
import { MyTasksListShell } from "@/modules/work/features/my-tasks/components/my-tasks-list-shell";
import { listMyBudgetingTasks } from "@/modules/budgeting/server/services/my-budgeting-tasks";
import { BudgetingTasksSection } from "@/modules/budgeting/features/components/my-tasks/budgeting-tasks-section";
import { listMyApprovals } from "@/modules/work/server/services/my-approvals";
import { MyApprovalsList } from "@/modules/work/features/my-approvals/components/my-approvals-list";
import { listMyHelpRequests } from "@/modules/work/server/services/my-help-requests";
import { HelpRequestsSection } from "@/modules/work/features/my-tasks/components/help-requests-section";
import { Page, PageHeader } from "@/components/layout";

/** Pickt den jüngsten KPI-Messwert (gleicher Helper wie auf /portfolio/epics). */
interface KpiMeasurement {
  date?: string;
  value?: number;
}
function latestMeasurement(raw: unknown): number | null {
  if (!Array.isArray(raw)) return null;
  const items = raw as KpiMeasurement[];
  let bestDate = "";
  let bestValue: number | null = null;
  for (const m of items) {
    if (typeof m.value !== "number") continue;
    const d = typeof m.date === "string" ? m.date : "";
    if (d >= bestDate) {
      bestDate = d;
      bestValue = m.value;
    }
  }
  return bestValue;
}

/**
 * „Meine Tasks" — die persönliche Startseite: **Freigaben** (Entscheidungen, die
 * auf mich warten) und **Tasks** (Epics + Features, deren Owner/Assignee ich bin)
 * gestapelt auf einer Seite. „Meine Freigaben" ist hier aufgegangen; die alte
 * Route /my-approvals leitet hierher um.
 *
 * Reuse vor Reimplement: Epic-Rows kommen aus `buildEpicsListModel`, Feature-Rows
 * aus `buildFeaturesListModel` — dieselben Funktionen wie auf `/portfolio/epics`
 * und `/art/[artId]/features`. Freigaben rendert `MyApprovalsList` (aus dem
 * ehemaligen /my-approvals extrahiert).
 */
export default async function MyTasksPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const tenantId = principal.tenantId;
  const db = createPrismaClient({ userId: principal.id, tenantId });

  // 1) Eigene Tasks holen — Epic + Feature gemischt, mit Bucket/Context.
  const tasks = await listMyTasks(db, principal);

  const myEpicIds = tasks.filter((t) => t.level === "epic").map((t) => t.id);
  const myFeatureIds = tasks.filter((t) => t.level === "feature").map((t) => t.id);

  // 2) Lookups, die beide Sub-Listen brauchen.
  const [valueStreams, userLabels, practices] = await Promise.all([
    listValueStreams(db, tenantId),
    listTenantUserLabels(db, tenantId),
    getTenantPractices(db, tenantId),
  ]);

  // 3) Epic-Anteil: dieselben Includes wie listEpicsForPortfolioList,
  //    aber gefiltert auf eigene Epic-IDs. Wir umgehen listEpics... hier
  //    bewusst, weil es alle Tenant-Epics zieht — auf /my-tasks reicht
  //    der Eigenanteil.
  const allEpicsRich =
    myEpicIds.length === 0
      ? []
      : await listEpicsForPortfolioList(db, tenantId).then((rows) =>
          rows.filter((r) => myEpicIds.includes(r.id)),
        );
  const [featureCounts, completedFeatureCounts] =
    myEpicIds.length === 0
      ? [new Map<string, number>(), new Map<string, number>()]
      : await Promise.all([
          countEpicChildFeatures(db, tenantId),
          countEpicCompletedChildFeatures(db, tenantId),
        ]);

  const epicsModel = buildEpicsListModel({
    epics: allEpicsRich.map((e) => ({
      id: e.id,
      title: e.title,
      stageGate: e.stageGate,
      status: e.status,
      ownerId: e.ownerId,
      valueStream: e.valueStream,
      needsSteeringAttention: e.needsSteeringAttention,
      stagedForBudgeting: e.stagedForBudgeting,
      businessCase: e.businessCase,
      benefitHypothesis: e.benefitHypothesis,
      approvedAt: e.approvedAt,
      plannedStartAt: e.plannedStartAt,
      plannedEndAt: e.plannedEndAt,
      createdAt: e.createdAt,
      kpis: e.kpis
        .filter((k) => k.target != null)
        .map((k) => ({
          baseline: k.baseline != null ? Number(k.baseline) : null,
          target: Number(k.target),
          current: latestMeasurement(k.measurements),
          valuePerUnit: k.valuePerUnit != null ? Number(k.valuePerUnit) : null,
          benefitKind: k.benefitKind,
          recurringInterval: k.recurringInterval,
        })),
      childFeatureCount: featureCounts.get(e.id) ?? 0,
      completedChildFeatureCount: completedFeatureCounts.get(e.id) ?? 0,
      implementationCompletedAt: e.implementationCompletedAt,
      epicType: e.epicType,
      investmentHorizon: e.primarySolution?.horizon ?? null,
    })),
    valueStreams,
    userLabels,
    stageGatesEnabled: practices.stageGates,
  });

  // 4) Feature-Anteil: per-ART würde zu viele Roundtrips kosten — wir laden
  //    alle eigenen Features einmal, mit denselben Includes wie listFeatures.
  const myFeatures =
    myFeatureIds.length === 0
      ? []
      : await db.initiative.findMany({
          where: {
            tenantId,
            level: InitiativeLevel.FEATURE,
            deletedAt: null,
            id: { in: myFeatureIds },
          },
          include: {
            parent: { select: { id: true, title: true } },
            pi: { select: { id: true, name: true } },
          },
        });

  // Filter-Optionen: alle Tenant-Epics (für den Parent-Filter) und alle
  // PIs der betroffenen ARTs.
  const involvedArtIds = [
    ...new Set(myFeatures.map((f) => f.artId).filter((id): id is string => !!id)),
  ];
  const [epicOptionsRaw, piOptionsRaw, blockingDeps] = await Promise.all([
    myFeatureIds.length === 0
      ? Promise.resolve([] as { id: string; title: string }[])
      : db.initiative.findMany({
          where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
          select: { id: true, title: true },
        }),
    involvedArtIds.length === 0
      ? Promise.resolve([] as { id: string; name: string; status: string }[])
      : db.programIncrement.findMany({
          where: { tenantId, artId: { in: involvedArtIds } },
          orderBy: { startDate: "desc" },
          select: { id: true, name: true, status: true },
        }),
    myFeatureIds.length === 0
      ? Promise.resolve([] as { toId: string }[])
      : db.dependency.findMany({
          where: { tenantId, type: "blocks", toId: { in: myFeatureIds } },
          select: { toId: true },
        }),
  ]);
  const blockedFeatureIds = new Set(blockingDeps.map((d) => d.toId));

  // PI-IDs dedupliziert (Timeline-shared).
  const seenPi = new Set<string>();
  const piOptions = piOptionsRaw.filter((p) => {
    if (seenPi.has(p.id)) return false;
    seenPi.add(p.id);
    return true;
  });

  const featuresModel = buildFeaturesListModel({
    features: myFeatures.map((f) => ({
      id: f.id,
      title: f.title,
      status: f.status,
      artId: f.artId!,
      piId: f.piId,
      parent: f.parent,
      pi: f.pi,
      wsjfBusinessValue: f.wsjfBusinessValue,
      wsjfTimeCriticality: f.wsjfTimeCriticality,
      wsjfRiskReduction: f.wsjfRiskReduction,
      wsjfJobSize: f.wsjfJobSize,
      wsjfComputed: f.wsjfComputed != null ? Number(f.wsjfComputed) : null,
      acceptanceCriteria: f.acceptanceCriteria,
      createdAt: f.createdAt,
    })),
    epics: epicOptionsRaw,
    pis: piOptions,
    blockedFeatureIds,
    showWsjf: practices.wsjf,
  });

  // 5) Capability-Gates — pro Domain, Tenant-scoped (Epic) bzw. exemplarisch
  //    auf den ersten betroffenen ART (Feature). Pro-Row enforcen die
  //    Server-Actions ohnehin noch einmal selbst.
  const canEditEpic = hasCapability(principal, "epic.update", { tenantId });
  const sampleArtId = involvedArtIds[0];
  const canEditFeature = sampleArtId
    ? hasCapability(principal, "feature.update", { tenantId, artId: sampleArtId })
    : false;

  const model = buildMyTasksListModel({
    tasks,
    epicRows: epicsModel.rows,
    featureRows: featuresModel.rows,
    stageGatesEnabled: practices.stageGates,
    canEditEpic,
    canEditFeature,
  });

  // Cross-Modul (ADR-0013): der Budgeting-Hinweis wird am Kompositionsroot
  // geladen (Work importiert nicht Budgeting), hinter dem Modul-Gate.
  const budgetingTasks = principal.enabledModules.includes("budgeting")
    ? await listMyBudgetingTasks(db, { id: principal.id, tenantId })
    : [];

  // Freigaben-Inbox — die zweite Sicht dieser Seite (früher /my-approvals).
  const approvals = await listMyApprovals(db, principal);

  // „I need help"-Hinweise für VMO / Portfolio-Management (fremde Owner-Bitten).
  const helpRequests = await listMyHelpRequests(db, {
    id: principal.id,
    tenantId,
    roles: principal.roles,
  });

  return (
    <>
      <HelpRequestsSection tasks={helpRequests} userLabels={userLabels} />
      <BudgetingTasksSection tasks={budgetingTasks} />
      <Page>
        <PageHeader title="Meine Tasks" subtitle="Deine Freigaben und Aufgaben an einem Ort." />
        <MyApprovalsList rows={approvals} />
        <Suspense fallback={null}>
          <MyTasksListShell embedded model={model} tenantId={tenantId} showWsjf={practices.wsjf} />
        </Suspense>
      </Page>
    </>
  );
}
