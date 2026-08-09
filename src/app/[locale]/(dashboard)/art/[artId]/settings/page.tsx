import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/modules/core/org/server/services/art";
import { listTenantApprovers } from "@/modules/work/server/services/epic-approval";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { userLabel } from "@/components/detail/initiative-labels";
import { ArtSubNav } from "@/modules/core/org/features/art/components/art-sub-nav";
import { ArtOverviewForm } from "@/modules/core/org/features/capacity/components/art-overview-form";
import { Page, PageHeader, PageSection } from "@/components/layout";
import { redirect, notFound } from "next/navigation";
import type { ArtId } from "@/modules/core/kernel/domain/types";

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

  const canEdit = hasCapability(principal, "art.update", {
    tenantId: principal.tenantId,
    artId,
  });

  const [approvers, userLabels] = await Promise.all([
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  const rteUsers = approvers.filter((u) => u.roles.includes("rte"));

  return (
    <Page>
      <ArtSubNav artId={artId} artName={art.name} />

      <PageHeader title="Settings" />

      <PageSection>
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
      </PageSection>
    </Page>
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
