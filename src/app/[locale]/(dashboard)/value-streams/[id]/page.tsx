import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getValueStream } from "@/server/services/value-stream";
import { getValueStreamBudgets, type ValueStreamBudget } from "@/server/services/budgeting";
import { getArtBudgetBreakdown } from "@/server/services/art-budget";
import { ArtBudgetBreakdown } from "@/features/capacity/components/art-budget-breakdown";
import { listAuditHistory } from "@/server/services/audit-history";
import { listTenantApprovers } from "@/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { userLabel } from "@/components/detail/initiative-labels";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { ValueStreamOverviewForm } from "@/features/capacity/components/value-stream-overview-form";
import { CreateArtDialog } from "@/features/art/components/create-art-dialog";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ValueStreamId } from "@/domain/types";

const TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "arts", label: "ARTs" },
  { key: "history", label: "Verlauf" },
];

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const fmtEur = (v: number) => eur.format(Math.round(v));

/**
 * Read-only budget plan derived from the Value Stream's Epics' participatory-
 * budgeting allocations, per half-year across the forecast horizon.
 */
function BudgetPlan({
  periods,
  plan,
}: {
  periods: { key: string; label: string }[];
  plan: ValueStreamBudget | undefined;
}) {
  const hasAny = periods.some((p) => (plan?.byPeriod[p.key] ?? 0) > 0);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Budgetplan</h2>
      <p className="text-xs text-muted-foreground">
        Automatisch aus den Participatory-Budgeting-Zuteilungen der Epics dieses Wertstroms.
      </p>
      {!hasAny ? (
        <p className="text-sm text-muted-foreground">Noch kein Budget zugeteilt.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                {periods.map((p) => (
                  <th key={p.key} className="p-2 text-right font-medium">
                    {p.label}
                  </th>
                ))}
                <th className="p-2 text-right font-medium">Summe</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {periods.map((p) => (
                  <td key={p.key} className="p-2 text-right tabular-nums">
                    {fmtEur(plan?.byPeriod[p.key] ?? 0)}
                  </td>
                ))}
                <td className="p-2 text-right font-medium tabular-nums">
                  {fmtEur(plan?.total ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ValueStreamDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveTab(TABS, tab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const vs = await getValueStream(db, principal.tenantId, id as ValueStreamId);
  if (!vs) redirect("/structure");

  const canEdit =
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("value_stream_owner") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const [history, approvers, userLabels, vsBudgets, artBreakdown] = await Promise.all([
    listAuditHistory(db, principal.tenantId, "value_stream", vs.id),
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    getValueStreamBudgets(db, principal.tenantId),
    getArtBudgetBreakdown(db, principal.tenantId, vs.id as ValueStreamId),
  ]);
  const budgetPlan = vsBudgets.valueStreams.find((b) => b.valueStreamId === vs.id);

  // ART budgets are distributed by the VS Finance approver (or a portfolio
  // manager / admin) — mirrors the saveArtBudget service-seam gate.
  const canEditArtBudget =
    vs.financeApproverId === principal.id ||
    principal.roles.includes("portfolio_manager") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");
  const events = history.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));
  const vmoUsers = approvers.filter((u) => u.roles.includes("vmo"));

  return (
    <EntityDetailShell
      backHref="/structure"
      backLabel="Zurück zur Struktur"
      title={vs.name}
      badge={`${vs.arts.length} ART${vs.arts.length !== 1 ? "s" : ""}`}
      tabs={TABS}
      activeTab={activeTab}
      basePath={`/value-streams/${vs.id}`}
    >
      {activeTab === "overview" && (
        <div className="space-y-8">
          {canEdit ? (
            <ValueStreamOverviewForm
              key={[
                vs.id,
                vs.name,
                vs.description ?? "",
                vs.financeApproverId ?? "",
                vs.vmoId ?? "",
              ].join("|")}
              id={vs.id}
              name={vs.name}
              description={vs.description ?? ""}
              financeApproverId={vs.financeApproverId ?? ""}
              vmoId={vs.vmoId ?? ""}
              users={approvers}
              vmoUsers={vmoUsers}
              userLabels={userLabels}
            />
          ) : (
            <dl className="max-w-xl space-y-3 text-sm">
              <Field label="Name">{vs.name}</Field>
              <Field label="Beschreibung">{vs.description ?? "—"}</Field>
              <Field label="Finance Approver">
                {vs.financeApproverId ? userLabel(vs.financeApproverId, userLabels) : "—"}
              </Field>
              <Field label="VMO">{vs.vmoId ? userLabel(vs.vmoId, userLabels) : "—"}</Field>
            </dl>
          )}
          <BudgetPlan periods={vsBudgets.periods} plan={budgetPlan} />
          <ArtBudgetBreakdown
            periods={artBreakdown.periods}
            vsByPeriod={artBreakdown.vsByPeriod}
            arts={artBreakdown.arts}
            canEdit={canEditArtBudget}
          />
        </div>
      )}

      {activeTab === "arts" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">ARTs</h2>
            {canEdit && <CreateArtDialog valueStreams={[{ id: vs.id, name: vs.name }]} />}
          </div>
          {vs.arts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine ARTs in diesem Value Stream.</p>
          ) : (
            <ul className="space-y-2">
              {vs.arts.map((art) => (
                <li key={art.id}>
                  <Link
                    href={`/art/${art.id}`}
                    className="flex items-center gap-3 rounded border p-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{art.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {art._count.teams} Team{art._count.teams !== 1 ? "s" : ""}
                    </span>
                  </Link>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
