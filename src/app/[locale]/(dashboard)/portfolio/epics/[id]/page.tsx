import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getEpic } from "@/server/services/epic";
import { listInitiativeHistory } from "@/server/services/initiative";
import { listKpis } from "@/server/services/kpi";
import { listProgramIncrementsForArts } from "@/server/services/pi";
import { listEpicApprovals, listTenantApprovers } from "@/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { getTenantPractices } from "@/server/services/target-model";
import { EntityDetailShell, resolveTab } from "@/components/detail/entity-detail-shell";
import { InitiativeActivitySidebar } from "@/components/detail/initiative-activity-sidebar";
import { PhaseBadge } from "@/components/detail/phase-badge";
import { actionLabel, userLabel } from "@/components/detail/initiative-labels";
import { EPIC_TABS } from "@/features/portfolio/components/epic-detail-shell";
import { EpicOverviewTab } from "@/features/portfolio/components/epic-overview-tab";
import { EpicKpisTab, type KpiRow } from "@/features/portfolio/components/epic-kpis-tab";
import {
  EpicBreakdownTab,
  type BreakdownFeature,
} from "@/features/portfolio/components/epic-breakdown-tab";
import { BenefitHypothesisEditor } from "@/features/portfolio/components/benefit-hypothesis-editor";
import { BusinessCaseEditor } from "@/features/portfolio/components/business-case-editor";
import { EpicApprovalsTab } from "@/features/portfolio/components/epic-approvals-tab";
import { EpicTimelineTab } from "@/features/portfolio/components/epic-timeline-tab";
import {
  RevisionDiff,
  RevisionEditLayout,
  businessCaseDiffRows,
  benefitHypothesisDiffRows,
} from "@/features/portfolio/components/revision-diff";
import { DeleteEpicButton } from "@/features/portfolio/components/delete-epic-button";
import { parseBenefitHypothesis } from "@/domain/benefit-hypothesis";
import { parseBusinessCase } from "@/domain/business-case";
import { parseKpiMeasurements, latestKpiValue } from "@/domain/kpi";
import { parseTimeline } from "@/domain/timeline";
import { sectionStatus, type ApprovalPhase, type ApprovalRecord } from "@/domain/epic-approval";
import type { ApprovalParty } from "@/domain/business-case";
import type { ApprovalSection } from "@/domain/epic-approval";
import { redirect } from "next/navigation";
import type { EpicId } from "@/domain/types";

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function EpicDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epic = await getEpic(db, principal.tenantId, id as EpicId);
  if (!epic) redirect("/portfolio/epics");

  const canEdit =
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("epic_owner") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

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
  }));
  const artIds = [...new Set(breakdownFeatures.map((f) => f.artId).filter(Boolean))];

  const [historyEvents, kpis, pis, approvals, approvers, userLabels, practices] = await Promise.all(
    [
      listInitiativeHistory(db, principal.tenantId, epic.id),
      listKpis(db, principal.tenantId, epic.id as EpicId),
      listProgramIncrementsForArts(db, principal.tenantId, artIds),
      listEpicApprovals(db, principal.tenantId, epic.id as EpicId),
      listTenantApprovers(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
      getTenantPractices(db, principal.tenantId),
    ],
  );

  // The multi-party approval workflow is only present when the target enables it
  // — otherwise the "Freigaben" tab and the phase badge are hidden.
  const tabs = practices.multiPartyApproval
    ? EPIC_TABS
    : EPIC_TABS.filter((t) => t.key !== "approvals");
  const activeTab = resolveTab(tabs, tab);

  const approvalPhase = (epic.approvalPhase as ApprovalPhase | null) ?? "draft";
  const canDecideHypothesis =
    principal.roles.includes("vmo") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const pisByArt: Record<string, { id: string; name: string }[]> = {};
  for (const pi of pis) {
    (pisByArt[pi.artId] ??= []).push({ id: pi.id, name: pi.name });
  }

  const activityEvents = historyEvents.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
    actorId: e.actorId,
  }));

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
  }));

  const benefitHypothesis = parseBenefitHypothesis(epic.benefitHypothesis);
  const businessCase = parseBusinessCase(epic.businessCase);
  const timeline = parseTimeline(epic.timeline);

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
      "Die Benefit-Hypothese ist zur QS bei der VMO eingereicht und währenddessen gesperrt.",
    business_case:
      "Die Hypothese ist freigegeben. Sie ist nun gesperrt — für Änderungen eine neue Revision starten.",
    stakeholder_review:
      "Die Hypothese ist freigegeben und während der Stakeholder-Freigaben gesperrt.",
    approved:
      "Das Epic ist freigegeben. Für Änderungen an der Hypothese eine neue Revision starten.",
  };
  const BC_LOCK: Partial<Record<ApprovalPhase, string>> = {
    draft: "Der Business Case wird erst bearbeitbar, sobald die Benefit-Hypothese freigegeben ist.",
    hypothesis_review: "Der Business Case wird bearbeitbar, sobald die VMO die Hypothese freigibt.",
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

  return (
    <EntityDetailShell
      backHref="/portfolio/epics"
      backLabel="Zurück zu den Epics"
      title={epic.title}
      badge={practices.multiPartyApproval ? <PhaseBadge phase={approvalPhase} /> : undefined}
      tabs={tabs}
      activeTab={activeTab}
      basePath={`/portfolio/epics/${epic.id}`}
      headerActions={canEdit ? <DeleteEpicButton id={epic.id} title={epic.title} /> : undefined}
      aside={<InitiativeActivitySidebar events={activityEvents} userLabels={userLabels} />}
    >
      {activeTab === "overview" && (
        <EpicOverviewTab
          epic={epic}
          ownerName={userLabel(epic.ownerId, userLabels)}
          canEdit={canEdit}
        />
      )}

      {activeTab === "timeline" && (
        <section>
          <h2 className="mb-4 font-heading text-lg font-medium">Timeline</h2>
          <EpicTimelineTab
            epicId={epic.id}
            createdAt={epic.createdAt.toISOString()}
            hypothesisApprovedAt={epic.hypothesisApprovedAt?.toISOString() ?? null}
            businessCaseApprovedAt={epic.businessCaseApprovedAt?.toISOString() ?? null}
            timeline={timeline}
            canEdit={canEdit}
            ownerId={epic.ownerId}
            canAssignOwner={canDecideHypothesis}
            approvers={approvers}
            userLabels={userLabels}
          />
        </section>
      )}

      {activeTab === "approvals" && (
        <EpicApprovalsTab
          epicId={epic.id}
          phase={approvalPhase}
          revision={activeRevision}
          approvals={approvals}
          approvers={approvers}
          userLabels={userLabels}
          currentUserId={principal.id}
          canManage={canEdit}
          canDecideHypothesis={canDecideHypothesis}
          defaultFinanceApproverId={epic.valueStream?.financeApproverId ?? null}
          defaultVmoId={epic.valueStream?.vmoId ?? null}
        />
      )}

      {activeTab === "business-case" && (
        <section>
          <h2 className="mb-4 text-lg font-medium">Business Case</h2>
          {showBcReviewDiff && bcBaseline ? (
            <RevisionDiff rows={businessCaseDiffRows(bcBaseline, businessCase.current)} />
          ) : showBcOwnerEdit && bcBaseline ? (
            <RevisionEditLayout
              left={
                <BusinessCaseEditor epicId={epic.id} current={bcBaseline} history={[]} readOnly />
              }
              right={
                <BusinessCaseEditor
                  epicId={epic.id}
                  current={businessCase.current}
                  history={businessCase.history}
                  readOnly={!bcEditable}
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
              {...(bcLockReason && { lockReason: bcLockReason })}
            />
          )}
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
              {...(hypoLockReason && { lockReason: hypoLockReason })}
            />
          )}
        </section>
      )}

      {activeTab === "breakdown" && (
        <EpicBreakdownTab
          epicId={epic.id}
          epicTitle={epic.title}
          canEdit={canEdit}
          features={breakdownFeatures}
          pisByArt={pisByArt}
          signoff={breakdownSignoff}
        />
      )}

      {activeTab === "kpis" && (
        <EpicKpisTab
          initiativeId={epic.id}
          kpis={kpiRows}
          canEdit={canEdit}
          signoff={kpisSignoff}
        />
      )}

      {activeTab === "history" && (
        <section>
          <h2 className="mb-3 text-lg font-medium">History</h2>
          {activityEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Historie.</p>
          ) : (
            <ul className="divide-y rounded border">
              {activityEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-medium">{actionLabel(e.action)}</span>
                  <span className="text-xs text-muted-foreground">
                    {userLabel(e.actorId, userLabels)}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(e.occurredAt).toLocaleString("de-DE")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </EntityDetailShell>
  );
}
