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

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StrategyPage({ searchParams }: PageProps) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage = authorize("target.manage", { tenantId: principal.tenantId }, principal).allow;
  if (!canManage) redirect("/ziele");

  const params = await searchParams;
  // Kein Sub-Tab-Toggle mehr auf /strategy — Alt-Deeplinks (?tab=…) fallen
  // auf die Strategie-Ansicht zurück.
  const tab: ZieleSubTab = "strategie";
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

  // Pflege-Surface: Edit-Affordances erzwungen aktiv (target.manage ist
  // schon das Gate); Money/Pflege-Sub-Tabs blendet die Shell weg, wenn
  // sie mit mode="strategy" gerendert wird.
  const model = {
    ...tree,
    ...inventory,
    tab,
    permissions: { canEditStrategy: true, canEditKpiValuation: true },
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
      <ZieleShell model={model} layout={layout} mode="strategy" userLabels={userLabels} />
    </Suspense>
  );
}
