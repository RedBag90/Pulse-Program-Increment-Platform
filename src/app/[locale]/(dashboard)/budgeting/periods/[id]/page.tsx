import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadPeriodDetail } from "@/modules/budgeting/server/views/period-detail";
import { loadDistributionOverview } from "@/modules/budgeting/server/views/distribution-overview";
import { loadPeriodValueStreams } from "@/modules/budgeting/server/views/period-valuestreams";
import { PeriodSetupTab } from "@/modules/budgeting/features/components/period/period-setup-tab";
import { DistributionOverviewTab } from "@/modules/budgeting/features/components/period/distribution-overview-tab";
import { PeriodValueStreamsTab } from "@/modules/budgeting/features/components/period/period-valuestreams-tab";
import { DeletePeriodButton } from "@/modules/budgeting/features/components/period/delete-period-button";
import { EntityDetailShell, resolveTab, type DetailTab } from "@/components/detail/entity-detail-shell";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  running: "läuft",
  decided: "entschieden",
  closed: "abgeschlossen",
};

const TABS: readonly DetailTab[] = [
  { key: "setup", label: "Setup" },
  { key: "overview", label: "Verteilungs-Übersicht" },
  { key: "valuestreams", label: "Value Streams & ARTs" },
];

/**
 * Kachel-Detail — die Prozess-Heimat eines Budgeting-Zeitraums. Getabt über
 * `EntityDetailShell`: Setup (Beteiligte/Gruppen/Ballot), Verteilungs-Übersicht
 * (Phase 4) und Value Streams & ARTs (Phase 5).
 */
export default async function BudgetingPeriodDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadPeriodDetail(db, principal, id);
  if (!model) notFound();

  const activeTab = resolveTab(TABS, tab);
  const overview =
    activeTab === "overview" ? await loadDistributionOverview(db, principal, id) : null;
  const valueStreams =
    activeTab === "valuestreams" ? await loadPeriodValueStreams(db, principal.tenantId, id) : null;

  return (
    <EntityDetailShell
      backHref="/budgeting/periods"
      backLabel="Budgeting-Zeiträume"
      title={halfYearLabel(model.round.cycleKey)}
      badge={STATUS_LABEL[model.round.status] ?? model.round.status}
      tabs={TABS}
      activeTab={activeTab}
      basePath={`/budgeting/periods/${id}`}
      headerActions={model.canManage ? <DeletePeriodButton id={id} /> : undefined}
    >
      {activeTab === "setup" && <PeriodSetupTab model={model} />}
      {activeTab === "overview" && overview && <DistributionOverviewTab model={overview} />}
      {activeTab === "valuestreams" && valueStreams && <PeriodValueStreamsTab model={valueStreams} />}
    </EntityDetailShell>
  );
}
