import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getEpic, listInitiativeHistory } from "@/server/services/initiative";
import { listKpis } from "@/server/services/kpi";
import { EpicDetailShell, resolveEpicTab } from "@/features/portfolio/components/epic-detail-shell";
import { EpicOverviewTab } from "@/features/portfolio/components/epic-overview-tab";
import { EpicKpisTab, type KpiRow } from "@/features/portfolio/components/epic-kpis-tab";
import { BenefitHypothesisEditor } from "@/features/portfolio/components/benefit-hypothesis-editor";
import { BusinessCaseEditor } from "@/features/portfolio/components/business-case-editor";
import { DeleteEpicButton } from "@/features/portfolio/components/delete-epic-button";
import { parseBenefitHypothesis } from "@/domain/benefit-hypothesis";
import { parseBusinessCase } from "@/domain/business-case";
import { parseKpiMeasurements, latestKpiValue } from "@/domain/kpi";
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
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const [historyEvents, kpis] = await Promise.all([
    listInitiativeHistory(db, principal.tenantId, epic.id),
    listKpis(db, principal.tenantId, epic.id as EpicId),
  ]);

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
    <EpicDetailShell
      epicId={epic.id}
      title={epic.title}
      stageGate={epic.stageGate}
      activeTab={activeTab}
      activityEvents={activityEvents}
      headerActions={canEdit ? <DeleteEpicButton id={epic.id} title={epic.title} /> : undefined}
    >
      {activeTab === "overview" && <EpicOverviewTab epic={epic} canEdit={canEdit} />}

      {activeTab === "business-case" && (
        <section>
          <h2 className="mb-4 text-lg font-medium">Business Case</h2>
          {canEdit ? (
            <BusinessCaseEditor
              epicId={epic.id}
              current={businessCase.current}
              history={businessCase.history}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Keine Bearbeitungsrechte.</p>
          )}
        </section>
      )}

      {activeTab === "benefit-hypothesis" && (
        <section>
          <h2 className="mb-4 text-lg font-medium">Benefit Hypothese</h2>
          {canEdit ? (
            <BenefitHypothesisEditor
              epicId={epic.id}
              current={benefitHypothesis.current}
              history={benefitHypothesis.history}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Keine Bearbeitungsrechte.</p>
          )}
        </section>
      )}

      {activeTab === "breakdown" && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Breakdown</h2>
          {epic.children.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine untergeordneten Initiativen.</p>
          ) : (
            <ul className="space-y-2">
              {epic.children.map((child) => (
                <li key={child.id} className="flex items-center gap-3 rounded border p-3 text-sm">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">L{child.level}</span>
                  <span className="font-medium">{child.title}</span>
                  <span className="ml-auto text-muted-foreground">{child.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
    </EpicDetailShell>
  );
}
