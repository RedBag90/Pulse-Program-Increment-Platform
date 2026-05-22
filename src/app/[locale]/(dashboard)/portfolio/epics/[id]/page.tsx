import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getEpic } from "@/server/services/epic";
import { listInitiativeHistory } from "@/server/services/initiative";
import { listKpis } from "@/server/services/kpi";
import { listProgramIncrementsForArts } from "@/server/services/pi";
import { listEpicApprovals, listTenantApprovers } from "@/server/services/epic-approval";
import { EntityDetailShell } from "@/components/detail/entity-detail-shell";
import { InitiativeActivitySidebar } from "@/components/detail/initiative-activity-sidebar";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import { EPIC_TABS, resolveEpicTab } from "@/features/portfolio/components/epic-detail-shell";
import { EpicOverviewTab } from "@/features/portfolio/components/epic-overview-tab";
import { EpicKpisTab, type KpiRow } from "@/features/portfolio/components/epic-kpis-tab";
import {
  EpicBreakdownTab,
  type BreakdownFeature,
} from "@/features/portfolio/components/epic-breakdown-tab";
import { BenefitHypothesisEditor } from "@/features/portfolio/components/benefit-hypothesis-editor";
import { BusinessCaseEditor } from "@/features/portfolio/components/business-case-editor";
import { EpicApprovalsTab } from "@/features/portfolio/components/epic-approvals-tab";
import { DeleteEpicButton } from "@/features/portfolio/components/delete-epic-button";
import { parseBenefitHypothesis } from "@/domain/benefit-hypothesis";
import { parseBusinessCase } from "@/domain/business-case";
import { parseKpiMeasurements, latestKpiValue } from "@/domain/kpi";
import type { ApprovalPhase } from "@/domain/epic-approval";
import { redirect } from "next/navigation";
import type { EpicId } from "@/domain/types";

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function EpicDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveEpicTab(tab);

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

  const [historyEvents, kpis, pis, approvals, approvers] = await Promise.all([
    listInitiativeHistory(db, principal.tenantId, epic.id),
    listKpis(db, principal.tenantId, epic.id as EpicId),
    listProgramIncrementsForArts(db, principal.tenantId, artIds),
    listEpicApprovals(db, principal.tenantId, epic.id as EpicId),
    listTenantApprovers(db, principal.tenantId),
  ]);

  const approvalPhase = (epic.approvalPhase as ApprovalPhase | null) ?? "draft";
  const canDecideHypothesis =
    principal.roles.includes("vmo") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");
  const canSignoff =
    canDecideHypothesis ||
    principal.roles.includes("value_stream_owner") ||
    principal.roles.includes("portfolio_manager");

  const pisByArt: Record<string, { id: string; name: string }[]> = {};
  for (const pi of pis) {
    (pisByArt[pi.artId] ??= []).push({ id: pi.id, name: pi.name });
  }

  const activityEvents = historyEvents.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));

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

  return (
    <EntityDetailShell
      backHref="/portfolio/epics"
      backLabel="Zurück zu den Epics"
      title={epic.title}
      badge={STAGE_GATE_LABELS[epic.stageGate] ?? epic.stageGate}
      tabs={EPIC_TABS}
      activeTab={activeTab}
      basePath={`/portfolio/epics/${epic.id}`}
      headerActions={canEdit ? <DeleteEpicButton id={epic.id} title={epic.title} /> : undefined}
      aside={<InitiativeActivitySidebar events={activityEvents} />}
    >
      {activeTab === "overview" && <EpicOverviewTab epic={epic} canEdit={canEdit} />}

      {activeTab === "approvals" && (
        <EpicApprovalsTab
          epicId={epic.id}
          phase={approvalPhase}
          revision={epic.approvalRevision ?? 1}
          approvals={approvals}
          approvers={approvers}
          currentUserId={principal.id}
          canManage={canEdit}
          canDecideHypothesis={canDecideHypothesis}
          canSignoff={canSignoff}
        />
      )}

      {activeTab === "business-case" && (
        <section>
          <h2 className="mb-4 text-lg font-medium">Business Case</h2>
          <BusinessCaseEditor
            epicId={epic.id}
            current={businessCase.current}
            history={businessCase.history}
            readOnly={!canEdit || approvalPhase !== "business_case"}
          />
        </section>
      )}

      {activeTab === "benefit-hypothesis" && (
        <section>
          <h2 className="mb-4 text-lg font-medium">Benefit Hypothese</h2>
          <BenefitHypothesisEditor
            epicId={epic.id}
            current={benefitHypothesis.current}
            history={benefitHypothesis.history}
            readOnly={!canEdit || approvalPhase !== "draft"}
          />
        </section>
      )}

      {activeTab === "breakdown" && (
        <EpicBreakdownTab
          epicId={epic.id}
          epicTitle={epic.title}
          canEdit={canEdit}
          features={breakdownFeatures}
          pisByArt={pisByArt}
        />
      )}

      {activeTab === "kpis" && (
        <EpicKpisTab initiativeId={epic.id} kpis={kpiRows} canEdit={canEdit} />
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
                  <span className="font-medium">{e.action}</span>
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
