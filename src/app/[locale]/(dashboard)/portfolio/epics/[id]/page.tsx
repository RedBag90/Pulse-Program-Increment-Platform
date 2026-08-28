import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadEpicDetail } from "@/modules/work/server/views/epic-detail";
import { listProgramIncrementsForArts } from "@/modules/drumbeat/server/services/pi";
import { listBreakdownDependencies } from "@/modules/drumbeat/server/services/dependency";
import { getEpicBudgetAllocation } from "@/modules/budgeting/server/services/epic-allocation";
import { loadIssues } from "@/modules/risks/server/views/issues";
import { IssuesListShell } from "@/modules/risks/features/issue/components/issues-list-shell";
import { loadEpicGoalLinks } from "@/modules/core/goals/server/views/epic-goal-contributions";
import { listTenantApprovers } from "@/modules/work/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { EpicGoalsBadge } from "@/modules/work/features/portfolio/components/epic-goals-badge";
import { EpicRealizedTile } from "@/modules/work/features/portfolio/components/epic-realized-tile";
import { EntityDetailShell, resolveTab } from "@/components/detail/entity-detail-shell";
import { loadCockpitFeatureDetail } from "@/modules/drumbeat/server/views/cockpit-feature-detail";
import { FeatureSlideOver } from "@/modules/drumbeat/features/cockpit/components/feature-slide-over";
import { InitiativeActivitySidebar } from "@/components/detail/initiative-activity-sidebar";
import { PhaseBadge } from "@/components/detail/phase-badge";
import { EpicHistoryTimeline } from "@/modules/work/features/portfolio/components/epic-history-timeline";
import { EPIC_TABS } from "@/modules/work/features/portfolio/components/epic-detail-shell";
import { EpicOverviewTab } from "@/modules/work/features/portfolio/components/epic-overview-tab";
import { EpicLifecycleStepper } from "@/modules/work/features/portfolio/components/epic-lifecycle-stepper";
import { EpicGateCard } from "@/modules/work/features/portfolio/components/gate/epic-gate-card";
import { EpicKpisTab } from "@/modules/work/features/portfolio/components/epic-kpis-tab";
import { EpicBreakdownTab } from "@/modules/work/features/portfolio/components/epic-breakdown-tab";
import { BenefitHypothesisEditor } from "@/modules/work/features/portfolio/components/benefit-hypothesis-editor";
import { BusinessCaseEditor } from "@/modules/work/features/portfolio/components/business-case-editor";
import { EpicTimelineTab } from "@/modules/work/features/portfolio/components/epic-timeline-tab";
import {
  RevisionDiff,
  RevisionEditLayout,
  businessCaseDiffRows,
  benefitHypothesisDiffRows,
} from "@/modules/work/features/portfolio/components/revision-diff";
import { DeleteEpicButton } from "@/modules/work/features/portfolio/components/delete-epic-button";
import { EpicHeroFacts } from "@/modules/work/features/portfolio/components/epic-hero-facts";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import type { EpicId } from "@/modules/core/kernel/domain/types";

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string; featureId?: string }>;
}

/**
 * Epic detail — a cross-module composite. The composition itself (Work
 * economics/approvals + Drumbeat PIs/dependencies + Budgeting funded-window +
 * Core goals/KPI) lives in the `loadEpicDetail` read-model; this route wires the
 * Drumbeat/Budgeting adapters per entitlement, loads the few page-only extras
 * (approvers/user-labels/goal-links), and renders. See ADR-0013.
 */
