import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadKpiInventory, loadStrategyTree, type ZieleSubTab } from "@/server/views/ziele-view";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { ZieleShell } from "@/features/ziele/components/ziele-shell";

/**
 * Ziele-Modul — **eine** Surface für Übersicht **und** Pflege (die frühere
 * Trennung /ziele read-only vs. /strategy edit ist zusammengelegt). Wer
 * `target.manage` hält, sieht die Edit-Affordances; alle anderen dieselbe
 * Seite read-only. KPI-Coverage + Bindungen leben weiter unter `/controlling`.
 */
function parseTab(raw: string | undefined): ZieleSubTab {
  return raw === "money" ? raw : "strategie";
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ZielePage({ searchParams }: PageProps) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const params = await searchParams;
  const tab = parseTab(typeof params.tab === "string" ? params.tab : undefined);
  const period = typeof params.period === "string" ? params.period : undefined;
  const vs = typeof params.vs === "string" ? params.vs : undefined;
  const art = typeof params.art === "string" ? params.art : undefined;
  const layout = params.layout === "netzplan" ? params.layout : "tabelle";

  const effectivePeriod = period;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tree = await loadStrategyTree(db, principal.tenantId, {
    ...(effectivePeriod ? { period: effectivePeriod } : {}),
    ...(vs ? { valueStreamId: vs } : {}),
    ...(art ? { artId: art } : {}),
  });
  const inventory = await loadKpiInventory(db, principal.tenantId, tree);
  const userLabels = await listTenantUserLabels(db, principal.tenantId);

  // Edit-Affordances sind Capability-gesteuert (nicht mehr route-hart):
  // `target.manage` schaltet Strategie-Pflege frei, `kpi.bind` die KPI-Bewertung.
  const canEditStrategy = authorize(
    "target.manage",
    { tenantId: principal.tenantId },
    principal,
  ).allow;
  const canEditKpiValuation = authorize(
    "kpi.bind",
    { tenantId: principal.tenantId },
    principal,
  ).allow;

  const model = {
    ...tree,
    ...inventory,
    tab,
    permissions: { canEditStrategy, canEditKpiValuation },
    // Freemium: welche Premium-Quell-Module der Tenant freigeschaltet hat —
    // steuert 🔒-Upsell-Hinweise statt leerer Premium-Picker im Personal-Tenant.
    modules: {
      portfolio: principal.enabledModules.includes("portfolio"),
      program: principal.enabledModules.includes("program"),
      controlling: principal.enabledModules.includes("controlling"),
    },
  };

  return (
    <Suspense fallback={null}>
      <ZieleShell model={model} layout={layout} userLabels={userLabels} />
    </Suspense>
  );
}
