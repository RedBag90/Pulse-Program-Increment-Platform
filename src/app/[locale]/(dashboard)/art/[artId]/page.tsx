import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/modules/core/org/server/services/art";
import { listAuditHistory } from "@/server/services/audit-history";
import { listTenantApprovers } from "@/modules/work/server/services/tenant-approvers";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { userLabel } from "@/components/detail/initiative-labels";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { ArtOverviewForm } from "@/modules/core/org/features/capacity/components/art-overview-form";
import { loadArtBudgetDetail } from "@/modules/budgeting/server/views/art-budget-detail";
import { getTenantPractices } from "@/server/services/target-model";
import { listValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";
import { resolveGuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";
import { ArtBudgetTab } from "@/modules/budgeting/features/components/art-budget/art-budget-tab";
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/modules/core/kernel/domain/types";

/**
 * ART-Detailseite — auf dem geteilten `EntityDetailShell` (wie Value-Stream/Epic):
 * eine Seite, Tabs via `?tab=`. Reduziert auf Overview · Settings · Verlauf; die
 * früheren route-basierten Tabs Features (Redirect ins Cockpit), Program Increment
 * (vom Umsetzungs-Cockpit abgelöst) und Velocity (Seite längst gelöscht) sind raus.
 */
const BASE_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "settings", label: "Settings" },
  { key: "history", label: "Verlauf" },
];

/** Budget nur mit aktivem Modul — und stets vor „Verlauf", wie beim Wertstrom. */
function tabsFor(budgetingEnabled: boolean): readonly DetailTab[] {
  return budgetingEnabled
    ? [...BASE_TABS.slice(0, -1), { key: "budget", label: "Budget" }, ...BASE_TABS.slice(-1)]
    : BASE_TABS;
}

interface Props {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ tab?: string; cycle?: string }>;
}

export default async function ArtDetailPage({ params, searchParams }: Props) {
  const { artId } = await params;
  const { tab, cycle } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const art = await getArt(db, principal.tenantId, artId as ArtId);
  if (!art) notFound();

  const canEdit = hasCapability(principal, "art.update", { tenantId: principal.tenantId, artId });

  // Budgeting ist ein oberes Modul: ohne Entitlement lädt die Seite seine Daten
  // gar nicht erst und zeigt den Reiter nicht (Degradation, ADR-0013).
  const budgetingEnabled = principal.enabledModules.includes("budgeting");
  const tabs = tabsFor(budgetingEnabled);
  const activeTab = resolveTab(tabs, tab);

  const [practices, guardrailRows, tenantRow] = await Promise.all([
    getTenantPractices(db, principal.tenantId),
    budgetingEnabled
      ? listValueStreamGuardrailTargets(db, principal.tenantId)
      : Promise.resolve([]),
    budgetingEnabled
      ? db.tenant.findUnique({
          where: { id: principal.tenantId },
          select: { guardrailTargets: true },
        })
      : Promise.resolve(null),
  ]);
  const threshold = resolveGuardrailTargets(
    guardrailRows,
    tenantRow?.guardrailTargets ?? null,
    art.valueStream.id,
  ).targets.approval.portfolioThreshold;
  // Verteilt wird der Rahmen *für* den ART — die Rechte hängen am Wertstrom.
  const canDistribute =
    art.valueStream.financeApproverId === principal.id ||
    hasCapability(principal, "rtb_item.manage", {
      tenantId: principal.tenantId,
      valueStreamId: art.valueStream.id,
    });

  const [history, approvers, userLabels, budgetDetail] = await Promise.all([
    listAuditHistory(db, principal.tenantId, "art", art.id),
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    budgetingEnabled
      ? loadArtBudgetDetail(
          db,
          principal.tenantId,
          { id: art.id, valueStreamId: art.valueStream.id },
          {
            ...(cycle != null ? { cycleKey: cycle } : {}),
            artEpics: practices.artEpics,
            threshold,
          },
        )
      : Promise.resolve(null),
  ]);
  const rteUsers = approvers.filter((u) => u.roles.includes("rte"));
  const events = history.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));

  return (
    <EntityDetailShell
      backHref="/structure"
      backLabel="Zurück zur Struktur"
      title={art.name}
      badge={art.valueStream.name}
      tabs={tabs}
      activeTab={activeTab}
      basePath={`/art/${art.id}`}
    >
      {activeTab === "overview" && (
        <dl className="max-w-xl space-y-3 text-sm">
          <Field label="Name">{art.name}</Field>
          <Field label="Wertstrom">{art.valueStream.name}</Field>
          <Field label="Beschreibung">{art.description ?? "—"}</Field>
          <Field label="PI-Kadenz">{art.piCadenceWeeks} Wochen</Field>
          <Field label="RTE">{art.rteId ? userLabel(art.rteId, userLabels) : "—"}</Field>
        </dl>
      )}

      {activeTab === "settings" && (
        <section>
          {canEdit ? (
            <ArtOverviewForm
              key={[
                art.id,
                art.name,
                art.description ?? "",
                art.piCadenceWeeks,
                art.rteId ?? "",
              ].join("|")}
              id={art.id}
              name={art.name}
              description={art.description ?? ""}
              piCadenceWeeks={art.piCadenceWeeks}
              rteId={art.rteId ?? ""}
              rteUsers={rteUsers}
              userLabels={userLabels}
            />
          ) : (
            <dl className="max-w-xl space-y-3 text-sm">
              <Field label="Name">{art.name}</Field>
              <Field label="Beschreibung">{art.description ?? "—"}</Field>
              <Field label="PI-Kadenz">{art.piCadenceWeeks} Wochen</Field>
              <Field label="RTE">{art.rteId ? userLabel(art.rteId, userLabels) : "—"}</Field>
            </dl>
          )}
        </section>
      )}

      {activeTab === "budget" && budgetDetail && (
        <ArtBudgetTab
          detail={budgetDetail}
          basePath={`/art/${art.id}`}
          canDistribute={canDistribute}
        />
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
