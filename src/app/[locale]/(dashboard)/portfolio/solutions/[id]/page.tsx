import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { listAuditHistory } from "@/server/services/audit-history";
import { loadSolutionDetail } from "@/modules/work/server/views/solution-detail";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";
import { SolutionLifecycleBar } from "@/modules/work/features/portfolio/components/solutions/solution-lifecycle-bar";
import { SolutionRunGrowTiles } from "@/modules/work/features/portfolio/components/solutions/solution-run-grow-tiles";
import { SolutionEditButton } from "@/modules/work/features/portfolio/components/solutions/solution-edit-button";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { STAGE_SHORT } from "@/components/detail/initiative-labels";
import { formatCompactEUR } from "@/lib/formatting";

const TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "epics", label: "Epics" },
  { key: "history", label: "Verlauf" },
];

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/**
 * Solution-Detail — dieselbe `EntityDetailShell` wie Epic, Feature und Value
 * Stream. Der Lifecycle sitzt tab-unabhängig im Sub-Header, weil der
 * Horizont-Wechsel der Vorgang dieser Fläche ist; die Reiter tragen Ökonomie,
 * zugeordnete Epics und den Audit-Verlauf.
 */
export default async function SolutionDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveTab(TABS, tab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadSolutionDetail(db, principal.tenantId, id);
  if (!model) notFound();

  const canManage = hasCapability(principal, "solution.manage", { tenantId: principal.tenantId });
  const history = await listAuditHistory(db, principal.tenantId, "solution", id);
  const events = history.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));

  return (
    <EntityDetailShell
      backHref="/portfolio/solutions"
      backLabel="Zurück zu den Solutions"
      title={model.name}
      badge={
        <HorizonBadge horizon={model.horizon} investmentMode={model.investmentMode} withHelp />
      }
      tabs={TABS}
      activeTab={activeTab}
      basePath={`/portfolio/solutions/${model.id}`}
      {...(canManage ? { headerActions: <SolutionEditButton model={model} /> } : {})}
      subHeader={<SolutionLifecycleBar model={model} canManage={canManage} />}
    >
      {activeTab === "overview" && <SolutionRunGrowTiles model={model} canManage={canManage} />}

      {activeTab === "epics" && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Zugeordnete Epics (Primär)</h2>
          {model.epics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Epics dieser Solution zugeordnet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {model.epics.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <Link href={`/portfolio/epics/${e.id}`} className="font-medium hover:underline">
                    {e.title}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {STAGE_SHORT[e.stageGate as keyof typeof STAGE_SHORT] ?? e.stageGate}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {e.cost > 0 ? formatCompactEUR(e.cost) : "—"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "history" && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Verlauf</h2>
          <AuditTimeline events={events} />
        </section>
      )}
    </EntityDetailShell>
  );
}
