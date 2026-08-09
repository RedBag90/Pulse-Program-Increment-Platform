import { requirePrincipal } from "@/server/auth/principal";
import { authorize, hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getEpic } from "@/server/services/epic";
import { loadBreakdownLayout } from "@/server/services/breakdown-layout";
import { EpicGoalsBadge } from "@/features/portfolio/components/epic-goals-badge";
import { EpicRealizedTile } from "@/features/portfolio/components/epic-realized-tile";
import { loadEpicGoalLinks } from "@/modules/core/goals/server/views/epic-goal-contributions";
import { listInitiativeHistory } from "@/modules/core/kernel/server/initiative";
import { listKpis } from "@/modules/core/kpi/server/kpi";
import { listProgramIncrementsForArts } from "@/server/services/pi";
import { listEpicApprovals, listTenantApprovers } from "@/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { getTenantPractices } from "@/server/services/target-model";
import { EntityDetailShell, resolveTab } from "@/components/detail/entity-detail-shell";
import { loadCockpitFeatureDetail } from "@/server/views/cockpit-feature-detail";
import { FeatureSlideOver } from "@/features/umsetzung/components/feature-slide-over";
import {
  InitiativeActivitySidebar,
  type ActivityItem,
} from "@/components/detail/initiative-activity-sidebar";
import { PhaseBadge } from "@/components/detail/phase-badge";
import { EpicHistoryTimeline } from "@/features/portfolio/components/epic-history-timeline";
import { EPIC_TABS } from "@/features/portfolio/components/epic-detail-shell";
import { EpicOverviewTab } from "@/features/portfolio/components/epic-overview-tab";
import { EpicReifegradActivityBar } from "@/features/portfolio/components/epic-reifegrad-activity-bar";
import { EpicImpactConfirmDialog } from "@/features/portfolio/components/epic-impact-confirm-dialog";
import { subStageFor } from "@/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { EpicKpisTab, type KpiRow } from "@/features/portfolio/components/epic-kpis-tab";
import {
  EpicBreakdownTab,
  type BreakdownFeature,
} from "@/features/portfolio/components/epic-breakdown-tab";
import { BenefitHypothesisEditor } from "@/features/portfolio/components/benefit-hypothesis-editor";
import { BusinessCaseEditor } from "@/features/portfolio/components/business-case-editor";
import { EpicTimelineTab } from "@/features/portfolio/components/epic-timeline-tab";
import {
  RevisionDiff,
  RevisionEditLayout,
  businessCaseDiffRows,
  benefitHypothesisDiffRows,
} from "@/features/portfolio/components/revision-diff";
import { DeleteEpicButton } from "@/features/portfolio/components/delete-epic-button";
import { parseBenefitHypothesis, benefitHypothesisHasContent } from "@/domain/benefit-hypothesis";
import {
  parseBusinessCase,
  businessCaseHasContent,
  computeBusinessCaseTotals,
} from "@/domain/business-case";
import { EpicHeroFacts } from "@/features/portfolio/components/epic-hero-facts";
import { epicBenefitFromKpis } from "@/domain/epic-economics";
import { epicNextStep } from "@/domain/epic-next-step";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { parseKpiMeasurements, latestKpiValue } from "@/modules/core/kpi/domain/kpi";
import { parseTimeline } from "@/domain/timeline";
import {
  sectionStatus,
  APPROVAL_PARTY_LABELS,
  APPROVAL_SECTION_LABELS,
  type ApprovalPhase,
  type ApprovalRecord,
} from "@/domain/epic-approval";
import type { ApprovalParty } from "@/domain/business-case";
import type { ApprovalSection } from "@/domain/epic-approval";
import { redirect } from "next/navigation";
import type { EpicId } from "@/modules/core/kernel/domain/types";

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string; featureId?: string }>;
}

/** Pull the free-text comment out of an audit event's `changes` diff, if any.
 *  Hypothesis approve/reject and the legacy stage-gate write it as
 *  `changes.comment.after`. */
