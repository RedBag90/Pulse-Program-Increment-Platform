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
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/modules/core/kernel/domain/types";

/**
 * ART-Detailseite — auf dem geteilten `EntityDetailShell` (wie Value-Stream/Epic):
 * eine Seite, Tabs via `?tab=`. Reduziert auf Overview · Settings · Verlauf; die
 * früheren route-basierten Tabs Features (Redirect ins Cockpit), Program Increment
 * (vom Umsetzungs-Cockpit abgelöst) und Velocity (Seite längst gelöscht) sind raus.
 */
const TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "settings", label: "Settings" },
  { key: "history", label: "Verlauf" },
];

interface Props {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ArtDetailPage({ params, searchParams }: Props) {
  const { artId } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveTab(TABS, tab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const art = await getArt(db, principal.tenantId, artId as ArtId);
  if (!art) notFound();

  const canEdit = hasCapability(principal, "art.update", { tenantId: principal.tenantId, artId });

  const [history, approvers, userLabels] = await Promise.all([
    listAuditHistory(db, principal.tenantId, "art", art.id),
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
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
      tabs={TABS}
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
