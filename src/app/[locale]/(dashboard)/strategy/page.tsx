import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadKpiInventory, loadStrategyTree, type ZieleSubTab } from "@/server/views/ziele-view";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { ZieleShell } from "@/features/ziele/components/ziele-shell";

/**
 * Strategie-Pflege-Modul (Refactor-Plan Stage A).
 *
 * Vision/Theme/Objective/KR + OKR-Board-Drag + Theme↔Epic-Linking
 * leben hier. `/ziele` zeigt dieselben Daten read-only als
 * Wert-Anzeige; Pflege erfolgt ausschliesslich auf `/strategy`.
 *
 * Gate: `target.manage` (LPM-Audience). Ohne Capability redirect
 * auf `/ziele` — Wert ohne Pflege ist die Default-Surface.
 */
function parseTab(raw: string | undefined): ZieleSubTab {
  return raw === "okrs" ? raw : "strategie";
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StrategyPage({ searchParams }: PageProps) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage = authorize("target.manage", { tenantId: principal.tenantId }, principal).allow;
  if (!canManage) redirect("/ziele");

  const params = await searchParams;
  const tab = parseTab(typeof params.tab === "string" ? params.tab : undefined);
  const period = typeof params.period === "string" ? params.period : undefined;
  const vs = typeof params.vs === "string" ? params.vs : undefined;
  const art = typeof params.art === "string" ? params.art : undefined;
  const layout =
    params.layout === "sankey" || params.layout === "netzplan" ? params.layout : "tabelle";

  const effectivePeriod = tab === "okrs" ? undefined : period;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tree = await loadStrategyTree(db, principal.tenantId, {
    ...(effectivePeriod ? { period: effectivePeriod } : {}),
    ...(vs ? { valueStreamId: vs } : {}),
    ...(art ? { artId: art } : {}),
  });
  const inventory = await loadKpiInventory(db, principal.tenantId, tree);
  const userLabels = await listTenantUserLabels(db, principal.tenantId);

  // Pflege-Surface: Edit-Affordances erzwungen aktiv (target.manage ist
  // schon das Gate); Money/Pflege-Sub-Tabs blendet die Shell weg, wenn
  // sie mit mode="strategy" gerendert wird.
  const model = {
    ...tree,
    ...inventory,
    tab,
    permissions: { canEditStrategy: true, canEditKpiValuation: true },
  };

  return (
    <Suspense fallback={null}>
      <ZieleShell model={model} layout={layout} mode="strategy" userLabels={userLabels} />
    </Suspense>
  );
}