export default async function EpicDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab, featureId } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tenantId = principal.tenantId;
  const epicId = id as EpicId;

  // Entitlement axis (fail-closed): the Drumbeat/Budgeting slices degrade when the
  // tenant lacks the module. Precedent: `ziele/page.tsx`.
  const enabled = {
    drumbeat: principal.enabledModules.includes("drumbeat"),
    budgeting: principal.enabledModules.includes("budgeting"),
    risks: principal.enabledModules.includes("risks"),
  };

  const [model, approvers, userLabels, goalLinks] = await Promise.all([
    loadEpicDetail(
      db,
      principal,
      epicId,
      {
        pis: (artIds) => listProgramIncrementsForArts(db, tenantId, artIds),
        dependencies: (featureIds) => listBreakdownDependencies(db, tenantId, featureIds),
        budget: () => getEpicBudgetAllocation(db, tenantId, epicId),
      },
      enabled,
    ),
    listTenantApprovers(db, tenantId),
    listTenantUserLabels(db, tenantId),
    loadEpicGoalLinks(db, principal, epicId),
  ]);
  if (!model) redirect("/portfolio/epics");

  // Issues tab content — risks + impediments rolled up over the Epic's feature
  // subtree (composition root may import the risks module; ADR-0013).
  const epicIssues = enabled.risks
    ? await loadIssues(db, principal, { kind: "epic", epicId })
    : null;
  const issueScope = { tenantId };
  const issueCaps = {
    canDocument: hasCapability(principal, "risk.document", issueScope),
    canUpdate: hasCapability(principal, "risk.update", issueScope),
    canRoam: hasCapability(principal, "risk.roam", issueScope),
    canLink: hasCapability(principal, "risk.link", issueScope),
    canDelete: hasCapability(principal, "risk.delete", issueScope),
    canReview: hasCapability(principal, "risk.review", issueScope),
    canManageSettings: hasCapability(principal, "risk.settings.manage", issueScope),
  };

  const { epic, timeline, benefitHypothesis, businessCase, kpiRows } = model;

  // Zuordenbare Solutions = Solutions im Value Stream des Epics (für die Zuordnung).
  const availableSolutions = epic.valueStreamId
    ? await db.solution.findMany({
        where: { tenantId, valueStreamId: epic.valueStreamId, deletedAt: null },
        select: { id: true, name: true, horizon: true },
        orderBy: { name: "asc" },
      })
    : [];
  // Issues tab only when the module is entitled (slice present) — eingefügt VOR
  // History, damit History der letzte Reiter bleibt.
  const tabs = model.risks.disabled
    ? EPIC_TABS
    : [...EPIC_TABS.slice(0, -1), { key: "issues", label: "Issues" }, EPIC_TABS.at(-1)!];
  const activeTab = resolveTab(tabs, tab);

  // Slide-Over-Detail nur laden wenn ?featureId= im URL — gleiche Sicht wie im
  // Cockpit; ein Klick auf eine Feature-Karte springt nicht in eine Voll-Route.
  const slideOverDetail = featureId
    ? await loadCockpitFeatureDetail(db, principal, featureId)
    : null;

  const kpiNames = kpiRows.map((k) => k.name);

  return (
    <>
      <EntityDetailShell
        backHref="/portfolio/epics"
        backLabel="Zurück zu den Epics"
        title={epic.title}
        badge={model.multiPartyApproval ? <PhaseBadge phase={model.approvalPhase} /> : undefined}
        tabs={tabs}
        activeTab={activeTab}
        basePath={`/portfolio/epics/${epic.id}`}
        headerActions={
          model.canEdit ? <DeleteEpicButton id={epic.id} title={epic.title} /> : undefined
        }
        subHeader={(() => {
          // Ein `gate-request`-CTA bekommt keinen eigenen Button mehr: der
          // Wechsel wird über die Gate-Karte darunter beantragt, damit es genau
          // eine Stelle für den Vorgang gibt.
          const actionSlot: React.ReactNode =
            model.nextStep?.cta?.kind === "link" ? (
              <Link
                href={model.nextStep.cta.href as never}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium shadow-xs transition-colors hover:bg-muted/50"
              >
                {model.nextStep.cta.label} <ArrowRight className="size-3.5" />
              </Link>
            ) : undefined;
          return (
            <div className="space-y-4">
              <EpicGateCard epicId={epic.id} gate={model.gate} userLabels={userLabels} />
              <EpicLifecycleStepper
                steps={model.lifecycleSteps}
                nextStep={model.nextStep}
                actionSlot={actionSlot}
              />
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
                recurringBenefit={model.heroTotals.recurringBenefit}
                implementationCost={model.heroTotals.implementationCost}
                kpiCount={kpiRows.length}
                kpiAvgPct={model.heroKpiAvgPct}
              />
            </div>
          );
        })()}
        aside={<InitiativeActivitySidebar events={model.activityEvents} userLabels={userLabels} />}
      >
        {activeTab === "overview" && (
          <div className="space-y-4">
            <EpicRealizedTile kpis={model.kpis} />
            <EpicGoalsBadge goalLinks={goalLinks.links} />
            <EpicOverviewTab
              epic={epic}
              canEdit={model.canEdit}
              kpiBenefit={model.kpiBenefit}
              solutions={availableSolutions}
            />
          </div>
        )}

        {activeTab === "timeline" && (
          <section>
            <h2 className="mb-4 font-heading text-lg font-medium">Reifegrad-Phasen und Timeline</h2>
            <EpicTimelineTab
              epicId={epic.id}
              createdAt={epic.createdAt.toISOString()}
              selectedForDetailingAt={epic.selectedForDetailingAt?.toISOString() ?? null}
              hypothesisApprovedAt={epic.hypothesisApprovedAt?.toISOString() ?? null}
              selectedForAnalyzingAt={epic.selectedForAnalyzingAt?.toISOString() ?? null}
              businessCaseApprovedAt={epic.businessCaseApprovedAt?.toISOString() ?? null}
              implementationStartedAt={epic.implementationStartedAt?.toISOString() ?? null}
              impactRecognizedAt={epic.impactRecognizedAt?.toISOString() ?? null}
              timeline={timeline}
              canEdit={model.canEdit}
              gateHistory={model.gate.disabled ? [] : model.gate.history}
              ownerId={epic.ownerId}
              canAssignOwner={model.canAssignOwner}
              approvers={approvers}
              userLabels={userLabels}
              multiPartyApproval={model.multiPartyApproval}
              approvalPhase={model.approvalPhase}
              approvalRevision={model.activeRevision}
              approvals={model.approvals}
              approvalView={model.approvalView}
              currentUserId={principal.id}
              lifecycleSteps={model.lifecycleSteps}
            />
          </section>
        )}

        {activeTab === "business-case" && (
          <section>
            <h2 className="mb-4 text-lg font-medium">Business Case</h2>
            {model.showBcReviewDiff && model.bcBaseline ? (
              <RevisionDiff rows={businessCaseDiffRows(model.bcBaseline, businessCase.current)} />
            ) : model.showBcOwnerEdit && model.bcBaseline ? (
              <RevisionEditLayout
                left={
                  <BusinessCaseEditor
                    epicId={epic.id}
                    current={model.bcBaseline}
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
                    readOnly={!model.bcEditable}
                    kpiNames={kpiNames}
                    cascade={goalLinks.cascade}
                    {...(model.bcLockReason && { lockReason: model.bcLockReason })}
                  />
                }
              />
            ) : (
              <BusinessCaseEditor
                epicId={epic.id}
                current={businessCase.current}
                history={businessCase.history}
                readOnly={!model.bcEditable}
                canSubmit={model.canSubmitBusinessCase}
                kpiNames={kpiNames}
                cascade={goalLinks.cascade}
                {...(model.bcLockReason && { lockReason: model.bcLockReason })}
              />
            )}
          </section>
        )}

        {activeTab === "benefit-hypothesis" && (
          <section>
            <h2 className="mb-4 text-lg font-medium">Benefit Hypothese</h2>
            {model.showHypoReviewDiff && model.hypoBaseline ? (
              <RevisionDiff
                rows={benefitHypothesisDiffRows(model.hypoBaseline, benefitHypothesis.current)}
              />
            ) : model.showHypoOwnerEdit && model.hypoBaseline ? (
              <RevisionEditLayout
                left={
                  <BenefitHypothesisEditor
                    epicId={epic.id}
                    current={model.hypoBaseline}
                    history={[]}
                    readOnly
                  />
                }
                right={
                  <BenefitHypothesisEditor
                    epicId={epic.id}
                    current={benefitHypothesis.current}
                    history={benefitHypothesis.history}
                    readOnly={!model.hypoEditable}
                    {...(model.hypoLockReason && { lockReason: model.hypoLockReason })}
                  />
                }
              />
            ) : (
              <BenefitHypothesisEditor
                epicId={epic.id}
                current={benefitHypothesis.current}
                history={benefitHypothesis.history}
                readOnly={!model.hypoEditable}
                canSubmit={model.canSubmitHypothesis}
                {...(model.hypoLockReason && { lockReason: model.hypoLockReason })}
              />
            )}
          </section>
        )}

        {activeTab === "breakdown" && (
          <EpicBreakdownTab
            view="list"
            epicId={epic.id}
            tenantId={tenantId}
            epicTitle={epic.title}
            canEdit={model.canEdit}
            features={model.breakdownFeatures}
            pisByArt={model.drumbeat.disabled ? {} : model.drumbeat.pisByArt}
            signoff={model.breakdownSignoff}
            showWsjf={model.showWsjf}
            canSetDelivery={model.canSetDelivery}
            dependencies={model.drumbeat.disabled ? [] : model.drumbeat.dependencies}
            canLinkDependency={model.canLinkDependency}
            breakdownLayoutPositions={model.breakdownLayoutPositions}
            breakdownPis={model.drumbeat.disabled ? [] : model.drumbeat.breakdownPis}
          />
        )}

        {activeTab === "dependencies" && (
          <EpicBreakdownTab
            view="graph"
            epicId={epic.id}
            tenantId={tenantId}
            epicTitle={epic.title}
            canEdit={model.canEdit}
            features={model.breakdownFeatures}
            pisByArt={model.drumbeat.disabled ? {} : model.drumbeat.pisByArt}
            signoff={model.breakdownSignoff}
            showWsjf={model.showWsjf}
            canSetDelivery={model.canSetDelivery}
            dependencies={model.drumbeat.disabled ? [] : model.drumbeat.dependencies}
            canLinkDependency={model.canLinkDependency}
            breakdownLayoutPositions={model.breakdownLayoutPositions}
            breakdownPis={model.drumbeat.disabled ? [] : model.drumbeat.breakdownPis}
          />
        )}

        {activeTab === "kpis" && (
          <EpicKpisTab
            initiativeId={epic.id}
            kpis={kpiRows}
            canEdit={model.canEdit}
            goalLinks={goalLinks.links}
            signoff={model.kpisSignoff}
          />
        )}

        {activeTab === "history" && (
          <section>
            <h2 className="mb-3 font-heading text-lg font-medium">History</h2>
            <EpicHistoryTimeline events={model.activityEvents} userLabels={userLabels} />
          </section>
        )}

        {activeTab === "issues" && epicIssues && (
          <IssuesListShell
            model={epicIssues.model}
            userLabels={epicIssues.userLabels}
            caps={issueCaps}
            initiativeId={epic.id}
            featureOptions={epic.children.map((c) => ({ id: c.id, title: c.title }))}
            embedded
          />
        )}
      </EntityDetailShell>
      {slideOverDetail && <FeatureSlideOver detail={slideOverDetail} />}
    </>
  );
}
