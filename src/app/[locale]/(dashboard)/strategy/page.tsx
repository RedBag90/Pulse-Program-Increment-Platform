import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadZieleModel, type ZieleSubTab } from "@/server/views/ziele-view";
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
  const layout =
    params.layout === "sankey" || params.layout === "tabelle" || params.layout === "netzplan"
      ? params.layout
      : "tree";

  const effectivePeriod = tab === "okrs" ? undefined : period;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const baseModel = await loadZieleModel(db, principal, {
    tab,
    ...(effectivePeriod ? { period: effectivePeriod } : {}),
  });

  // Pflege-Surface: Edit-Affordances erzwungen aktiv (target.manage ist
  // schon das Gate); Money/Pflege-Sub-Tabs blendet die Shell weg, wenn
  // sie mit mode="strategy" gerendert wird.
  const model = {
    ...baseModel,
    permissions: { ...baseModel.permissions, canEditStrategy: true },
  };

  return (
    <Suspense fallback={null}>
      <ZieleShell model={model} layout={layout} mode="strategy" />
    </Suspense>
  );
}
