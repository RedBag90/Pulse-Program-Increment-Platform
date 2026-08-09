import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listRisks } from "@/modules/risks/server/services/risk";
import { getRiskSettings } from "@/modules/risks/server/services/risk-settings";
import { buildRisksListModel } from "@/modules/risks/server/views/risks-list";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { RisksListShell } from "@/modules/risks/features/risk/components/risks-list-shell";
import { Page } from "@/components/layout";

/**
 * Risks register — tenant-level ROAM board + probability×impact matrix, scoped
 * reads (see `riskReadFilter`). Composition root for the risks module.
 */
export default async function RisksPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [{ items }, settings, userLabels] = await Promise.all([
    listRisks(db, principal),
    getRiskSettings(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);

  const model = buildRisksListModel({ risks: items, prefix: settings.prefix, userLabels });

  const scope = { tenantId: principal.tenantId };
  const caps = {
    canDocument: hasCapability(principal, "risk.document", scope),
    canUpdate: hasCapability(principal, "risk.update", scope),
    canRoam: hasCapability(principal, "risk.roam", scope),
    canLink: hasCapability(principal, "risk.link", scope),
    canDelete: hasCapability(principal, "risk.delete", scope),
    canReview: hasCapability(principal, "risk.review", scope),
    canManageSettings: hasCapability(principal, "risk.settings.manage", scope),
  };

  return (
    <Suspense fallback={<Page>Lädt…</Page>}>
      <RisksListShell model={model} prefix={settings.prefix} userLabels={userLabels} caps={caps} />
    </Suspense>
  );
}