function auditComment(changes: unknown): string | undefined {
  const after = (changes as { comment?: { after?: unknown } } | null)?.comment?.after;
  return typeof after === "string" && after.trim() !== "" ? after : undefined;
}

export default async function EpicDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab, featureId } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epic = await getEpic(db, principal.tenantId, id as EpicId);
  if (!epic) redirect("/portfolio/epics");

  const canEdit = hasCapability(principal, "epic.update", {
    tenantId: principal.tenantId,
    valueStreamId: epic.valueStreamId,
  });

  const breakdownFeatures: BreakdownFeature[] = epic.children.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    description: c.description ?? "",
    artId: c.artId ?? "",
    artName: c.art?.name ?? "—",
    piId: c.piId,
    acceptanceCriteria: c.acceptanceCriteria,
    wsjf: {
      bv: c.wsjfBusinessValue ?? 0,
      tc: c.wsjfTimeCriticality ?? 0,
      rr: c.wsjfRiskReduction ?? 0,
      js: c.wsjfJobSize ?? 0,
      computed: Number(c.wsjfComputed ?? 0),
    },
    featureType: c.featureType,
  }));
  const artIds = [...new Set(breakdownFeatures.map((f) => f.artId).filter(Boolean))];

  const featureIds = breakdownFeatures.map((f) => f.id);
  const [
    historyEvents,
    kpis,
    pis,
    approvals,
    approvers,
    userLabels,
    practices,
    budgetAllocation,
    breakdownDependencies,
    breakdownPositions,
  ] = await Promise.all([
    listInitiativeHistory(db, principal.tenantId, epic.id),
    listKpis(db, principal.tenantId, epic.id as EpicId),
    listProgramIncrementsForArts(db, principal.tenantId, artIds),
    listEpicApprovals(db, principal.tenantId, epic.id as EpicId),
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    getTenantPractices(db, principal.tenantId),
    // Reifegrad-Modell v2: prüft, ob das Epic eine BudgetAllocation mit
    // mindestens einer Period > 0 hat — Indikator für „Budget alloziert"
    // im Sub-Header.
    db.budgetAllocation.findUnique({
      where: { epicId: epic.id },
      select: { allocations: true },
    }),
    // Netzplan (Roadmap-N1 + P6): Edges, die mit MINDESTENS einem
    // Endpunkt in diesem Epic stecken. Cross-Epic-Endpunkte rendert
    // P6 als Ghost-Nodes mit Epic-Titel + Klick-Through.
    featureIds.length === 0
      ? Promise.resolve(
          [] as Array<{
            id: string;
            fromId: string;
            toId: string;
            type: string;
            from: {
              id: string;
              title: string;
              parent: { id: string; title: string } | null;
            } | null;
            to: { id: string; title: string; parent: { id: string; title: string } | null } | null;
          }>,
        )
      : db.dependency.findMany({
          where: {
            tenantId: principal.tenantId,
            OR: [{ fromId: { in: featureIds } }, { toId: { in: featureIds } }],
          },
          select: {
            id: true,
            fromId: true,
            toId: true,
            type: true,
            from: {
              select: {
                id: true,
                title: true,
                parent: { select: { id: true, title: true } },
              },
            },
            to: {
              select: {
                id: true,
                title: true,
                parent: { select: { id: true, title: true } },
              },
            },
          },
        }),
    // Netzplan-Layout (Roadmap-P5): persistierte Node-Positionen pro
    // Epic. Tenant-weit; alle User sehen dasselbe Layout.
    loadBreakdownLayout(db, principal.tenantId, epic.id as EpicId),
  ]);
  const breakdownLayoutPositions: Record<string, { x: number; y: number }> = {};
  for (const [k, v] of breakdownPositions) breakdownLayoutPositions[k] = v;
  const budgetAllocatedSum = budgetAllocation
    ? Object.values((budgetAllocation.allocations ?? {}) as Record<string, number>).reduce(
        (s, v) => s + (typeof v === "number" ? v : 0),
        0,
      )
    : 0;
  const budgetAllocated = budgetAllocatedSum > 0;

  // The multi-party approval workflow lives in the Timeline's "Business Case"
  // phase expander; when the target disables it, that expander + the phase badge
  // stay hidden (gated by `practices.multiPartyApproval`).
  const activeTab = resolveTab(EPIC_TABS, tab);

  const approvalPhase = (epic.approvalPhase as ApprovalPhase | null) ?? "draft";
  // Gates the side-by-side review diff on the Benefit Hypothesis tab — the
  // decide-buttons themselves now live in "Meine Freigaben".
  const canDecideHypothesis = hasCapability(principal, "epic.hypothesis.decide");
  // Submit-Knopf am Hypothese-Editor zeigt sich nur in der draft-Phase und
  // nur, wenn der Principal die epic.hypothesis.submit-Capability traegt.
  const canSubmitHypothesis =
    approvalPhase === "draft" &&
    hasCapability(principal, "epic.hypothesis.submit", {
      tenantId: principal.tenantId,
      valueStreamId: epic.valueStreamId,
    });
  // Submit-Knopf am Business-Case-Editor zeigt sich nur in der
  // business_case-Phase und nur, wenn der Principal die
  // epic.businesscase.submit-Capability traegt.
  const canSubmitBusinessCase =
    approvalPhase === "business_case" &&
    hasCapability(principal, "epic.businesscase.submit", {
      tenantId: principal.tenantId,
      valueStreamId: epic.valueStreamId,
    });

  // Reifegrad-Modell v2: Controlling-Capability für die L5-Impact-Bestätigung.
  // Resource-scoped auf den Value Stream des Epics (wie epic.approve).
  const canConfirmImpact = authorize(
    "epic.impact.confirm",
    { tenantId: principal.tenantId, valueStreamId: epic.valueStreamId },
    principal,
  ).allow;

  // The Portfolio Manager and the epic's value stream owner
  // admins) may nominate the Epic Owner — mirrors the `epic.owner.assign` policy.
  const canAssignOwner = authorize(
    "epic.owner.assign",
    { tenantId: principal.tenantId, valueStreamId: epic.valueStreamId },
    principal,
  ).allow;

  // Advancing the stage gate (incl. the manual "select for analyzing" → L2) mirrors
  // the `epic.approve` policy (portfolio manager / admins).
  const canAdvance = authorize("epic.approve", { tenantId: principal.tenantId }, principal).allow;

  // Netzplan-Ansicht — Drag-to-Connect (Roadmap-N2). Tenant-scoped Indikator;
  // die per-Edge-Auth checkt der `linkDependencyAction`-Server-Action nochmal
  // mit der `artId` der Source.
  const canLinkDependency = hasCapability(principal, "dependency.link", {
    tenantId: principal.tenantId,
  });

  const pisByArt: Record<string, { id: string; name: string }[]> = {};
  for (const pi of pis) {
    if (!pi.artId) continue;
    (pisByArt[pi.artId] ??= []).push({ id: pi.id, name: pi.name });
  }
  // Flat-distinct PI-Liste fuer den Netzplan-PI-Mode (Roadmap-P9):
  // sortiert nach startDate aufsteigend, dedupliziert per id.
  const breakdownPis = (() => {
    const m = new Map<string, { id: string; name: string; startDate: string }>();
    for (const pi of pis) {
      if (m.has(pi.id)) continue;
      m.set(pi.id, {
        id: pi.id,
        name: pi.name,
        startDate: pi.startDate instanceof Date ? pi.startDate.toISOString() : String(pi.startDate),
      });
    }
    return [...m.values()].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  })();

  // The right-hand activity feed merges two disjoint comment sources into one
  // stream: audit events (Hypothesis + legacy stage-gate carry the comment in
  // `changes.comment.after`) and the `epic_approvals.comment` column (Party /
  // Section sign-offs never hit the audit). Sorted newest-first.
  const auditItems: ActivityItem[] = historyEvents.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
    actorId: e.actorId,
    comment: auditComment(e.changes),
  }));

  const approvalComments: ActivityItem[] = approvals
    .filter((a) => a.comment && a.decidedAt)
    .map((a) => ({
      id: `approval-${a.id}`,
      action: a.status === "rejected" ? "epic.approval.rejected" : "epic.approval.granted",
      occurredAt: a.decidedAt!.toISOString(),
      actorId: a.approverUserId ?? undefined,
      comment: a.comment ?? undefined,
      detail: a.party
        ? APPROVAL_PARTY_LABELS[a.party as ApprovalParty]
        : a.section
          ? APPROVAL_SECTION_LABELS[a.section as ApprovalSection]
          : undefined,
    }));

  const activityEvents: ActivityItem[] = [...auditItems, ...approvalComments].sort((x, y) =>
    x.occurredAt < y.occurredAt ? 1 : -1,
  );

  // Active-revision section sign-off state — drives the in-context banners on
  // the Breakdown and KPIs tabs.
  const activeRevision = epic.approvalRevision ?? 1;
  const sectionRecords: ApprovalRecord[] = approvals
    .filter((a) => a.revision === activeRevision)
    .map((a) => ({
      kind: a.kind === "section" ? "section" : "party",
      party: a.party as ApprovalParty | null,
      section: a.section as ApprovalSection | null,
      status: a.status as ApprovalRecord["status"],
    }));
  const signoffActive = approvalPhase === "stakeholder_review";
  // Only the assigned reviewer for a section may sign it off.
  const sectionOwner = (section: ApprovalSection) =>
    approvals.find(
      (a) => a.revision === activeRevision && a.kind === "section" && a.section === section,
    )?.approverUserId ?? null;
  const breakdownSignoff = {
    status: sectionStatus(sectionRecords, "breakdown"),
    active: signoffActive,
    canSignoff: sectionOwner("breakdown") === principal.id,
  };
  const kpisSignoff = {
    status: sectionStatus(sectionRecords, "kpis"),
    active: signoffActive,
    canSignoff: sectionOwner("kpis") === principal.id,
  };

  const kpiRows: KpiRow[] = kpis.map((k) => ({
    id: k.id,
    name: k.name,
    unit: k.unit,
    baseline: k.baseline === null ? null : Number(k.baseline),
    target: k.target === null ? null : Number(k.target),
    latest: latestKpiValue(parseKpiMeasurements(k.measurements)),
    weight: k.benefitWeight === null ? null : Number(k.benefitWeight),
    valuePerUnit: k.valuePerUnit === null ? null : Number(k.valuePerUnit),
    benefitKind: k.benefitKind,
    recurringInterval: k.recurringInterval,
    calculationNote: k.calculationNote,
    measurements: parseKpiMeasurements(k.measurements),
  }));

  // Overview-Tab-Nutzen wird direkt aus den KPIs berechnet (100 %-Zielerreichung).
  const kpiBenefit = epicBenefitFromKpis(kpiRows);

  const benefitHypothesis = parseBenefitHypothesis(epic.benefitHypothesis);
  const businessCase = parseBusinessCase(epic.businessCase);
  const timeline = parseTimeline(epic.timeline);

  // Kernfakten fürs Hero-Band im Sub-Header (Kosten/Nutzen + KPI-Durchschnitt).
  const heroTotals = computeBusinessCaseTotals(businessCase.current, kpiBenefit);
  const heroKpiRatios = kpiRows
    .map((k) => {
      if (k.baseline == null || k.target == null || k.latest == null) return null;
      const denom = k.target - k.baseline;
      if (denom === 0) return 1;
      return Math.min(1, Math.max(0, (k.latest - k.baseline) / denom));
    })
    .filter((r): r is number => r != null);
  const heroKpiAvgPct = heroKpiRatios.length
    ? Math.round((heroKpiRatios.reduce((a, b) => a + b, 0) / heroKpiRatios.length) * 100)
    : null;

  // Last-approved baseline for the revision diff (null until a revision is started).
  const bcBaseline =
    epic.baselineBusinessCase != null ? parseBusinessCase(epic.baselineBusinessCase).current : null;
  const hypoBaseline =
    epic.baselineBenefitHypothesis != null
      ? parseBenefitHypothesis(epic.baselineBenefitHypothesis).current
      : null;
  const bcEditable = canEdit && approvalPhase === "business_case";
  const hypoEditable = canEdit && approvalPhase === "draft";

  // Why an artefact is read-only right now — shown as a hint above the locked form.
  const HYPO_LOCK: Partial<Record<ApprovalPhase, string>> = {
    hypothesis_review:
      "Die Benefit-Hypothese ist zur QS beim Portfolio Manager eingereicht und währenddessen gesperrt.",
    business_case:
      "Die Hypothese ist freigegeben. Sie ist nun gesperrt — für Änderungen eine neue Revision starten.",
    stakeholder_review:
      "Die Hypothese ist freigegeben und während der Stakeholder-Freigaben gesperrt.",
    approved:
      "Das Epic ist freigegeben. Für Änderungen an der Hypothese eine neue Revision starten.",
  };
  const BC_LOCK: Partial<Record<ApprovalPhase, string>> = {
    draft: "Der Business Case wird erst bearbeitbar, sobald die Benefit-Hypothese freigegeben ist.",
    hypothesis_review:
      "Der Business Case wird bearbeitbar, sobald der Portfolio Manager die Hypothese freigibt.",
    stakeholder_review:
      "Der Business Case ist während der laufenden Stakeholder-Freigaben gesperrt.",
    approved:
      "Das Epic ist freigegeben. Für Änderungen am Business Case eine neue Revision starten.",
  };
  const hypoLockReason = canEdit ? HYPO_LOCK[approvalPhase] : undefined;
  const bcLockReason = canEdit ? BC_LOCK[approvalPhase] : undefined;

  // Revision side-by-side visibility — only people with a stake see two versions.
  // A reviewer with an open task gets the read-only highlighted diff; the Owner
  // working a live revision gets the editable side-by-side; everyone else (and
  // the approved state) just sees the current version.
  const viewerHasOpenApproval = approvals.some(
    (a) =>
      a.revision === activeRevision && a.status === "pending" && a.approverUserId === principal.id,
  );
  const showHypoReviewDiff =
    hypoBaseline != null && approvalPhase === "hypothesis_review" && canDecideHypothesis;
  const showBcReviewDiff =
    bcBaseline != null && approvalPhase === "stakeholder_review" && viewerHasOpenApproval;
  const ownerRevisionActive = canEdit && approvalPhase !== "approved";
  const showHypoOwnerEdit = hypoBaseline != null && ownerRevisionActive && !showHypoReviewDiff;
  const showBcOwnerEdit = bcBaseline != null && ownerRevisionActive && !showBcReviewDiff;

  // Slide-Over-Detail nur laden wenn ?featureId= im URL — gleiche Sicht
  // wie im Cockpit, damit ein Klick auf eine Feature-Karte im Epic-
  // Breakdown nicht mehr in eine separate Voll-Route springt.
  const slideOverDetail = featureId
    ? await loadCockpitFeatureDetail(db, principal, featureId)
    : null;

  const goalLinks = await loadEpicGoalLinks(db, principal, epic.id);

  return (
    <>
      <EntityDetailShell
        backHref="/portfolio/epics"
        backLabel="Zurück zu den Epics"
        title={epic.title}
        badge={practices.multiPartyApproval ? <PhaseBadge phase={approvalPhase} /> : undefined}
        tabs={EPIC_TABS}
        activeTab={activeTab}
        basePath={`/portfolio/epics/${epic.id}`}
        headerActions={canEdit ? <DeleteEpicButton id={epic.id} title={epic.title} /> : undefined}
        subHeader={(() => {
          const childStats = {
            total: epic.children.length,
            completed: epic.children.filter((c) => c.status === "completed").length,
          };
          const subStage = subStageFor({
            stageGate: epic.stageGate as StageGate,
            businessCase: epic.businessCase,
            businessCaseApprovedAt: epic.businessCaseApprovedAt,
            childFeatureStats: childStats,
          });
          const nextStep = epicNextStep({
            epicId: epic.id,
            stageGate: epic.stageGate as StageGate,
            subStage,
            approvalPhase: practices.multiPartyApproval ? approvalPhase : null,
            hasHypothesis: benefitHypothesisHasContent(benefitHypothesis.current),
            hasBusinessCase: businessCaseHasContent(businessCase.current),
            budgetAllocated,
            impactRecognizedAt: epic.impactRecognizedAt,
            childFeatureStats: childStats,
          });
          let actionSlot: React.ReactNode = undefined;
          if (nextStep?.cta?.kind === "link") {
            actionSlot = (
              <Link
                href={nextStep.cta.href as never}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium shadow-xs transition-colors hover:bg-muted/50"
              >
                {nextStep.cta.label} <ArrowRight className="size-3.5" />
              </Link>
            );
          } else if (
            nextStep?.cta?.kind === "impact-confirm" &&
            canConfirmImpact &&
            epic.impactRecognizedAt == null
          ) {
            actionSlot = <EpicImpactConfirmDialog epicId={epic.id} epicTitle={epic.title} />;
          }
          return (
            <div className="space-y-4">
              <EpicHeroFacts
                ownerId={epic.ownerId}
                userLabels={userLabels}
                valueStreamName={epic.valueStream?.name ?? null}
                planStart={
                  timeline.estimates.implementation_started
                    ? new Date(timeline.estimates.implementation_started)
                    : null
                }
                planEnd={
                  timeline.estimates.implementation
                    ? new Date(timeline.estimates.implementation)
                    : null
                }
                istStart={epic.implementationStartedAt}
                istEnd={
                  timeline.actuals.implementation ? new Date(timeline.actuals.implementation) : null
                }
                recurringBenefit={heroTotals.recurringBenefit}
                implementationCost={heroTotals.implementationCost}
                kpiCount={kpiRows.length}
                kpiAvgPct={heroKpiAvgPct}
              />
              <EpicReifegradActivityBar
                stageGate={epic.stageGate as StageGate}
                subStage={subStage}
                nextStep={nextStep}
                actionSlot={actionSlot}
              />
            </div>
          );
        })()}
        aside={<InitiativeActivitySidebar events={activityEvents} userLabels={userLabels} />}
      >
        {activeTab === "overview" && (
          <div className="space-y-4">
            <EpicRealizedTile kpis={kpis} />
            <EpicGoalsBadge goalLinks={goalLinks.links} />
            <EpicOverviewTab
              epic={epic}
              canEdit={canEdit}
              canConfirmImpact={canConfirmImpact}
              kpiBenefit={kpiBenefit}
            />
          </div>
        )}

        {activeTab === "timeline" && (
          <section>
            <h2 className="mb-4 font-heading text-lg font-medium">Reifegrad-Phasen und Timeline</h2>
            <EpicTimelineTab
              epicId={epic.id}
              stageGate={epic.stageGate}
              createdAt={epic.createdAt.toISOString()}
              selectedForDetailingAt={epic.selectedForDetailingAt?.toISOString() ?? null}
              hypothesisApprovedAt={epic.hypothesisApprovedAt?.toISOString() ?? null}
              selectedForAnalyzingAt={epic.selectedForAnalyzingAt?.toISOString() ?? null}
              businessCaseApprovedAt={epic.businessCaseApprovedAt?.toISOString() ?? null}
              implementationStartedAt={epic.implementationStartedAt?.toISOString() ?? null}
              impactRecognizedAt={epic.impactRecognizedAt?.toISOString() ?? null}
              timeline={timeline}
              canEdit={canEdit}
              canAdvance={canAdvance}
              ownerId={epic.ownerId}
              canAssignOwner={canAssignOwner}
              approvers={approvers}
              userLabels={userLabels}
              multiPartyApproval={practices.multiPartyApproval}
              approvalPhase={approvalPhase}
              approvalRevision={activeRevision}
              approvals={approvals}
              currentUserId={principal.id}
              defaultFinanceApproverId={epic.valueStream?.financeApproverId ?? null}
              defaultVmoId={epic.valueStream?.vmoId ?? null}
            />
          </section>
        )}

        {activeTab === "business-case" && (
          <section>
            <h2 className="mb-4 text-lg font-medium">Business Case</h2>
            {(() => {
              const kpiNames = kpiRows.map((k) => k.name);
              return showBcReviewDiff && bcBaseline ? (
                <RevisionDiff rows={businessCaseDiffRows(bcBaseline, businessCase.current)} />
              ) : showBcOwnerEdit && bcBaseline ? (
                <RevisionEditLayout
                  left={
                    <BusinessCaseEditor
                      epicId={epic.id}
                      current={bcBaseline}
                      history={[]}
                      readOnly
                      kpiNames={kpiNames}
                    />
                  }
                  right={
                    <BusinessCaseEditor
                      epicId={epic.id}
                      current={businessCase.current}
                      history={businessCase.history}
                      readOnly={!bcEditable}
                      kpiNames={kpiNames}
                      cascade={goalLinks.cascade}
                      {...(bcLockReason && { lockReason: bcLockReason })}
                    />
                  }
                />
              ) : (
                <BusinessCaseEditor
                  epicId={epic.id}
                  current={businessCase.current}
                  history={businessCase.history}
                  readOnly={!bcEditable}
                  canSubmit={canSubmitBusinessCase}
                  kpiNames={kpiNames}
                  cascade={goalLinks.cascade}
                  {...(bcLockReason && { lockReason: bcLockReason })}
                />
              );
            })()}
          </section>
        )}

        {activeTab === "benefit-hypothesis" && (
          <section>
            <h2 className="mb-4 text-lg font-medium">Benefit Hypothese</h2>
            {showHypoReviewDiff && hypoBaseline ? (
              <RevisionDiff
                rows={benefitHypothesisDiffRows(hypoBaseline, benefitHypothesis.current)}
              />
            ) : showHypoOwnerEdit && hypoBaseline ? (
              <RevisionEditLayout
                left={
                  <BenefitHypothesisEditor
                    epicId={epic.id}
                    current={hypoBaseline}
                    history={[]}
                    readOnly
                  />
                }
                right={
                  <BenefitHypothesisEditor
                    epicId={epic.id}
                    current={benefitHypothesis.current}
                    history={benefitHypothesis.history}
                    readOnly={!hypoEditable}
                    {...(hypoLockReason && { lockReason: hypoLockReason })}
                  />
                }
              />
            ) : (
              <BenefitHypothesisEditor
                epicId={epic.id}
                current={benefitHypothesis.current}
                history={benefitHypothesis.history}
                readOnly={!hypoEditable}
                canSubmit={canSubmitHypothesis}
                {...(hypoLockReason && { lockReason: hypoLockReason })}
              />
            )}
          </section>
        )}

        {activeTab === "breakdown" && (
          <EpicBreakdownTab
            epicId={epic.id}
            tenantId={principal.tenantId}
            epicTitle={epic.title}
            canEdit={canEdit}
            features={breakdownFeatures}
            pisByArt={pisByArt}
            signoff={breakdownSignoff}
            dependencies={breakdownDependencies}
            canLinkDependency={canLinkDependency}
            breakdownLayoutPositions={breakdownLayoutPositions}
            breakdownPis={breakdownPis}
          />
        )}

        {activeTab === "kpis" && (
          <EpicKpisTab
            initiativeId={epic.id}
            kpis={kpiRows}
            canEdit={canEdit}
            goalLinks={goalLinks.links}
            signoff={kpisSignoff}
          />
        )}

        {activeTab === "history" && (
          <section>
            <h2 className="mb-3 font-heading text-lg font-medium">History</h2>
            <EpicHistoryTimeline events={activityEvents} userLabels={userLabels} />
          </section>
        )}
      </EntityDetailShell>
      {slideOverDetail && <FeatureSlideOver detail={slideOverDetail} />}
    </>
  );
}
