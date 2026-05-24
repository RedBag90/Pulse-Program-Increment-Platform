import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getValueStream } from "@/server/services/value-stream";
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

  const [history, approvers, userLabels] = await Promise.all([
    listAuditHistory(db, principal.tenantId, "value_stream", vs.id),
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
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
      {activeTab === "overview" &&
        (canEdit ? (
          <ValueStreamOverviewForm
            key={[
              vs.id,
              vs.name,
              vs.description ?? "",
              vs.budgetAmount?.toString() ?? "",
              vs.budgetCurrency ?? "",
              vs.financeApproverId ?? "",
              vs.vmoId ?? "",
            ].join("|")}
            id={vs.id}
            name={vs.name}
            description={vs.description ?? ""}
            budgetAmount={vs.budgetAmount?.toString() ?? ""}
            budgetCurrency={vs.budgetCurrency ?? ""}
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
            <Field label="Budget">
              {vs.budgetAmount ? `${vs.budgetAmount.toString()} ${vs.budgetCurrency ?? ""}` : "—"}
            </Field>
            <Field label="Finance Approver">
              {vs.financeApproverId ? userLabel(vs.financeApproverId, userLabels) : "—"}
            </Field>
            <Field label="VMO">{vs.vmoId ? userLabel(vs.vmoId, userLabels) : "—"}</Field>
          </dl>
        ))}

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
