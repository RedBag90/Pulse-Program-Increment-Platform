import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { listTenantApprovers } from "@/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { userLabel } from "@/components/detail/initiative-labels";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { ArtOverviewForm } from "@/features/capacity/components/art-overview-form";
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

export default async function ArtSettingsPage({ params }: Props) {
  const { artId } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const art = await getArt(db, principal.tenantId, artId as ArtId);
  if (!art) notFound();

  const canEdit =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");

  const [approvers, userLabels] = await Promise.all([
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  const rteUsers = approvers.filter((u) => u.roles.includes("rte"));

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <ArtSubNav artId={artId} artName={art.name} />

      <section className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
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
    </main>
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
