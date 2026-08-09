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

  const canDocument = hasCapability(principal, "risk.document", { tenantId: principal.tenantId });
  const canReview = hasCapability(principal, "risk.review", { tenantId: principal.tenantId });
  const canManageSettings = hasCapability(principal, "risk.settings.manage", {
    tenantId: principal.tenantId,
  });

  return (
    <Suspense fallback={<Page>Lädt…</Page>}>
      <RisksListShell
        model={model}
        prefix={settings.prefix}
        canDocument={canDocument}
        canReview={canReview}
        canManageSettings={canManageSettings}
      />
    </Suspense>
  );
}
